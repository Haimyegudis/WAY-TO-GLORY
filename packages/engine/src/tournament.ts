import { Rng, clamp } from './rng.js';
import { simulateInternationalMatch } from './national.js';
import type { Player } from './types.js';
import type { PackIndex } from './data.js';

/**
 * The summer tournaments.
 *
 * A career is measured in club seasons, but the moments people remember are the ones
 * played in June: a World Cup every four years, a European Championship in between.
 * The tournament is run at the end of the season for the player's national side - a
 * group of three, then knockouts - and every match he plays counts as a cap.
 */

export type TournamentId = 'worldCup' | 'euro';
export type TournamentStage = 'group' | 'r16' | 'qf' | 'sf' | 'final' | 'thirdPlace';

export interface TournamentMatch {
  stage: TournamentStage;
  opponent: string;              // country code
  goalsFor: number;
  goalsAgainst: number;
  played: boolean;
  userPlayed: boolean;
  userGoals: number;
  userRating: number;
}

export interface TournamentResult {
  id: TournamentId;
  season: number;
  countryCode: string;
  matches: TournamentMatch[];
  /** How far the nation went: 'winner', 'final', 'sf', 'qf', 'r16', 'group'. */
  finish: 'winner' | 'final' | 'sf' | 'qf' | 'r16' | 'group';
  caps: number;
  goals: number;
  averageRating: number;
}

/** A World Cup every four years from 2026, a Euro in the even years between. */
export function tournamentFor(season: number): TournamentId | null {
  const year = season + 1;                 // season 2025 finishes in the summer of 2026
  if (year % 4 === 2) return 'worldCup';
  if (year % 2 === 0) return 'euro';
  return null;
}

/** Only European nations play a Euro; everyone plays a World Cup. */
export function nationEligible(id: TournamentId, countryCode: string, index: PackIndex): boolean {
  const country = index.countryByCode.get(countryCode);
  if (!country) return false;
  if (id === 'worldCup') return true;
  // Anything without a confederation on it predates the Americas and is European.
  return (country.confederation ?? 'UEFA') === 'UEFA';
}

const KNOCKOUT_ORDER: ('r16' | 'qf' | 'sf' | 'final')[] = ['r16', 'qf', 'sf', 'final'];

/**
 * Runs the tournament from the player's point of view: does his country get out of
 * the group, how far does it go, and what did he do in the matches he played.
 */
export function playTournament(
  rng: Rng,
  id: TournamentId,
  player: Player,
  countryCode: string,
  countryReputation: number,
  season: number,
  minutesShare: number,
  index?: PackIndex,
): TournamentResult {
  const matches: TournamentMatch[] = [];
  let caps = 0;
  let goals = 0;
  let ratingSum = 0;

  /*
   * Who he could be drawn against.
   *
   * A Euro is Europe; a World Cup is everybody, which is the point of it. Falling back
   * to the European list keeps old saves and tests working where no pack was handed in.
   */
  const fromPack = index
    ? [...index.countryByCode.values()]
        .filter((c) => (id === 'worldCup' ? true : (c.confederation ?? 'UEFA') === 'UEFA'))
        .map((c) => c.code)
    : [];
  const opponents = fromPack.length >= 6
    ? fromPack
    : ['ESP', 'FRA', 'GER', 'ITA', 'ENG', 'POR', 'NED', 'BEL', 'TUR', 'GRE', 'SCO', 'ISR', 'AUT'];
  const drawOpponent = (): string => {
    const pool = opponents.filter((c) => c !== countryCode);
    return pool[rng.int(0, pool.length - 1)] ?? 'ESP';
  };

  const playMatch = (stage: TournamentStage): TournamentMatch => {
    const starts = rng.chance(clamp(minutesShare, 0.15, 0.95));
    const outcome = starts
      ? simulateInternationalMatch(rng, player, 'senior', countryReputation)
      : null;

    // The nation's result leans on its standing, with the usual tournament noise.
    const edge = (countryReputation - 70) / 26 + rng.gauss(0, 0.9);
    const goalsFor = Math.max(0, Math.round(1.2 + edge * 0.5 + rng.gauss(0, 0.8)));
    const goalsAgainst = Math.max(0, Math.round(1.2 - edge * 0.5 + rng.gauss(0, 0.8)));

    const match: TournamentMatch = {
      stage,
      opponent: drawOpponent(),
      goalsFor,
      goalsAgainst,
      played: true,
      userPlayed: starts,
      userGoals: outcome?.goals ?? 0,
      userRating: outcome?.rating ?? 0,
    };
    if (starts) {
      caps++;
      goals += match.userGoals;
      ratingSum += match.userRating;
    }
    matches.push(match);
    return match;
  };

  // Group of three.
  let points = 0;
  for (let i = 0; i < 3; i++) {
    const match = playMatch('group');
    if (match.goalsFor > match.goalsAgainst) points += 3;
    else if (match.goalsFor === match.goalsAgainst) points += 1;
  }

  let finish: TournamentResult['finish'] = 'group';
  const throughOdds = clamp(0.25 + points * 0.13 + (countryReputation - 70) / 120, 0.1, 0.92);
  if (rng.chance(throughOdds)) {
    for (const stage of KNOCKOUT_ORDER) {
      const match = playMatch(stage);
      const won =
        match.goalsFor === match.goalsAgainst
          ? rng.chance(clamp(0.5 + (countryReputation - 70) / 90, 0.2, 0.8))   // penalties
          : match.goalsFor > match.goalsAgainst;
      finish = stage;
      if (!won) break;
      if (stage === 'final') {
        finish = 'winner';
        break;
      }
    }
  }

  return {
    id,
    season,
    countryCode,
    matches,
    finish,
    caps,
    goals,
    averageRating: caps > 0 ? Math.round((ratingSum / caps) * 10) / 10 : 0,
  };
}

/** What the run is worth to the player's standing in the game. */
export function tournamentFame(result: TournamentResult): number {
  const base: Record<TournamentResult['finish'], number> = {
    winner: 22, final: 15, sf: 10, qf: 6, r16: 4, group: 2,
  };
  const weight = result.id === 'worldCup' ? 1 : 0.75;
  return Math.round((base[result.finish] + result.goals * 2.5) * weight);
}
