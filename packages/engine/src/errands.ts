/**
 * What he asks his agent to do.
 *
 * An agent existed to take a percentage and to bring offers nobody asked for. A real one
 * is an instrument the player uses: he tells him to find a club, to go and get a better
 * contract, to have a word with the manager about minutes, to make the noise in the
 * papers stop. None of it is free. A club that hears its player has told his agent to
 * find him somewhere else does not forget it, and an agent who is sent to the manager
 * every fortnight is an agent the manager stops taking calls from.
 *
 * Every errand here is a trade with a real cost, and the cost is paid whether or not the
 * errand works.
 */
import { clamp, Rng } from './rng.js';
import type { Agent, CareerState } from './types.js';

export type ErrandId = 'findClub' | 'pushForContract' | 'wordAboutMinutes' | 'quietenPress' | 'lookAbroad';

export interface Errand {
  id: ErrandId;
  /** Weeks before he can ask for the same thing again. */
  cooldown: number;
  /** What the agent has to be good at for this to work. */
  skill: (agent: Agent) => number;
}

export const ERRANDS: Record<ErrandId, Errand> = {
  findClub: { id: 'findClub', cooldown: 12, skill: (a) => a.connections },
  pushForContract: { id: 'pushForContract', cooldown: 16, skill: (a) => a.negotiation },
  wordAboutMinutes: { id: 'wordAboutMinutes', cooldown: 8, skill: (a) => a.relationship },
  quietenPress: { id: 'quietenPress', cooldown: 10, skill: (a) => a.connections * 0.6 + a.loyalty * 0.4 },
  lookAbroad: { id: 'lookAbroad', cooldown: 14, skill: (a) => a.internationalNetwork },
};

export type ErrandBlock = 'noAgent' | 'cooldown' | 'noClub' | 'nothingToQuieten' | 'contractLong';

export interface ErrandOption {
  id: ErrandId;
  available: boolean;
  /** Why not, when it is not. */
  blocked?: ErrandBlock;
  weeksLeft: number;
  /** How likely his man is to get it done, 0-1, for the player to weigh. */
  odds: number;
}

function lastAsked(state: CareerState, id: ErrandId): number {
  return Number(state.flags[`errand:${id}`] ?? -999);
}

/** Everything he could send his agent to do this week, and how likely each is to work. */
export function errandOptions(state: CareerState): ErrandOption[] {
  const now = state.world.season * 52 + state.world.week;
  const agent = state.agent;
  const hasClub = Boolean(state.player.clubId);
  const seasonsLeft = state.contract ? state.contract.endSeason - state.world.season : 0;

  return (Object.keys(ERRANDS) as ErrandId[]).map((id) => {
    const errand = ERRANDS[id];
    const since = now - lastAsked(state, id);
    const weeksLeft = Math.max(0, errand.cooldown - since);
    const blocked: ErrandBlock | undefined = !agent
      ? 'noAgent'
      : weeksLeft > 0
        ? 'cooldown'
        : (id === 'pushForContract' || id === 'wordAboutMinutes') && !hasClub
          ? 'noClub'
          : id === 'pushForContract' && seasonsLeft > 2
            ? 'contractLong'
            : id === 'quietenPress' && (state.relationships.media >= 45 || !hasClub)
              ? 'nothingToQuieten'
              : undefined;

    return {
      id,
      available: !blocked,
      ...(blocked ? { blocked } : {}),
      weeksLeft,
      odds: agent ? clamp(0.2 + errand.skill(agent) / 160, 0.15, 0.9) : 0,
    };
  });
}

export interface ErrandResult {
  id: ErrandId;
  worked: boolean;
  /** What it cost him, in the words the app already knows how to print. */
  changes: { key: string; delta: number; before: number; after: number; tone: 'good' | 'bad' | 'neutral' }[];
}

function move(
  changes: ErrandResult['changes'],
  key: string,
  before: number,
  after: number,
): number {
  const rounded = Math.round(after);
  changes.push({
    key,
    delta: rounded - Math.round(before),
    before: Math.round(before),
    after: rounded,
    tone: rounded === Math.round(before) ? 'neutral' : rounded > Math.round(before) ? 'good' : 'bad',
  });
  return after;
}

/** Send him. The odds decide whether it works; the price is paid either way. */
export function runErrand(rng: Rng, state: CareerState, id: ErrandId): ErrandResult | null {
  const option = errandOptions(state).find((entry) => entry.id === id);
  if (!option?.available) return null;
  const agent = state.agent;
  if (!agent) return null;

  state.flags[`errand:${id}`] = state.world.season * 52 + state.world.week;
  const worked = rng.chance(option.odds);
  const changes: ErrandResult['changes'] = [];
  const rel = state.relationships;

  switch (id) {
    case 'findClub': {
      // Telling your agent to find you a club is telling your club you want to leave.
      state.flags['transferRequested'] = true;
      state.flags['agentHunting'] = worked ? 1 : 0;
      rel.board = move(changes, 'rel.board', rel.board, clamp(rel.board - 12, 0, 100));
      rel.fans = move(changes, 'rel.fans', rel.fans, clamp(rel.fans - 6, 0, 100));
      state.managerTrust = move(changes, 'rel.manager', state.managerTrust, clamp(state.managerTrust - 8, 0, 100));
      rel.manager = state.managerTrust;
      break;
    }
    case 'lookAbroad': {
      state.flags['transferRequested'] = true;
      state.flags['agentHunting'] = worked ? 1 : 0;
      state.flags['agentAbroad'] = worked ? 1 : 0;
      rel.board = move(changes, 'rel.board', rel.board, clamp(rel.board - 8, 0, 100));
      state.managerTrust = move(changes, 'rel.manager', state.managerTrust, clamp(state.managerTrust - 5, 0, 100));
      rel.manager = state.managerTrust;
      break;
    }
    case 'pushForContract': {
      // Asking for more is asking the people who pay him to think about what he is worth.
      state.flags['agentAskedTerms'] = worked ? 1 : 0;
      rel.board = move(changes, 'rel.board', rel.board, clamp(rel.board - (worked ? 4 : 9), 0, 100));
      if (!worked) {
        state.player.morale = move(changes, 'change.morale', state.player.morale, clamp(state.player.morale - 5, 0, 100));
      }
      break;
    }
    case 'wordAboutMinutes': {
      // A manager will take this once. Twice is a player who talks through other people.
      const trustCost = worked ? 2 : 9;
      state.managerTrust = move(
        changes,
        'rel.manager',
        state.managerTrust,
        clamp(state.managerTrust + (worked ? 5 : -trustCost), 0, 100),
      );
      rel.manager = state.managerTrust;
      if (worked) state.flags['promisedMinutes'] = state.world.season * 52 + state.world.week;
      break;
    }
    case 'quietenPress': {
      rel.media = move(changes, 'rel.media', rel.media, clamp(rel.media + (worked ? 14 : 3), 0, 100));
      state.finances.balance -= Math.round(agent.commissionPct * 20000);
      if (worked) state.flags['pressCalm'] = state.world.season * 52 + state.world.week + 8;
      break;
    }
  }

  // His man is judged on what he delivers, like everybody else.
  agent.relationship = clamp(agent.relationship + (worked ? 4 : -6), 0, 100);
  return { id, worked, changes };
}
