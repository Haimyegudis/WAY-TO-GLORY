import { Rng, clamp } from './rng.js';
import { buildFixtures } from './league.js';
import { emptyRow } from './league.js';
import type { Club, CompetitionSeasonState, LeagueTableRow } from './types.js';

/**
 * The youth league.
 *
 * Before a footballer is a footballer he is a sixteen year old playing on a Sunday
 * morning in front of two coaches and somebody's father, and that is where a first
 * team place is won. The same clubs field youth sides, the fixtures run alongside the
 * senior season, and the only person whose matches are simulated in detail is the one
 * being played - everyone else's results exist so the table means something.
 *
 * From eighteen he cannot stay: either the club takes him up, or he finds one that
 * will play him.
 */

export const YOUTH_MIN_AGE = 14;
export const YOUTH_MAX_AGE = 18;

/** A youth side is a fraction of the senior club's level, and the gap narrows with age. */
export function youthClubRating(club: Club, age: number): number {
  const seniorLevel = 30 + club.strength * 0.62;
  const youthFactor = 0.62 + clamp((age - 14) / 8, 0, 0.16);
  return clamp(seniorLevel * youthFactor, 24, 68);
}

/**
 * Builds the youth season for a country's clubs: the same names, playing each other
 * home and away on the weeks the senior league is not using.
 */
export function createYouthSeason(
  rng: Rng,
  competitionId: string,
  clubIds: string[],
  season: number,
): CompetitionSeasonState | null {
  if (clubIds.length < 4) return null;
  const table: Record<string, LeagueTableRow> = {};
  for (const id of clubIds) table[id] = emptyRow(id);
  return {
    competitionId: `${competitionId}.youth`,
    season,
    clubIds: clubIds.slice(),
    table,
    fixtures: buildFixtures(rng, clubIds, 2),
    currentRound: 0,
    scorers: {},
    finished: false,
  };
}

export interface YouthForm {
  apps: number;
  goals: number;
  assists: number;
  ratingSum: number;
}

/**
 * How ready he looks for senior football, on a 0-1 scale. Minutes alone are not enough
 * - a sixteen year old who plays every week and does nothing is not ready - so this
 * reads the rating first and the numbers second.
 */
export function readiness(form: YouthForm, age: number, ovr: number, clubLevel: number): number {
  if (form.apps < 4) return 0;
  const rating = form.ratingSum / form.apps;
  const performance = clamp((rating - 6.4) / 1.6, 0, 1);
  const output = clamp((form.goals + form.assists * 0.6) / Math.max(6, form.apps * 0.5), 0, 1);
  const ability = clamp((ovr - (clubLevel - 16)) / 16, 0, 1);
  const maturity = clamp((age - 15) / 3, 0, 1);
  return clamp(performance * 0.4 + output * 0.2 + ability * 0.3 + maturity * 0.1, 0, 1);
}

/** True when the first team should be having a look at him. */
export function deservesCallUp(rng: Rng, form: YouthForm, age: number, ovr: number, clubLevel: number): boolean {
  const score = readiness(form, age, ovr, clubLevel);
  if (score < 0.45) return false;
  // Even a ready player waits for the manager to have a reason; the better he is, the
  // shorter the wait.
  return rng.chance(clamp((score - 0.4) * 1.4, 0.05, 0.85));
}
