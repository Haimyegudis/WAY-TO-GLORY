import { Rng } from './rng.js';
import { emptyRow } from './league.js';
import type { Club, Fixture, LeagueTableRow } from './types.js';

/**
 * The European nights.
 *
 * Three competitions, entered by where a club finished at home: the Champions League,
 * the Europa League and the Conference League. Each runs eight groups of four, six
 * matchdays, then two-legged knockouts to a one-off final - the shape a player who
 * follows football expects, and the reason a season in the Championship feels
 * different from a season with a Tuesday night in Madrid in it.
 */

export type EuroTier = 'ucl' | 'uel' | 'uecl';
export const EURO_TIERS: EuroTier[] = ['ucl', 'uel', 'uecl'];

/** Midweeks, kept clear of the domestic cup rounds (7, 12, 17, 22, 29, 35, 40, 44). */
const GROUP_WEEKS = [5, 9, 13, 19, 24, 28];
const KNOCKOUT_WEEKS: Record<EuroKnockoutStage, number[]> = {
  r16: [31, 33],
  qf: [36, 38],
  sf: [41, 43],
  final: [46],
};

export type EuroKnockoutStage = 'r16' | 'qf' | 'sf' | 'final';
export type EuroStage = 'group' | EuroKnockoutStage | 'done';

export interface EuroGroup {
  letter: string;
  clubIds: string[];
  table: Record<string, LeagueTableRow>;
}

export interface EuroTie {
  stage: EuroKnockoutStage;
  leg: 1 | 2;
  week: number;
  homeClubId: string;
  awayClubId: string;
  played: boolean;
  result?: [number, number];
}

export interface EuroState {
  id: EuroTier;
  season: number;
  groups: EuroGroup[];
  fixtures: Fixture[];
  ties: EuroTie[];
  stage: EuroStage;
  /** Clubs still in it, in bracket order. */
  alive: string[];
  winner?: string;
}

/** Reputation a competition lends a club that plays in it, used for the money and the fame. */
export const EURO_PRESTIGE: Record<EuroTier, number> = { ucl: 96, uel: 78, uecl: 62 };

const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/**
 * Seeds a competition from the clubs that qualified. Anything short of 32 is padded
 * by playing fewer groups rather than inventing clubs - small nations do not always
 * fill a bracket in a game with thirteen countries in it.
 */
export function createEuroCompetition(rng: Rng, id: EuroTier, clubIds: string[], season: number): EuroState | null {
  const entrants = rng.shuffle(clubIds.slice());
  const groupCount = Math.min(8, Math.floor(entrants.length / 4));
  if (groupCount < 2) return null;

  const groups: EuroGroup[] = [];
  for (let g = 0; g < groupCount; g++) {
    const members = entrants.slice(g * 4, g * 4 + 4);
    const table: Record<string, LeagueTableRow> = {};
    for (const clubId of members) table[clubId] = emptyRow(clubId);
    groups.push({ letter: GROUP_LETTERS[g]!, clubIds: members, table });
  }

  const fixtures: Fixture[] = [];
  for (const group of groups) {
    const [a, b, c, d] = group.clubIds as [string, string, string, string];
    // A four-team double round robin: three pairings, home and away.
    const pairings: [string, string][][] = [
      [[a, b], [c, d]],
      [[a, c], [d, b]],
      [[a, d], [b, c]],
    ];
    pairings.forEach((round, i) => {
      for (const [home, away] of round) {
        fixtures.push({ round: i + 1, week: GROUP_WEEKS[i]!, homeClubId: home, awayClubId: away, played: false });
        fixtures.push({ round: i + 4, week: GROUP_WEEKS[i + 3]!, homeClubId: away, awayClubId: home, played: false });
      }
    });
  }

  return { id, season, groups, fixtures, ties: [], stage: 'group', alive: [] };
}

function sortGroup(group: EuroGroup): LeagueTableRow[] {
  return Object.values(group.table).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });
}

export function applyEuroResult(state: EuroState, homeClubId: string, awayClubId: string, hg: number, ag: number): void {
  const group = state.groups.find((g) => g.clubIds.includes(homeClubId) && g.clubIds.includes(awayClubId));
  if (!group) return;
  const home = group.table[homeClubId];
  const away = group.table[awayClubId];
  if (!home || !away) return;

  home.played++; away.played++;
  home.goalsFor += hg; home.goalsAgainst += ag;
  away.goalsFor += ag; away.goalsAgainst += hg;
  if (hg > ag) { home.won++; away.lost++; home.points += 3; }
  else if (hg < ag) { away.won++; home.lost++; away.points += 3; }
  else { home.drawn++; away.drawn++; home.points++; away.points++; }
}

/** Who goes through: the top two of every group, seeded winners against runners-up. */
export function qualifiersFromGroups(state: EuroState): string[] {
  const winners: string[] = [];
  const runnersUp: string[] = [];
  for (const group of state.groups) {
    const sorted = sortGroup(group);
    if (sorted[0]) winners.push(sorted[0].clubId);
    if (sorted[1]) runnersUp.push(sorted[1].clubId);
  }
  const bracket: string[] = [];
  for (let i = 0; i < winners.length; i++) {
    bracket.push(winners[i]!);
    // Pair a group winner with a runner-up from a different group.
    bracket.push(runnersUp[(i + 1) % runnersUp.length]!);
  }
  return bracket.filter(Boolean);
}

