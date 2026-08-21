import { Rng } from './rng.js';
import type { Club } from './types.js';

/** Weeks the cup rounds are played on. Later rounds sit in the second half of the season. */
export const CUP_ROUND_WEEKS = [7, 12, 17, 22, 29, 35, 40, 44];

export interface CupTie {
  round: number;
  week: number;
  homeClubId: string;
  awayClubId: string;
  played: boolean;
  result?: [number, number];
  winner?: string;
}

export interface CupState {
  id: string;
  country: string;
  season: number;
  ties: CupTie[];
  /** Clubs still alive, by round. */
  alive: string[];
  round: number;
  finished: boolean;
  winner?: string;
  roundWeeks?: number[];
}

/** Everyone in the country enters; the bracket is padded with byes to a power of two. */
export function createCup(
  rng: Rng,
  country: string,
  clubs: Club[],
  season: number,
  roundWeeks: number[] = CUP_ROUND_WEEKS,
): CupState {
  const entrants = rng.shuffle(clubs.map((c) => c.id));
  return {
    id: `${country.toLowerCase()}_cup`,
    country,
    season,
    ties: [],
    alive: entrants,
    round: 0,
    finished: false,
    roundWeeks,
  };
}

export function drawRound(rng: Rng, cup: CupState): CupTie[] {
  if (cup.finished || cup.alive.length < 2) return [];
  const schedule = cup.roundWeeks ?? CUP_ROUND_WEEKS;
  const weekIndex = Math.min(cup.round, schedule.length - 1);
  const week = schedule[weekIndex]!;
  const shuffled = rng.shuffle(cup.alive);
  const ties: CupTie[] = [];

  // Odd team out gets a bye into the next round.
  const byes: string[] = [];
  if (shuffled.length % 2 === 1) byes.push(shuffled.pop()!);

  for (let i = 0; i < shuffled.length; i += 2) {
    ties.push({
      round: cup.round + 1,
      week,
      homeClubId: shuffled[i]!,
      awayClubId: shuffled[i + 1]!,
      played: false,
    });
  }

  cup.ties.push(...ties);
  cup.alive = byes;
  cup.round += 1;
  return ties;
}

export function recordTieResult(cup: CupState, tie: CupTie, homeGoals: number, awayGoals: number, rng: Rng): string {
  tie.played = true;
  tie.result = [homeGoals, awayGoals];
  const winner =
    homeGoals > awayGoals ? tie.homeClubId
    : awayGoals > homeGoals ? tie.awayClubId
    : rng.chance(0.55) ? tie.homeClubId : tie.awayClubId;   // extra time / penalties, home edge
  tie.winner = winner;
  cup.alive.push(winner);
  if (cup.alive.length === 1 && cup.ties.every((t) => t.played)) {
    cup.finished = true;
    cup.winner = winner;
  }
  return winner;
}

export function isCupFinal(cup: CupState, tie: CupTie): boolean {
  const roundTies = cup.ties.filter((t) => t.round === tie.round);
  return roundTies.length === 1;
}

export function isCupSemi(cup: CupState, tie: CupTie): boolean {
  const roundTies = cup.ties.filter((t) => t.round === tie.round);
  return roundTies.length === 2;
}
