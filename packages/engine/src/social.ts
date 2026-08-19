import { Rng, clamp } from './rng.js';
import { overall } from './positions.js';
import type {
  AppliedChange,
  CareerState,
  ConsequenceId,
  DecisionResult,
  Relationships,
  RelationshipKey,
} from './types.js';

/**
 * The people around the player. Nothing here is cosmetic: the manager decides
 * whether he plays, the dressing room colours events, the fans and the board decide
 * whether the club sticks with him when form dips.
 */
export function initRelationships(): Relationships {
  return { manager: 45, teammates: 50, fans: 50, board: 50, media: 50 };
}

export function relationshipLabel(value: number): string {
  if (value >= 80) return 'rel.excellent';
  if (value >= 62) return 'rel.good';
  if (value >= 42) return 'rel.neutral';
  if (value >= 25) return 'rel.poor';
  return 'rel.hostile';
}

/** Records a change so the UI can show exactly what a choice did. */
export function track(
  changes: AppliedChange[],
  key: string,
  before: number,
  after: number,
  higherIsBetter = true,
): void {
  const delta = Math.round((after - before) * 10) / 10;
  if (Math.abs(delta) < 0.5) return;
  changes.push({
    key,
    delta,
    before: Math.round(before),
    after: Math.round(after),
    tone: delta === 0 ? 'neutral' : (delta > 0) === higherIsBetter ? 'good' : 'bad',
  });
}

export function adjustRelationship(
  state: CareerState,
  key: RelationshipKey,
  delta: number,
  changes?: AppliedChange[],
): void {
  const before = state.relationships[key];
  const after = clamp(before + delta, 0, 100);
  state.relationships[key] = after;
  if (key === 'manager') state.managerTrust = after;
  if (changes) track(changes, `change.${key}`, before, after);
}

/** Keeps the legacy managerTrust field and the relationship map in step. */
export function syncManagerTrust(state: CareerState): void {
  state.relationships.manager = state.managerTrust;
}

export interface ConsequenceOutcome {
  id: ConsequenceId;
  args?: Record<string, string | number>;
}

/**
 * Turn the current standing into things that actually happen: being dropped, being
 * listed, being fined. Called after every decision and once a week.
 */
export function evaluateConsequences(rng: Rng, state: CareerState): ConsequenceOutcome[] {
  const out: ConsequenceOutcome[] = [];
  const rel = state.relationships;
  const flags = state.flags;
  const inSquad = state.player.squadRole !== 'academy';

  const benchedUntil = Number(flags['benchedUntilWeek'] ?? 0);
  const absoluteWeek = state.world.season * 52 + state.world.week;

  // Manager has lost patience.
  if (inSquad && rel.manager < 24 && absoluteWeek >= benchedUntil && !flags['droppedNotified']) {
    flags['benchedUntilWeek'] = absoluteWeek + rng.int(3, 6);
    flags['droppedNotified'] = true;
    out.push({ id: 'droppedFromSquad' });
  }
  if (rel.manager >= 42 && flags['droppedNotified']) {
    flags['droppedNotified'] = false;
    flags['benchedUntilWeek'] = 0;
    out.push({ id: 'backInFavour' });
  }

  // The club starts looking for a replacement, then lists him.
  if (inSquad && rel.manager < 30 && rel.board < 40 && !flags['transferListed']) {
    if (!flags['replacementSought']) {
      flags['replacementSought'] = true;
      out.push({ id: 'clubSeeksReplacement' });
    } else if (rng.chance(0.4)) {
      flags['transferListed'] = true;
      out.push({ id: 'transferListed' });
    }
  }
  if (flags['transferListed'] && rel.manager > 52 && rel.board > 52) {
    flags['transferListed'] = false;
    flags['replacementSought'] = false;
    out.push({ id: 'offTransferList' });
  }

  if (rel.teammates < 22 && !flags['dressingRoomFallout']) {
    flags['dressingRoomFallout'] = true;
    out.push({ id: 'dressingRoomFallout' });
  }
  if (rel.teammates > 45) flags['dressingRoomFallout'] = false;

  if (rel.fans < 22 && !flags['fansTurned']) {
    flags['fansTurned'] = true;
    out.push({ id: 'fansTurned' });
  }
  if (rel.fans > 60 && flags['fansTurned']) {
    flags['fansTurned'] = false;
    out.push({ id: 'fansBehindYou' });
  }

  if (rel.board < 22 && !flags['boardWarning']) {
    flags['boardWarning'] = true;
    out.push({ id: 'boardWarning' });
  }
  if (rel.board > 45) flags['boardWarning'] = false;

  return out;
}

