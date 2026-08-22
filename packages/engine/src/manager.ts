/**
 * The man who picks the team.
 *
 * There was never one. Manager trust was a number that belonged to the club: it carried
 * from August to May, from one season to the next, and straight through a sacking, so
 * the oldest story in football - a new man walks in and does not fancy you - could not
 * happen. Two events in the pack said a manager had been sacked and neither of them
 * changed anything about who was picking the side on Saturday.
 *
 * A manager here is three things: a name, a length of service, and a way of seeing
 * players. When one arrives he brings his own opinion of the player he has inherited,
 * and most of what the last man thought is gone. That opinion is not random - a coach
 * who builds sides around young players looks at a nineteen year old differently from
 * one who has been given eighteen months to stay up - but it is his, not the last
 * man's, and it has to be earned again.
 */
import { Rng, clamp } from './rng.js';
import { pickName } from './generate.js';
import type { PackIndex } from './data.js';
import type { CareerState, Club, Manager, ManagerStyle, Player, SquadRole } from './types.js';

const STYLES: ManagerStyle[] = ['trusting', 'demanding', 'youthBuilder', 'pragmatist'];

/** How much of what the last man thought survives him. Not much. */
const INHERITED_TRUST = 0.3;

/** Where a role sits in a manager's head before he has seen the player kick a ball. */
const ROLE_STANDING: Record<SquadRole, number> = {
  academy: -6,
  futureProspect: -4,
  prospect: -1,
  fringe: -8,
  bench: -4,
  rotation: 0,
  starter: 5,
  important: 9,
  key: 13,
  star: 17,
};

export function generateManager(rng: Rng, index: PackIndex, club: Club, season: number): Manager {
  const pool = index.namesByLocale.get(index.countryByCode.get(club.country)?.nameLocale ?? 'en')
    ?? index.namesByLocale.get('en')!;
  const { firstName, lastName } = pickName(rng, pool);
  return {
    name: `${firstName} ${lastName}`,
    style: rng.pick(STYLES),
    since: season,
    clubId: club.id,
  };
}

/**
 * What the new man makes of him on day one.
 *
 * Reputation and the shirt he was wearing when the manager walked in are all there is to
 * go on, coloured by the kind of coach he is: one who builds around young players starts
 * a twenty year old higher than a pragmatist does, and a demanding one starts everybody
 * lower and makes them earn it.
 */
export function openingTrust(manager: Manager, player: Player, role: SquadRole, age: number, rng: Rng): number {
  const young = age <= 21;
  const base =
    manager.style === 'trusting' ? 52
    : manager.style === 'demanding' ? 38
    : manager.style === 'youthBuilder' ? (young ? 56 : 42)
    : 45;
  const standing = (player.reputation - 40) * 0.22 + (ROLE_STANDING[role] ?? 0);
  return clamp(base + standing + rng.int(-6, 7), 12, 88);
}

/**
 * A change in the dugout. The trust the player had built is mostly gone - a little of it
 * survives as a reputation inside the building - and what replaces it is the new man's
 * own reading of him.
 */
export function appointManager(
  rng: Rng,
  state: CareerState,
  index: PackIndex,
  club: Club,
): Manager {
  const manager = generateManager(rng, index, club, state.world.season);
  const age = state.world.season - state.player.birthYear;
  const fresh = openingTrust(manager, state.player, state.player.squadRole, age, rng);
  state.manager = manager;
  state.managerTrust = clamp(state.managerTrust * INHERITED_TRUST + fresh * (1 - INHERITED_TRUST), 0, 100);
  state.relationships.manager = state.managerTrust;
  // Whatever the last man thought of him, in either direction, is not this man's view.
  state.flags['incidentWithManager'] = false;
  state.flags['droppedNotified'] = false;
  state.flags['benchedUntilWeek'] = 0;
  return manager;
}

/**
 * Whether the club has seen enough of him.
 *
 * A season going badly is the whole of it: a board that is unhappy and a table that
 * agrees. Nobody is sacked in August, and a manager who has just arrived is given until
 * Christmas whatever happens.
 */
export function sackingChance(input: {
  weeksInCharge: number;
  seasonWeek: number;
  /** Where the club sits, 0 is top of the table and 1 is bottom. */
  tablePlace: number | null;
  /** Where the money says it belongs, on the same scale. */
  expectedPlace: number | null;
  boardMood: number;
}): number {
  if (input.weeksInCharge < 18 || input.seasonWeek < 14) return 0;
  if (input.tablePlace === null || input.expectedPlace === null) return 0;
  const underperformance = input.tablePlace - input.expectedPlace;
  if (underperformance <= 0.12) return 0;
  const pressure = clamp(underperformance * 1.6, 0, 1);
  const boardPatience = clamp((input.boardMood - 30) / 90, 0, 1);
  return clamp(0.012 * pressure * (1.5 - boardPatience), 0, 0.06);
}
