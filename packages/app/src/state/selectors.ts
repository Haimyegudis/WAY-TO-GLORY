import {
  CAMP_SLOTS,
  campFixtureAtHome,
  overall,
  ratingAt,
  sortedTable,
  type CampSlot,
  type CareerState,
  type Club,
  type Competition,
  type CompetitionSeasonState,
  type Fixture,
  type MatchResult,
  type PackIndex,
  type Player,
} from '@fc/engine';

export function club(state: CareerState, id: string | null | undefined): Club | null {
  return id ? state.world.clubs[id] ?? null : null;
}

export function myClub(state: CareerState): Club | null {
  return club(state, state.player.clubId);
}

export function myCompetition(state: CareerState, index: PackIndex): Competition | null {
  const c = myClub(state);
  return c ? index.competitionById.get(c.competitionId) ?? null : null;
}

export function myCompetitionState(state: CareerState): CompetitionSeasonState | null {
  const c = myClub(state);
  return c ? state.world.competitions[c.competitionId] ?? null : null;
}

export interface UpcomingFixture {
  fixture: Fixture;
  opponent: Club | null;
  home: boolean;
  competitionId: string;
}

export interface CampFixture {
  week: number;
  slot: CampSlot;
  opponent: Club | null;
  home: boolean;
  /** The match, once it has been played, so the report can be opened from the list. */
  match: MatchResult | null;
}

/** The camp weeks, or nothing at all outside them. */
const CAMP_WEEKS = [1, 2, 3];

export function inTrainingCamp(state: CareerState): boolean {
  return Boolean(state.flags[`trainingCamp:${state.world.season}`])
    && CAMP_WEEKS.includes(state.world.week);
}

/**
 * The whole camp, in order, played and unplayed alike. The schedule is written into the
 * flags the moment camp opens, so every friendly is visible before it is kicked off.
 */
export function campSchedule(state: CareerState): CampFixture[] {
  const mine = myClub(state);
  if (!mine || !state.flags[`trainingCamp:${state.world.season}`]) return [];
  const played = state.matchLog.filter(
    (match) => match.season === state.world.season && match.competitionId.startsWith('friendly'),
  );

  const fixtures: CampFixture[] = [];
  for (const week of CAMP_WEEKS) {
    for (const slot of CAMP_SLOTS) {
      const opponentId = String(state.flags[`campOpponent:${state.world.season}:${week}:${slot}`] ?? '');
      if (!opponentId) continue;
      const home = campFixtureAtHome(week, slot);
      fixtures.push({
        week,
        slot,
        opponent: club(state, opponentId),
        home,
        match: played.find(
          (match) => match.week === week
            && (match.homeClubId === opponentId || match.awayClubId === opponentId),
        ) ?? null,
      });
    }
  }
  return fixtures;
}

/** The next league fixture our club has, from this week on. */
export function nextFixture(state: CareerState): UpcomingFixture | null {
  const c = myClub(state);
  if (!c) return null;

  // Friendlies do not belong to a league table, but the camp schedule is fixed by the
  // engine and the player must be able to see each one before pressing kickoff.
  if (inTrainingCamp(state)) {
    // Two friendlies a week, so it is the next unplayed one that is ahead of him.
    const next = campSchedule(state).find(
      (entry) => !entry.match && entry.week >= state.world.week && entry.opponent,
    );
    if (next?.opponent) {
      return {
        fixture: {
          round: next.week,
          week: next.week,
          homeClubId: next.home ? c.id : next.opponent.id,
          awayClubId: next.home ? next.opponent.id : c.id,
          played: false,
        },
        opponent: next.opponent,
        home: next.home,
        competitionId: 'friendly',
      };
    }
  }

  const comp = myCompetitionState(state);
  if (!comp) return null;

  const upcoming = comp.fixtures
    .filter((f) => !f.played && (f.homeClubId === c.id || f.awayClubId === c.id) && f.week >= state.world.week)
    .sort((a, b) => a.week - b.week)[0];
  if (!upcoming) return null;

  const home = upcoming.homeClubId === c.id;
  return {
    fixture: upcoming,
    opponent: club(state, home ? upcoming.awayClubId : upcoming.homeClubId),
    home,
    competitionId: comp.competitionId,
  };
}

export function table(state: CareerState) {
  const comp = myCompetitionState(state);
  return comp ? sortedTable(comp) : [];
}

export function myPosition(state: CareerState): number | null {
  const c = myClub(state);
  const rows = table(state);
  if (!c || rows.length === 0) return null;
  const i = rows.findIndex((r) => r.clubId === c.id);
  return i === -1 ? null : i + 1;
}

export interface SquadEntry {
  player: Player;
  ovr: number;
  age: number;
  isUser: boolean;
}

export function squad(state: CareerState): SquadEntry[] {
  const c = myClub(state);
  if (!c) return [];
  const ids = state.world.squads[c.id] ?? [];
  const players = ids.map((id) => state.world.players[id]).filter((p): p is Player => !!p);
  if (state.player.squadRole !== 'academy' && !players.some((p) => p.id === state.player.id)) {
    players.push(state.player);
  }
  return players
    .map((player) => ({
      player,
      ovr: overall(player.attributes, player.primaryPos, player.secondaryPos),
      age: state.world.season - player.birthYear,
      isUser: player.id === state.player.id,
    }))
    .sort((a, b) => b.ovr - a.ovr);
}

export interface ScorerRow {
  playerId: string;
  player: Player | null;
  clubId: string | null;
  goals: number;
  isUser: boolean;
}

export function topScorers(state: CareerState, limit = 10): ScorerRow[] {
  const comp = myCompetitionState(state);
  if (!comp) return [];
  return Object.entries(comp.scorers)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([playerId, goals]) => {
      const isUser = playerId === state.player.id;
      const player = (isUser ? state.player : state.world.players[playerId]) ?? null;
      return {
        playerId,
        player,
        clubId: player?.clubId ?? null,
        goals,
        isUser,
      };
    });
}

export function seasonLine(state: CareerState) {
  const stats = state.world.seasonStats[state.player.id];
  return {
    apps: stats?.apps ?? 0,
    goals: stats?.goals ?? 0,
    assists: stats?.assists ?? 0,
    rating: stats && stats.ratedApps > 0 ? stats.ratingSum / stats.ratedApps : 0,
    minutes: stats?.minutes ?? 0,
  };
}

export function recentMatches(state: CareerState, limit = 8) {
  return state.matchLog.slice(0, limit);
}

export function positionRating(player: Player, pos: Player['primaryPos']): number {
  return ratingAt(player.attributes, pos);
}

export function weeksInjured(state: CareerState): number {
  return state.player.condition.injuries.reduce((max, i) => Math.max(max, i.weeksRemaining), 0);
}

/**
 * The team talk that is actually waiting on him, if there is one.
 *
 * A break that has been answered, or one belonging to a match that has since been
 * played, is a record rather than a question. Two screens used to work this out for
 * themselves and disagreed: the match screen showed the report while the app still
 * thought he was in the dressing room, so it hid the only button on the screen and the
 * career could not be moved on at all.
 */
export function openHalfTime(state: CareerState | null | undefined) {
  const half = state?.pendingHalfTime;
  if (!half) return null;
  if (half.chosen !== undefined) return null;
  if (half.matchId === state?.lastMatch?.id) return null;
  return half;
}
