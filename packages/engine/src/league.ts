import { Rng, clamp } from './rng.js';
import type {
  Club,
  Competition,
  CompetitionCalendar,
  CompetitionSeasonState,
  Fixture,
  LeagueTableRow,
} from './types.js';

export const WEEKS_PER_SEASON = 52;
/** Three camp weeks, then European qualifying, then the domestic calendar. */
export const PRESEASON_END_WEEK = 3;
export const FIRST_MATCH_WEEK = 7;
export const LAST_MATCH_WEEK = 49;

export function emptyRow(clubId: string): LeagueTableRow {
  return { clubId, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
}

/**
 * Circle-method round robin. Returns fixtures for `rounds` passes
 * (2 = home and away), with home/away flipped on the second pass.
 */
export function buildFixtures(
  rng: Rng,
  clubIds: string[],
  rounds: number,
  calendar: CompetitionCalendar = { firstWeek: FIRST_MATCH_WEEK, lastWeek: LAST_MATCH_WEEK },
): Fixture[] {
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

  assignWeeks(all, calendar);
  return all;
}

/** Spread rounds across the playing window; congested seasons get midweek rounds. */
export function assignWeeks(
  fixtures: Fixture[],
  calendar: CompetitionCalendar = { firstWeek: FIRST_MATCH_WEEK, lastWeek: LAST_MATCH_WEEK },
): void {
  const totalRounds = fixtures.reduce((max, f) => Math.max(max, f.round), 0);
  const breaks = new Set(calendar.breakWeeks ?? []);
  const weeks = Array.from(
    { length: calendar.lastWeek - calendar.firstWeek + 1 },
    (_, index) => calendar.firstWeek + index,
  ).filter((week) => !breaks.has(week));
  for (const f of fixtures) {
    const idx = f.round - 1;
    const weekIndex = Math.min(weeks.length - 1, Math.floor((idx * weeks.length) / Math.max(1, totalRounds)));
    f.week = weeks[weekIndex] ?? calendar.firstWeek;
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
    fixtures: buildFixtures(
      rng,
      clubIds,
      competition.split?.regularRounds ?? competition.rounds,
      competition.split
        ? {
            ...(competition.calendar ?? { firstWeek: FIRST_MATCH_WEEK, lastWeek: LAST_MATCH_WEEK }),
            lastWeek: competition.split.regularLastWeek,
          }
        : competition.calendar,
    ).map((fixture) => ({ ...fixture, phase: 'regular' as const })),
    currentRound: 0,
    scorers: {},
    leagueRules: competition.leagueRules,
    finished: false,
  };
}

/**
 * Build a post-season only when the regular table is final. Points carry forward, but
 * group membership is locked: seventh cannot overtake sixth by collecting more points
 * against the lower half after the split.
 */
export function ensureLeagueSplit(
  rng: Rng,
  state: CompetitionSeasonState,
  competition: Competition,
  currentWeek = 0,
): boolean {
  const rules = competition.split;
  if (!rules || state.splitGroups) return false;
  const regular = state.fixtures.filter((fixture) => (fixture.phase ?? 'regular') === 'regular');
  if (regular.length === 0 || regular.some((fixture) => !fixture.played)) return false;
  /*
   * A season saved before the league had a post-season carries no phase markers, and its
   * regular rounds were spread over the whole calendar rather than stopping in week 34.
   * That season used to be left to finish as a twenty-six game league, which is a league
   * ending in the wrong place - so it is upgraded where it stands instead: the rounds
   * already played become the regular season, and the playoff starts next week rather
   * than in a week that has been and gone.
   */
  for (const fixture of regular) {
    if (fixture.phase === undefined) fixture.phase = 'regular';
  }

  const table = sortedTable(state);
  const upper = table.slice(0, rules.upperTeams).map((row) => row.clubId);
  const lower = table.slice(rules.upperTeams).map((row) => row.clubId);
  state.splitGroups = { upper, lower };

  const firstWeek = Math.max(rules.regularLastWeek + 1, currentWeek + 1);
  const lastWeek = Math.max(
    firstWeek + 1,
    Math.min(competition.calendar?.lastWeek ?? LAST_MATCH_WEEK, WEEKS_PER_SEASON - 1),
  );
  const regularRoundCount = regular.reduce((max, fixture) => Math.max(max, fixture.round), 0);
  const append = (clubIds: string[], rounds: number, phase: 'championship' | 'relegation') => {
    for (const fixture of buildFixtures(rng, clubIds, rounds, { firstWeek, lastWeek })) {
      state.fixtures.push({ ...fixture, round: fixture.round + regularRoundCount, phase });
    }
  };
  append(upper, rules.upperRounds, 'championship');
  append(lower, rules.lowerRounds, 'relegation');
  return true;
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
    home.points += state.leagueRules?.pointsForWin ?? 3;
  } else if (homeGoals < awayGoals) {
    away.won++;
    home.lost++;
    away.points += state.leagueRules?.pointsForWin ?? 3;
  } else {
    home.drawn++;
    away.drawn++;
    home.points += state.leagueRules?.pointsForDraw ?? 1;
    away.points += state.leagueRules?.pointsForDraw ?? 1;
  }
}

