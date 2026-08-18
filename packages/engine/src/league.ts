import { Rng } from './rng.js';
import type {
  Club,
  Competition,
  CompetitionSeasonState,
  Fixture,
  LeagueTableRow,
} from './types.js';

export const WEEKS_PER_SEASON = 52;
export const FIRST_MATCH_WEEK = 4;
export const LAST_MATCH_WEEK = 46;

export function emptyRow(clubId: string): LeagueTableRow {
  return { clubId, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
}

/**
 * Circle-method round robin. Returns fixtures for `rounds` passes
 * (2 = home and away), with home/away flipped on the second pass.
 */
export function buildFixtures(rng: Rng, clubIds: string[], rounds: number): Fixture[] {
  const teams = rng.shuffle(clubIds);
  const hasBye = teams.length % 2 === 1;
  if (hasBye) teams.push('__BYE__');

  const n = teams.length;
  const half = n / 2;
  const roundsPerPass = n - 1;
  const fixtures: Fixture[] = [];

  const rotation = teams.slice();
  for (let r = 0; r < roundsPerPass; r++) {
    for (let i = 0; i < half; i++) {
      const home = rotation[i]!;
      const away = rotation[n - 1 - i]!;
      if (home === '__BYE__' || away === '__BYE__') continue;
      // Alternate home advantage so nobody plays every game at home in the first pass.
      const flip = (r + i) % 2 === 0;
      fixtures.push({
        round: r + 1,
        week: 0,
        homeClubId: flip ? home : away,
        awayClubId: flip ? away : home,
        played: false,
      });
    }
    const fixed = rotation[0]!;
    const rest = rotation.slice(1);
    rest.unshift(rest.pop()!);
    rotation.length = 0;
    rotation.push(fixed, ...rest);
  }

  const all: Fixture[] = [...fixtures];
  for (let pass = 1; pass < rounds; pass++) {
    for (const f of fixtures) {
      all.push({
        round: f.round + roundsPerPass * pass,
        week: 0,
        homeClubId: pass % 2 === 1 ? f.awayClubId : f.homeClubId,
        awayClubId: pass % 2 === 1 ? f.homeClubId : f.awayClubId,
        played: false,
      });
    }
  }

  assignWeeks(all);
  return all;
}

/** Spread rounds across the playing window; congested seasons get midweek rounds. */
export function assignWeeks(fixtures: Fixture[]): void {
  const totalRounds = fixtures.reduce((max, f) => Math.max(max, f.round), 0);
  const window = LAST_MATCH_WEEK - FIRST_MATCH_WEEK + 1;
  for (const f of fixtures) {
    const idx = f.round - 1;
    f.week = FIRST_MATCH_WEEK + Math.min(window - 1, Math.floor((idx * window) / totalRounds));
  }
}

export function initCompetitionSeason(
  rng: Rng,
  competition: Competition,
  clubIds: string[],
  season: number,
): CompetitionSeasonState {
  const table: Record<string, LeagueTableRow> = {};
  for (const id of clubIds) table[id] = emptyRow(id);
  return {
    competitionId: competition.id,
    season,
    clubIds: clubIds.slice(),
    table,
    fixtures: buildFixtures(rng, clubIds, competition.rounds),
    currentRound: 0,
    scorers: {},
    finished: false,
  };
}

export function applyResult(
  state: CompetitionSeasonState,
  homeId: string,
  awayId: string,
  homeGoals: number,
  awayGoals: number,
): void {
  const home = state.table[homeId];
  const away = state.table[awayId];
  if (!home || !away) return;

  home.played++;
  away.played++;
  home.goalsFor += homeGoals;
  home.goalsAgainst += awayGoals;
  away.goalsFor += awayGoals;
  away.goalsAgainst += homeGoals;

  if (homeGoals > awayGoals) {
    home.won++;
    away.lost++;
    home.points += 3;
  } else if (homeGoals < awayGoals) {
    away.won++;
    home.lost++;
    away.points += 3;
  } else {
    home.drawn++;
    away.drawn++;
    home.points++;
    away.points++;
  }
}

export function sortedTable(state: CompetitionSeasonState): LeagueTableRow[] {
  return Object.values(state.table).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.clubId.localeCompare(b.clubId);
  });
}

export function positionOf(state: CompetitionSeasonState, clubId: string): number {
  const table = sortedTable(state);
  return table.findIndex((r) => r.clubId === clubId) + 1;
}

export interface SeasonEndOutcome {
  champion: string | null;
  promoted: string[];
  relegated: string[];
}

export function resolveSeasonEnd(
  state: CompetitionSeasonState,
  competition: Competition,
): SeasonEndOutcome {
  const table = sortedTable(state);
  const champion = table[0]?.clubId ?? null;
  const promoted: string[] = [];
  const relegated: string[] = [];

  const autoUp = competition.promotion?.auto ?? 0;
  for (let i = 0; i < autoUp && i < table.length; i++) promoted.push(table[i]!.clubId);

  // Playoff: the next few places, winner decided by table position weighting elsewhere.
  const autoDown = competition.relegation?.auto ?? 0;
  for (let i = 0; i < autoDown && i < table.length; i++) {
    relegated.push(table[table.length - 1 - i]!.clubId);
  }

  state.finished = true;
  state.champion = champion ?? undefined;
  state.promoted = promoted;
  state.relegated = relegated;
  return { champion, promoted, relegated };
}

/** Club strength drifts toward its results, so tables aren't identical every season. */
export function driftClubStrength(rng: Rng, club: Club, finishPct: number): void {
  // finishPct: 0 = won the league, 1 = bottom.
  const expected = 1 - club.strength / 100;
  const surprise = expected - finishPct;
  const drift = surprise * rng.range(1.5, 4) + rng.gauss(0, 1.2);
  club.strength = Math.max(5, Math.min(99, club.strength + drift));
  club.reputation = Math.max(5, Math.min(99, club.reputation + drift * 0.35));
}

export function tierStrengthBand(tier: number): [number, number] {
  if (tier <= 1) return [58, 92];
  if (tier === 2) return [42, 68];
  return [28, 52];
}