/** True while the manager is deliberately leaving him out. */
export function isFrozenOut(state: CareerState): boolean {
  const absoluteWeek = state.world.season * 52 + state.world.week;
  return absoluteWeek < Number(state.flags['benchedUntilWeek'] ?? 0);
}

// ---------------------------------------------------------------- player actions

export type PlayerActionId =
  | 'askManagerTrust'
  | 'askManagerFeedback'
  | 'apologiseManager'
  | 'acceptBenchRole'
  | 'demandPlayingTime'
  | 'requestTransferTalk'
  | 'thankFans'
  | 'admitBadForm'
  | 'apologiseFans'
  | 'signAutographs'
  | 'teamDinner'
  | 'extraTrainingWithTeammates'
  | 'apologiseTeammates'
  | 'meetBoard'
  | 'praiseClubInMedia'
  | 'quietWeek';

export interface PlayerActionDef {
  id: PlayerActionId;
  category: 'manager' | 'fans' | 'teammates' | 'board' | 'personal';
  cost: number;                    // how much of the weekly social budget it uses
  riskKey?: 'risk.low' | 'risk.medium' | 'risk.high';
  /** Only offered when this returns true. */
  available: (state: CareerState) => boolean;
}

/**
 * How long before he can do it again.
 *
 * Asking the manager for a run of games is a conversation you have once and then live
 * with; apologising twice in a fortnight is not an apology. Without this the whole
 * screen is a button you press twenty times to farm relationship points, which is not
 * a game, it is a spreadsheet with a bug.
 */
const ACTION_COOLDOWN_WEEKS: Partial<Record<PlayerActionId, number>> = {
  askManagerTrust: 16,
  askManagerFeedback: 8,
  apologiseManager: 12,
  acceptBenchRole: 20,
  demandPlayingTime: 20,
  requestTransferTalk: 24,
  thankFans: 8,
  admitBadForm: 14,
  apologiseFans: 12,
  signAutographs: 6,
  teamDinner: 12,
  extraTrainingWithTeammates: 8,
  apologiseTeammates: 12,
  meetBoard: 24,
  praiseClubInMedia: 10,
  quietWeek: 4,
};

const DEFAULT_COOLDOWN_WEEKS = 10;

function absoluteWeek(state: CareerState): number {
  return state.world.season * 52 + state.world.week;
}

/** True when he has done this recently enough that doing it again would be noise. */
export function actionOnCooldown(state: CareerState, id: PlayerActionId): boolean {
  const until = state.actionCooldowns?.[id];
  return until !== undefined && absoluteWeek(state) < until;
}

/** Weeks until he can do it again, for the screen to show. */
export function actionCooldownLeft(state: CareerState, id: PlayerActionId): number {
  const until = state.actionCooldowns?.[id];
  if (until === undefined) return 0;
  return Math.max(0, until - absoluteWeek(state));
}

const hasClub = (state: CareerState) => state.player.clubId !== null;