export function sortedTable(state: CompetitionSeasonState): LeagueTableRow[] {
  const sortRows = (rows: LeagueTableRow[]) => rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const breakers = state.leagueRules?.tieBreakers
      ?? ['goalDifference', 'goalsFor', 'wins', 'id'];
    for (const breaker of breakers) {
      if (breaker === 'headToHead') {
        const h2h = headToHead(state, a.clubId, b.clubId);
        if (h2h !== 0) return h2h;
      } else if (breaker === 'wins' && b.won !== a.won) {
        return b.won - a.won;
      } else if (breaker === 'goalDifference') {
        const gdA = a.goalsFor - a.goalsAgainst;
        const gdB = b.goalsFor - b.goalsAgainst;
        if (gdB !== gdA) return gdB - gdA;
      } else if (breaker === 'goalsFor' && b.goalsFor !== a.goalsFor) {
        return b.goalsFor - a.goalsFor;
      } else if (breaker === 'id') {
        return a.clubId.localeCompare(b.clubId);
      }
    }
    return a.clubId.localeCompare(b.clubId);
  });
  if (state.splitGroups) {
    return [
      ...sortRows(state.splitGroups.upper.map((id) => state.table[id]!)),
      ...sortRows(state.splitGroups.lower.map((id) => state.table[id]!)),
    ];
  }
  return sortRows(Object.values(state.table));
}

/** Pairwise league record, points first and aggregate goal difference second. */
function headToHead(state: CompetitionSeasonState, a: string, b: string): number {
  let pointsA = 0;
  let pointsB = 0;
  let goalsA = 0;
  let goalsB = 0;
  for (const fixture of state.fixtures) {
    if (!fixture.played || !fixture.result) continue;
    const direct = fixture.homeClubId === a && fixture.awayClubId === b;
    const reverse = fixture.homeClubId === b && fixture.awayClubId === a;
    if (!direct && !reverse) continue;
    const [home, away] = fixture.result;
    const aGoals = direct ? home : away;
    const bGoals = direct ? away : home;
    goalsA += aGoals;
    goalsB += bGoals;
    if (aGoals > bGoals) pointsA += 3;
    else if (aGoals < bGoals) pointsB += 3;
    else { pointsA++; pointsB++; }
  }
  if (pointsA !== pointsB) return pointsB - pointsA;
  return (goalsB - goalsA);
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
/**
 * How a club's playing strength moves after a season.
 *
 * A season is evidence, not a verdict. Without a pull back toward what the club
 * actually is, every side that finishes mid-table loses a point or two a year while
 * whoever won gains one - and ten seasons later Barcelona are in the second division
 * and Bournemouth have won five titles in a row. Reputation is the anchor: it moves
 * slowly, and strength is drawn back toward the level that reputation implies.
 */
export function driftClubStrength(rng: Rng, club: Club, finishPct: number): void {
  // finishPct: 0 = won the league, 1 = bottom.
  const expected = 1 - club.strength / 100;
  const surprise = expected - finishPct;

  // What a club of this standing should be worth on the pitch.
  const baseline = 30 + club.reputation * 0.62;
  const reversion = (baseline - club.strength) * 0.28;

  const drift = clamp(surprise * rng.range(0.9, 2.2) + reversion + rng.gauss(0, 0.9), -4.5, 4.5);
  club.strength = Math.round(clamp(club.strength + drift, 5, 99));
  // Prestige is built and lost over many seasons, and it is pulled back to what the
  // club has always been: a good run lifts a small club for a while, it does not turn
  // it into Real Madrid, and one bad decade does not end Real Madrid either.
  const prestige = club.prestige ?? club.reputation;
  const reputationDrift = surprise * rng.range(0.2, 0.7) + (prestige - club.reputation) * 0.22;
  club.reputation = Math.round(clamp(club.reputation + reputationDrift, 5, 99));
}

