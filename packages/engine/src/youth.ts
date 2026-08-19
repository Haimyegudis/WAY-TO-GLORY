import { Rng, clamp } from './rng.js';
import { buildFixtures, emptyRow, sortedTable } from './league.js';
import type { PackIndex } from './data.js';
import type {
  CareerState,
  Club,
  CompetitionSeasonState,
  LeagueTableRow,
  Player,
  SeasonStats,
} from './types.js';

/**
 * The youth pyramid.
 *
 * Before a footballer is a footballer he is a sixteen year old playing on a Sunday
 * morning in front of two coaches and somebody's father, and that is where a first
 * team place is won.
 *
 * Every division in his country has a youth division shadowing it, and from the first
 * whistle the two come apart: a club can be in the top flight with its seniors and in
 * the second tier with its boys, because youth promotion and relegation are decided by
 * the youth table and nothing else. Only the division he is actually in is populated
 * with players - sixteen boys per club, aged fourteen to nineteen, who age, leave and
 * are replaced every summer - so the scoring chart he is trying to climb is a real one.
 * The rest of the pyramid keeps its tables without keeping its people.
 *
 * From nineteen he cannot stay: either the club takes him up, or he finds one that will
 * play him.
 */

export const YOUTH_MIN_AGE = 14;
export const YOUTH_MAX_AGE = 19;

/** Two up, two down, decided on the youth table alone. */
export const YOUTH_EXCHANGE = 2;

export interface YouthForm {
  apps: number;
  goals: number;
  assists: number;
  ratingSum: number;
  /**
   * Minutes played on Sunday mornings. Held separately because they land in the same
   * season record as the senior ones, and a boy playing ninety minutes a week for the
   * under-18s must not read as a first-team regular to everything that asks.
   */
  minutes: number;
}

export interface YouthWorld {
  /** One per senior division in his country, keyed by youth competition id. */
  competitions: Record<string, CompetitionSeasonState>;
  /** clubId -> youth competition id. Moves on youth results, not senior ones. */
  membership: Record<string, string>;
  /** Squads, only for the division the player himself is in. */
  squads: Record<string, string[]>;
  /** The boys themselves, kept apart from the senior world. */
  players: Record<string, Player>;
  /** This season's record for each of them. */
  stats: Record<string, SeasonStats>;
  /** What the player has done in it this season. */
  form: YouthForm;
  /** The division the player's own club is in, cached for the screens. */
  userCompetitionId: string | null;
}

export function youthCompetitionId(competitionId: string): string {
  return `${competitionId}.youth`;
}

export function seniorCompetitionId(youthId: string): string {
  return youthId.endsWith('.youth') ? youthId.slice(0, -'.youth'.length) : youthId;
}

export function emptyYouthForm(): YouthForm {
  return { apps: 0, goals: 0, assists: 0, ratingSum: 0, minutes: 0 };
}

/** A youth side is a fraction of the senior club's level, and the gap narrows with age. */
export function youthClubRating(club: Club, age: number): number {
  const seniorLevel = 30 + club.strength * 0.62;
  const youthFactor = 0.62 + clamp((age - 14) / 8, 0, 0.16);
  return clamp(seniorLevel * youthFactor, 24, 68);
}

/** Every league division in a country, strongest tier first. */
export function countryLeagues(index: PackIndex, country: string) {
  return index.pack.competitions
    .filter((c) => c.country === country && c.type === 'league')
    .sort((a, b) => a.tier - b.tier);
}

/**
 * Builds the pyramid: a youth division for every senior one, with the same clubs in it
 * to begin with. Nothing is populated with players here - that is done for one division
 * only, once we know which one he is in.
 */
export function createYouthWorld(rng: Rng, state: CareerState, index: PackIndex, country: string): YouthWorld {
  const leagues = countryLeagues(index, country);
  const world: YouthWorld = {
    competitions: {},
    membership: {},
    squads: {},
    players: {},
    stats: {},
    form: emptyYouthForm(),
    userCompetitionId: null,
  };

  for (const league of leagues) {
    const clubIds = Object.values(state.world.clubs)
      .filter((club) => club.competitionId === league.id)
      .map((club) => club.id);
    if (clubIds.length < 4) continue;
    const id = youthCompetitionId(league.id);
    for (const clubId of clubIds) world.membership[clubId] = id;
    world.competitions[id] = newYouthSeason(rng, id, clubIds, state.world.season);
  }

  return world;
}