export const PLAYER_ACTIONS: PlayerActionDef[] = [
  {
    id: 'askManagerTrust',
    category: 'manager',
    cost: 1,
    riskKey: 'risk.medium',
    available: (s) => hasClub(s) && s.player.squadRole !== 'academy',
  },
  { id: 'askManagerFeedback', category: 'manager', cost: 1, riskKey: 'risk.low', available: hasClub },
  {
    id: 'apologiseManager',
    category: 'manager',
    cost: 1,
    riskKey: 'risk.low',
    available: (s) => hasClub(s) && (s.relationships.manager < 45 || Boolean(s.flags['incidentWithManager'])),
  },
  {
    id: 'acceptBenchRole',
    category: 'manager',
    cost: 1,
    riskKey: 'risk.low',
    available: (s) => hasClub(s) && s.relationships.manager < 55,
  },
  {
    id: 'demandPlayingTime',
    category: 'manager',
    cost: 1,
    riskKey: 'risk.high',
    available: (s) => hasClub(s) && s.player.squadRole !== 'academy',
  },
  {
    id: 'requestTransferTalk',
    category: 'board',
    cost: 2,
    riskKey: 'risk.high',
    available: (s) => hasClub(s) && s.player.squadRole !== 'academy',
  },
  { id: 'thankFans', category: 'fans', cost: 1, riskKey: 'risk.low', available: hasClub },
  {
    id: 'admitBadForm',
    category: 'fans',
    cost: 1,
    riskKey: 'risk.low',
    available: (s) => s.player.form < 45,
  },
  {
    id: 'apologiseFans',
    category: 'fans',
    cost: 1,
    riskKey: 'risk.low',
    available: (s) => s.relationships.fans < 45 || Boolean(s.flags['incidentWithFans']),
  },
  { id: 'signAutographs', category: 'fans', cost: 1, riskKey: 'risk.low', available: hasClub },
  { id: 'teamDinner', category: 'teammates', cost: 2, riskKey: 'risk.low', available: hasClub },
  { id: 'extraTrainingWithTeammates', category: 'teammates', cost: 1, riskKey: 'risk.low', available: hasClub },
  {
    id: 'apologiseTeammates',
    category: 'teammates',
    cost: 1,
    riskKey: 'risk.low',
    available: (s) => s.relationships.teammates < 45 || Boolean(s.flags['dressingRoomFallout']),
  },
  {
    id: 'meetBoard',
    category: 'board',
    cost: 2,
    riskKey: 'risk.medium',
    available: (s) => hasClub(s) && s.player.squadRole !== 'academy',
  },
  { id: 'praiseClubInMedia', category: 'board', cost: 1, riskKey: 'risk.low', available: hasClub },
  { id: 'quietWeek', category: 'personal', cost: 1, riskKey: 'risk.low', available: () => true },
];

export function availableActions(state: CareerState): PlayerActionDef[] {
  if (state.retired) return [];
  const left = state.socialActions.perWeek - state.socialActions.used;
  return PLAYER_ACTIONS.filter(
    (action) => action.available(state) && action.cost <= left && !actionOnCooldown(state, action.id),
  );
}

/**
 * Carry out a conversation or a gesture. Outcomes lean on personality and on how
 * the person already feels about him, so the same words land differently over time.
 */
