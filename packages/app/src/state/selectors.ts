import {
  overall,
  ratingAt,
  sortedTable,
  type CareerState,
  type Club,
  type Competition,
  type CompetitionSeasonState,
  type Fixture,
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

/** The next league fixture our club has, from this week on. */
export function nextFixture(state: CareerState): UpcomingFixture | null {
  const c = myClub(state);
  const comp = myCompetitionState(state);
  if (!c || !comp) return null;

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
  name: string;
  clubName: string;
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
      const player = isUser ? state.player : state.world.players[playerId];
      const clubName = club(state, player?.clubId)?.shortName ?? '';
      return {
        playerId,
        name: player ? `${player.firstName} ${player.lastName}` : playerId,
        clubName,
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
