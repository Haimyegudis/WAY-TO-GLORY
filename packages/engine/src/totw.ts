/**
 * The team of the week.
 *
 * Every football country publishes one, every player looks for his own name in it, and
 * until now this world had no way of saying that anybody other than the user had played
 * well on Saturday. His own rating existed in a vacuum: a 7.8 meant nothing because there
 * was nothing to compare it with.
 *
 * The ratings for everybody else are not a second simulation - that would double the cost
 * of a week for a number nobody clicks on. They are read off what actually happened in
 * the fixture: the result, who scored, who kept a clean sheet, and how good the player is
 * relative to the side he plays for. Seeded from the fixture, so the same round always
 * produces the same eleven.
 */
import { Rng, clamp, hashString } from './rng.js';
import { positionGroup, ratingAt } from './positions.js';
import { clubBaseOvr } from './generate.js';
import { youthSquad } from './youth-squads.js';
import { youthClubRating } from './youth.js';
import type {
  CareerState, CompetitionSeasonState, Player, Position, TeamOfTheWeek, TeamOfTheWeekEntry,
} from './types.js';

/** The shape the eleven is picked in. One keeper, a back four, three and three. */
const SHAPE: { group: 'GK' | 'DEF' | 'MID' | 'ATT'; count: number }[] = [
  { group: 'GK', count: 1 },
  { group: 'DEF', count: 4 },
  { group: 'MID', count: 3 },
  { group: 'ATT', count: 3 },
];

interface Performance {
  player: Player;
  clubId: string;
  rating: number;
  goals: number;
}

/**
 * How a match went for one player, read off the fixture rather than simulated again.
 *
 * A win is worth something to everybody in the side, a hammering costs everybody, and
 * after that it is what he did and how good he is compared with the shirt he is in.
 */
function ratePerformance(
  rng: Rng,
  player: Player,
  clubLevel: number,
  scored: number,
  assisted: number,
  goalsFor: number,
  goalsAgainst: number,
): number {
  const group = positionGroup(player.primaryPos);
  const result = goalsFor > goalsAgainst ? 0.42 : goalsFor < goalsAgainst ? -0.32 : 0.02;
  const margin = clamp((goalsFor - goalsAgainst) * 0.08, -0.4, 0.4);
  const quality = clamp((ratingAt(player.attributes, player.primaryPos) - clubLevel) / 22, -0.5, 0.7);

  let rating = 6.4 + result + margin + quality + rng.gauss(0, 0.34);
  rating += scored * (group === 'DEF' || group === 'GK' ? 1.3 : 1.05);
  rating += assisted * 0.6;
  if (goalsAgainst === 0 && (group === 'GK' || group === 'DEF')) rating += 0.55;
  if (goalsAgainst >= 3 && (group === 'GK' || group === 'DEF')) rating -= 0.5;
  return clamp(Math.round(rating * 10) / 10, 3.5, 10);
}

/**
 * The eleven that played best in one round of the division he is in.
 *
 * Only his own league is modelled player by player, so only his own league gets one -
 * which is also the only one he would ever look at.
 */
export function buildTeamOfTheWeek(
  state: CareerState,
  competitionId: string,
  week: number,
  youth = false,
): TeamOfTheWeek | null {
  const comp: CompetitionSeasonState | undefined = youth
    ? state.world.youth?.competitions[competitionId]
    : state.world.competitions[competitionId];
  if (!comp) return null;
  const age = state.world.season - state.player.birthYear;
  const round = comp.fixtures.filter((fixture) => fixture.played && fixture.week === week);
  if (round.length < 2) return null;

  const performances: Performance[] = [];
  for (const fixture of round) {
    const scorers = new Map<string, number>();
    const assisters = new Map<string, number>();
    for (const goal of fixture.goals ?? []) {
      scorers.set(goal.playerId, (scorers.get(goal.playerId) ?? 0) + 1);
      if (goal.assistId) assisters.set(goal.assistId, (assisters.get(goal.assistId) ?? 0) + 1);
    }
    const [homeGoals, awayGoals] = fixture.result ?? [0, 0];

    for (const [clubId, forGoals, againstGoals] of [
      [fixture.homeClubId, homeGoals, awayGoals] as const,
      [fixture.awayClubId, awayGoals, homeGoals] as const,
    ]) {
      const club = state.world.clubs[clubId];
      if (!club) continue;
      const level = youth ? youthClubRating(club, age) : clubBaseOvr(club);
      const squad: Player[] = youth
        ? youthSquad(state, clubId)
        : (state.world.squads[clubId] ?? [])
          .map((id) => (id === state.player.id ? state.player : state.world.players[id]))
          .filter((entry): entry is Player => Boolean(entry));
      // The boy himself is not in the generated age-group squads, but he played.
      if (youth && state.player.clubId === clubId) squad.push(state.player);
      for (const player of squad) {
        const playerId = player.id;
        // The user is rated by the match he actually played, not by an estimate.
        if (player.isUser) {
          const line = state.matchLog.find(
            (match) => match.competitionId === competitionId
              && match.week === week
              && match.season === state.world.season
              && match.userLine?.played,
          )?.userLine;
          if (!line) continue;
          performances.push({ player, clubId, rating: line.rating, goals: line.goals });
          continue;
        }
        const rng = new Rng((hashString(`${fixture.homeClubId}:${fixture.awayClubId}:${week}:${playerId}`) % 2_000_000) + 1);
        // Not everybody in a squad played. The better ones did.
        if (!rng.chance(clamp(0.35 + (ratingAt(player.attributes, player.primaryPos) - level) / 20, 0.15, 0.95))) continue;
        performances.push({
          player,
          clubId,
          rating: ratePerformance(
            rng, player, level,
            scorers.get(playerId) ?? 0,
            assisters.get(playerId) ?? 0,
            forGoals, againstGoals,
          ),
          goals: scorers.get(playerId) ?? 0,
        });
      }
    }
  }
  if (performances.length < 11) return null;

  const entries: TeamOfTheWeekEntry[] = [];
  const taken = new Set<string>();
  for (const { group, count } of SHAPE) {
    const pool = performances
      .filter((entry) => !taken.has(entry.player.id) && positionGroup(entry.player.primaryPos) === group)
      .sort((a, b) => b.rating - a.rating || b.goals - a.goals);
    for (const entry of pool.slice(0, count)) {
      taken.add(entry.player.id);
      entries.push({
        playerId: entry.player.id,
        clubId: entry.clubId,
        name: `${entry.player.firstName} ${entry.player.lastName}`,
        slot: entry.player.primaryPos,
        rating: entry.rating,
        goals: entry.goals,
        isUser: Boolean(entry.player.isUser),
      });
    }
  }
  if (entries.length < 9) return null;

  return { competitionId, season: state.world.season, week, youth, entries };
}