export function performAction(rng: Rng, state: CareerState, id: PlayerActionId): DecisionResult {
  const def = PLAYER_ACTIONS.find((a) => a.id === id);
  const changes: AppliedChange[] = [];
  const consequences: ConsequenceOutcome[] = [];
  if (!def || !def.available(state) || actionOnCooldown(state, id)) return { changes, consequences };

  const player = state.player;
  const rel = state.relationships;
  const charisma = (player.attributes.leadership + player.personality.professionalism) / 2;
  const swing = (base: number) => base * (0.7 + charisma / 160) * rng.range(0.75, 1.25);
  const moraleBefore = player.morale;
  const formBefore = player.form;
  let narrativeKey = `action.${id}.result`;

  switch (id) {
    case 'askManagerTrust': {
      // Asking for a run of games works when he is playing well, and grates when he is not.
      const merit = (player.form - 50) / 12 + (rel.manager - 45) / 14;
      if (merit + rng.gauss(0, 1.2) > 0) {
        adjustRelationship(state, 'manager', swing(6), changes);
        player.morale = clamp(player.morale + 5, 0, 100);
        narrativeKey = `action.${id}.good`;
      } else {
        adjustRelationship(state, 'manager', -swing(5), changes);
        player.morale = clamp(player.morale - 4, 0, 100);
        narrativeKey = `action.${id}.bad`;
      }
      break;
    }
    case 'askManagerFeedback': {
      adjustRelationship(state, 'manager', swing(3), changes);
      const focus = rng.pick(['decisions', 'positioning', 'composure', 'workRate'] as const);
      const before = player.attributes[focus];
      player.attributes[focus] = clamp(before + rng.range(0.4, 1.2), 1, 99);
      track(changes, `change.attr.${focus}`, before, player.attributes[focus]);
      narrativeKey = `action.${id}.good`;
      break;
    }
    case 'apologiseManager': {
      const accepted = rng.chance(clamp(0.45 + rel.manager / 200 + player.personality.professionalism / 300, 0.25, 0.9));
      if (accepted) {
        adjustRelationship(state, 'manager', swing(9), changes);
        state.flags['incidentWithManager'] = false;
        consequences.push({ id: 'apologyAccepted' });
        narrativeKey = `action.${id}.good`;
      } else {
        adjustRelationship(state, 'manager', swing(2), changes);
        consequences.push({ id: 'apologyRejected' });
        narrativeKey = `action.${id}.bad`;
      }
      break;
    }
    case 'acceptBenchRole': {
      adjustRelationship(state, 'manager', swing(7), changes);
      adjustRelationship(state, 'teammates', swing(3), changes);
      player.morale = clamp(player.morale - 6, 0, 100);
      narrativeKey = `action.${id}.good`;
      break;
    }
    case 'demandPlayingTime': {
      const listened = rng.chance(clamp(0.25 + (player.reputation - 40) / 130 + (rel.manager - 45) / 160, 0.05, 0.7));
      if (listened) {
        adjustRelationship(state, 'manager', swing(4), changes);
        player.morale = clamp(player.morale + 8, 0, 100);
        narrativeKey = `action.${id}.good`;
      } else {
        adjustRelationship(state, 'manager', -swing(12), changes);
        adjustRelationship(state, 'board', -swing(4), changes);
        player.morale = clamp(player.morale + 3, 0, 100);
        state.flags['incidentWithManager'] = true;
        narrativeKey = `action.${id}.bad`;
      }
      break;
    }
    case 'requestTransferTalk': {
      state.flags['transferRequested'] = true;
      adjustRelationship(state, 'board', -swing(10), changes);
      adjustRelationship(state, 'fans', -swing(8), changes);
      adjustRelationship(state, 'manager', -swing(6), changes);
      narrativeKey = `action.${id}.result`;
      break;
    }
    case 'thankFans': {
      adjustRelationship(state, 'fans', swing(6), changes);
      player.fame = clamp(player.fame + 1, 0, 100);
      narrativeKey = `action.${id}.good`;
      break;
    }
    case 'admitBadForm': {
      adjustRelationship(state, 'fans', swing(8), changes);
      adjustRelationship(state, 'media', swing(4), changes);
      player.morale = clamp(player.morale + 3, 0, 100);
      // Owning it publicly settles the head: a small confidence bump.
      const before = player.attributes.composure;
      player.attributes.composure = clamp(before + rng.range(0.3, 0.9), 1, 99);
      track(changes, 'change.attr.composure', before, player.attributes.composure);
      narrativeKey = `action.${id}.good`;
      break;
    }
    case 'apologiseFans': {
      const accepted = rng.chance(clamp(0.5 + rel.fans / 200, 0.3, 0.9));
      adjustRelationship(state, 'fans', accepted ? swing(11) : swing(3), changes);
      state.flags['incidentWithFans'] = false;
      consequences.push({ id: accepted ? 'apologyAccepted' : 'apologyRejected' });
      narrativeKey = accepted ? `action.${id}.good` : `action.${id}.bad`;
      break;
    }
    case 'signAutographs': {
      adjustRelationship(state, 'fans', swing(4), changes);
      player.fame = clamp(player.fame + 1.5, 0, 100);
      player.condition.fatigue = clamp(player.condition.fatigue + 2, 0, 100);
      narrativeKey = `action.${id}.good`;
      break;
    }
    case 'teamDinner': {
      adjustRelationship(state, 'teammates', swing(10), changes);
      player.morale = clamp(player.morale + 5, 0, 100);
      player.condition.fatigue = clamp(player.condition.fatigue + 6, 0, 100);
      state.finances.balance -= 4000;
      narrativeKey = `action.${id}.good`;
      break;
    }
    case 'extraTrainingWithTeammates': {
      adjustRelationship(state, 'teammates', swing(5), changes);
      adjustRelationship(state, 'manager', swing(3), changes);
      player.condition.fatigue = clamp(player.condition.fatigue + 7, 0, 100);
      const before = player.condition.sharpness;
      player.condition.sharpness = clamp(before + 6, 0, 100);
      track(changes, 'change.sharpness', before, player.condition.sharpness);
      narrativeKey = `action.${id}.good`;
      break;
    }
    case 'apologiseTeammates': {
      const accepted = rng.chance(clamp(0.55 + rel.teammates / 220, 0.3, 0.92));
      adjustRelationship(state, 'teammates', accepted ? swing(12) : swing(4), changes);
      if (accepted) state.flags['dressingRoomFallout'] = false;
      consequences.push({ id: accepted ? 'apologyAccepted' : 'apologyRejected' });
      narrativeKey = accepted ? `action.${id}.good` : `action.${id}.bad`;
      break;
    }
    case 'meetBoard': {
      const persuaded = rng.chance(clamp(0.35 + (player.reputation - 45) / 140, 0.1, 0.8));
      adjustRelationship(state, 'board', persuaded ? swing(9) : -swing(4), changes);
      if (persuaded && state.flags['transferListed']) {
        state.flags['transferListed'] = false;
        consequences.push({ id: 'offTransferList' });
      }
      narrativeKey = persuaded ? `action.${id}.good` : `action.${id}.bad`;
      break;
    }
    case 'praiseClubInMedia': {
      adjustRelationship(state, 'board', swing(5), changes);
      adjustRelationship(state, 'fans', swing(4), changes);
      adjustRelationship(state, 'media', swing(3), changes);
      narrativeKey = `action.${id}.good`;
      break;
    }
    case 'quietWeek': {
      player.condition.fatigue = clamp(player.condition.fatigue - 10, 0, 100);
      player.morale = clamp(player.morale + 2, 0, 100);
      narrativeKey = `action.${id}.good`;
      break;
    }
  }

  track(changes, 'change.morale', moraleBefore, player.morale);
  track(changes, 'change.form', formBefore, player.form);

  state.socialActions.used += def.cost;
  // And that is that for a while.
  state.actionCooldowns = state.actionCooldowns ?? {};
  state.actionCooldowns[id] = absoluteWeek(state) + (ACTION_COOLDOWN_WEEKS[id] ?? DEFAULT_COOLDOWN_WEEKS);
  consequences.push(...evaluateConsequences(rng, state));

  return { changes, consequences, narrativeKey };
}