const NEXT_STAGE: Record<EuroKnockoutStage, EuroKnockoutStage | 'done'> = {
  r16: 'qf', qf: 'sf', sf: 'final', final: 'done',
};

function stageForCount(count: number): EuroKnockoutStage {
  if (count > 8) return 'r16';
  if (count > 4) return 'qf';
  if (count > 2) return 'sf';
  return 'final';
}

/** Draws the next knockout round for whoever is left. */
export function drawEuroRound(rng: Rng, state: EuroState): void {
  const alive = state.alive.slice();
  if (alive.length < 2) {
    state.stage = 'done';
    state.winner = alive[0];
    return;
  }

  const stage = stageForCount(alive.length);
  state.stage = stage;
  const weeks = KNOCKOUT_WEEKS[stage];
  const pairs: [string, string][] = [];
  const pool = stage === 'r16' ? alive : rng.shuffle(alive);
  for (let i = 0; i + 1 < pool.length; i += 2) pairs.push([pool[i]!, pool[i + 1]!]);

  for (const [a, b] of pairs) {
    if (stage === 'final') {
      state.ties.push({ stage, leg: 1, week: weeks[0]!, homeClubId: a, awayClubId: b, played: false });
    } else {
      state.ties.push({ stage, leg: 1, week: weeks[0]!, homeClubId: b, awayClubId: a, played: false });
      state.ties.push({ stage, leg: 2, week: weeks[1]!, homeClubId: a, awayClubId: b, played: false });
    }
  }
}

/**
 * Settles a round once every tie in it has been played: aggregate over two legs, and
 * a coin toss standing in for extra time and penalties when the aggregate is level.
 */
export function resolveEuroRound(rng: Rng, state: EuroState): void {
  if (state.stage === 'group' || state.stage === 'done') return;
  const stage = state.stage;
  const ties = state.ties.filter((t) => t.stage === stage);
  if (ties.length === 0 || !ties.every((t) => t.played)) return;

  const survivors: string[] = [];
  if (stage === 'final') {
    const final = ties[0]!;
    const [hg, ag] = final.result ?? [0, 0];
    const winner = hg === ag ? (rng.chance(0.5) ? final.homeClubId : final.awayClubId) : hg > ag ? final.homeClubId : final.awayClubId;
    state.winner = winner;
    state.alive = [winner];
    state.stage = 'done';
    return;
  }

  const seen = new Set<string>();
  for (const first of ties.filter((t) => t.leg === 1)) {
    const pairKey = [first.homeClubId, first.awayClubId].sort().join('|');
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);
    const second = ties.find(
      (t) => t.leg === 2 && [t.homeClubId, t.awayClubId].sort().join('|') === pairKey,
    );
    const [h1, a1] = first.result ?? [0, 0];
    const [h2, a2] = second?.result ?? [0, 0];
    // first: away side is the seeded club, second: it is at home.
    const seededTotal = a1 + h2;
    const otherTotal = h1 + a2;
    const seeded = first.awayClubId;
    const other = first.homeClubId;
    const winner =
      seededTotal === otherTotal ? (rng.chance(0.55) ? seeded : other) : seededTotal > otherTotal ? seeded : other;
    survivors.push(winner);
  }

  state.alive = survivors;
  const next = NEXT_STAGE[stage];
  if (next === 'done' || survivors.length < 2) {
    state.stage = 'done';
    state.winner = survivors[0];
    return;
  }
  drawEuroRound(rng, state);
}

/** True once the last group match has been played. */
export function groupStageComplete(state: EuroState): boolean {
  return state.stage === 'group' && state.fixtures.every((f) => f.played);
}

/**
 * The clubs that earned a place in Europe for next season, from a league's final
 * table plus the domestic cup winner, who takes a Europa League place.
 */
export function europeanQualifiers(
  order: string[],
  slots: { ucl?: number; uel?: number; uecl?: number } | undefined,
  cupWinner: string | null,
): Record<EuroTier, string[]> {
  const out: Record<EuroTier, string[]> = { ucl: [], uel: [], uecl: [] };
  if (!slots) return out;

  let cursor = 0;
  const take = (count: number): string[] => {
    const picked = order.slice(cursor, cursor + count).filter(Boolean);
    cursor += count;
    return picked;
  };

  out.ucl = take(slots.ucl ?? 0);
  out.uel = take(slots.uel ?? 0);
  out.uecl = take(slots.uecl ?? 0);

  // The cup winner goes into the Europa League unless he is already in Europe.
  if (cupWinner && !out.ucl.includes(cupWinner) && !out.uel.includes(cupWinner) && !out.uecl.includes(cupWinner)) {
    if ((slots.uel ?? 0) > 0) out.uel.push(cupWinner);
    else if ((slots.uecl ?? 0) > 0) out.uecl.push(cupWinner);
  }
  return out;
}

/** Prize money, which is most of the reason a smaller club wants a European run. */
export function euroPrize(tier: EuroTier, stage: EuroStage, champion: boolean): number {
  const base: Record<EuroTier, number> = { ucl: 18_000_000, uel: 5_000_000, uecl: 2_000_000 };
  const multiplier: Record<EuroStage, number> = {
    group: 1, r16: 1.5, qf: 2.1, sf: 2.9, final: 3.6, done: 3.6,
  };
  return Math.round(base[tier] * multiplier[stage] * (champion ? 1.35 : 1));
}

export function euroClubStrength(club: Club): number {
  return club.strength;
}