/** A fresh table and fixture list for one youth division. */
export function newYouthSeason(
  rng: Rng,
  competitionId: string,
  clubIds: string[],
  season: number,
): CompetitionSeasonState {
  const table: Record<string, LeagueTableRow> = {};
  for (const id of clubIds) table[id] = emptyRow(id);
  return {
    competitionId,
    season,
    clubIds: clubIds.slice(),
    table,
    fixtures: buildFixtures(rng, clubIds, 2),
    currentRound: 0,
    scorers: {},
    assists: {},
    finished: false,
  };
}

/** The clubs in one youth division, read off the membership map. */
export function youthMembers(youth: YouthWorld, competitionId: string): string[] {
  return Object.entries(youth.membership)
    .filter(([, id]) => id === competitionId)
    .map(([clubId]) => clubId);
}

/** The youth division the player's own club plays in. */
export function userYouthCompetitionId(state: CareerState): string | null {
  const youth = state.world.youth;
  const clubId = state.player.clubId;
  if (!youth || !clubId) return null;
  return youth.membership[clubId] ?? null;
}

export function userYouthCompetition(state: CareerState): CompetitionSeasonState | null {
  const id = userYouthCompetitionId(state);
  if (!id) return null;
  return state.world.youth?.competitions[id] ?? null;
}

/** Where he stands in the scoring chart of his own division: 1 is top, 0 is nowhere. */
export function scoringRank(state: CareerState): number {
  const comp = userYouthCompetition(state);
  if (!comp) return 0;
  const goals = comp.scorers[state.player.id] ?? 0;
  if (goals === 0) return 0;
  const ahead = Object.values(comp.scorers).filter((g) => g > goals).length;
  return ahead + 1;
}

/** Where his club stands in the youth table, as a fraction: 0 is top, 1 is bottom. */
export function youthTablePosition(state: CareerState): number {
  const comp = userYouthCompetition(state);
  const clubId = state.player.clubId;
  if (!comp || !clubId) return 0.5;
  const rows = sortedTable(comp);
  const at = rows.findIndex((row) => row.clubId === clubId);
  if (at < 0 || rows.length < 2) return 0.5;
  return at / (rows.length - 1);
}

export interface ReadinessInput {
  form: YouthForm;
  age: number;
  ovr: number;
  clubLevel: number;
  /** Position in his division's scoring chart, or 0 when he is not on it. */
  scoringRank: number;
  /** How his club is doing, 0 top to 1 bottom - a good side flatters everybody in it. */
  tablePosition: number;
}

/**
 * How ready he looks for senior football, on a 0-1 scale.
 *
 * Minutes alone are not enough - a sixteen year old who plays every week and does
 * nothing is not ready - so this reads the rating first, what he produced second, and
 * where that puts him among everybody else his age third. A boy at the top of the
 * division's scoring chart is being watched by people whose job is to watch.
 */
export function readiness(input: ReadinessInput): number {
  const { form, age, ovr, clubLevel } = input;
  if (form.apps < 4) return 0;
  const rating = form.ratingSum / form.apps;
  const performance = clamp((rating - 6.4) / 1.6, 0, 1);
  const output = clamp((form.goals + form.assists * 0.6) / Math.max(6, form.apps * 0.5), 0, 1);
  const ability = clamp((ovr - (clubLevel - 16)) / 16, 0, 1);
  const maturity = clamp((age - 15) / 3, 0, 1);
  // Leading the chart is worth as much as a good rating; being twelfth is worth nothing.
  const chart = input.scoringRank > 0 ? clamp((6 - input.scoringRank) / 5, 0, 1) : 0;
  // Doing it in a struggling side counts for more than doing it in a runaway leader.
  const context = clamp(input.tablePosition * 0.3, 0, 0.3);

  return clamp(
    performance * 0.32 + output * 0.16 + ability * 0.24 + maturity * 0.08 + chart * 0.2 + context * 0.2,
    0,
    1,
  );
}

/** The chance a first team asks to have a look, expressed without rolling anything. */
export function deservesCallUpChance(input: ReadinessInput): number {
  const score = readiness(input);
  if (score < 0.42) return 0;
  // Even a ready player waits for the manager to have a reason; the better he is, the
  // shorter the wait.
  return clamp((score - 0.38) * 1.4, 0.05, 0.85);
}

/** True when the first team should be having a look at him. */
export function deservesCallUp(rng: Rng, input: ReadinessInput): boolean {
  const chance = deservesCallUpChance(input);
  return chance > 0 && rng.chance(chance);
}