/**
 * Weekly drift. Relationships sag when the player is not contributing and recover
 * when he is, so standing is something he keeps earning rather than a one-off score.
 */
export function driftRelationships(
  rng: Rng,
  state: CareerState,
  context: { minutesPct: number; recentRating: number | null; played: boolean },
): void {
  const performance = context.recentRating === null ? 0 : context.recentRating - 6.6;
  const minutes = context.minutesPct;
  const ovr = overall(state.player.attributes, state.player.primaryPos, state.player.secondaryPos);

  // Pulls are small and mean-reverting: standing has to be re-earned constantly, and
  // nobody ends up permanently pinned at 0 or 100 after a long career.
  const pulls: Record<RelationshipKey, number> = {
    manager: performance * 0.7 + (minutes - 0.35) * 1.0,
    fans: performance * 0.8 + (state.player.fame - 45) / 130 + (minutes - 0.3) * 0.6,
    teammates: (state.player.personality.professionalism - 50) / 90 + performance * 0.3,
    board: (minutes - 0.4) * 0.8 + (ovr - 62) / 120,
    media: performance * 0.5 + (state.player.fame - 45) / 120,
  };

  for (const key of Object.keys(pulls) as RelationshipKey[]) {
    const current = state.relationships[key];
    const reversion = (52 - current) * 0.035;
    const delta = clamp(pulls[key] + reversion + rng.gauss(0, 0.2), -1.6, 1.6);
    adjustRelationship(state, key, delta);
  }
}
