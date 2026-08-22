import { Rng, clamp } from './rng.js';
import { overall } from './positions.js';
import { sortedTable } from './league.js';
import {
  YOUTH_EXCHANGE,
  countryLeagues,
  seniorCompetitionId,
  youthCompetitionId,
  youthMembers,
} from './youth.js';
import type { PackIndex } from './data.js';
import type { CareerState, CompetitionSeasonState, SeasonStats } from './types.js';

/**
 * The end of a youth season.
 *
 * Somebody wins the division, two clubs go up, two come down, and three boys have a
 * night out. None of it is decided by the senior table: an academy that has been better
 * than everybody else's all year goes up whatever the first team did, which is why a
 * club can be in the top flight and have its sixteen year olds playing in the second
 * tier - and why the division he is in changes under him without him moving club.
 */

export type YouthAwardId =
  | 'youthLeagueTopScorer'
  | 'youthPlayerOfSeason'
  | 'youthTalentOfSeason';

export interface YouthAwardWinner {
  award: YouthAwardId;
  playerId: string;
  playerName: string;
  competitionId: string;
  detail?: number;
}

export interface YouthSeasonOutcome {
  champions: { competitionId: string; clubId: string }[];
  promoted: { competitionId: string; clubIds: string[] }[];
  relegated: { competitionId: string; clubIds: string[] }[];
  awards: YouthAwardWinner[];
}

/** Everything that happens to the youth pyramid in one summer. */
export function resolveYouthSeason(
  rng: Rng,
  state: CareerState,
  index: PackIndex,
): YouthSeasonOutcome {
  const youth = state.world.youth;
  const outcome: YouthSeasonOutcome = { champions: [], promoted: [], relegated: [], awards: [] };
  if (!youth) return outcome;

  const season = state.world.season;
  const club = state.player.clubId ? state.world.clubs[state.player.clubId] : null;
  const country = club?.country ?? '';

  // Champions.
  for (const [competitionId, comp] of Object.entries(youth.competitions)) {
    const rows = sortedTable(comp);
    const champion = rows[0]?.clubId;
    if (!champion) continue;
    comp.finished = true;
    comp.champion = champion;
    outcome.champions.push({ competitionId, clubId: champion });
    state.world.history.champions.push({ season, competitionId, clubId: champion });
  }

  // Up and down, tier by tier, on the youth tables alone.
  const ladder = countryLeagues(index, country).map((league) => youthCompetitionId(league.id));
  for (let i = 0; i < ladder.length - 1; i++) {
    const upper = youth.competitions[ladder[i]!];
    const lower = youth.competitions[ladder[i + 1]!];
    if (!upper || !lower) continue;

    const upperRows = sortedTable(upper);
    const lowerRows = sortedTable(lower);
    const exchange = Math.min(YOUTH_EXCHANGE, upperRows.length - 1, lowerRows.length - 1);
    if (exchange <= 0) continue;

    const goingDown = upperRows.slice(-exchange).map((row) => row.clubId);
    const comingUp = lowerRows.slice(0, exchange).map((row) => row.clubId);

    for (const clubId of goingDown) youth.membership[clubId] = ladder[i + 1]!;
    for (const clubId of comingUp) youth.membership[clubId] = ladder[i]!;

    upper.relegated = goingDown;
    lower.promoted = comingUp;
    outcome.relegated.push({ competitionId: ladder[i]!, clubIds: goingDown });
    outcome.promoted.push({ competitionId: ladder[i + 1]!, clubIds: comingUp });
  }

  // The individual honours, from the division he was actually in.
  const his = youth.userCompetitionId ? youth.competitions[youth.userCompetitionId] : null;
  if (his) outcome.awards.push(...decideYouthAwards(rng, state, his));

  return outcome;
}

/** The three names read out at the end of a youth season. */
function decideYouthAwards(
  rng: Rng,
  state: CareerState,
  comp: CompetitionSeasonState,
): YouthAwardWinner[] {
  const youth = state.world.youth;
  if (!youth) return [];
  const season = state.world.season;
  const rows = sortedTable(comp);
  const placeOf = (clubId: string | null) => {
    const at = rows.findIndex((row) => row.clubId === clubId);
    return at < 0 || rows.length < 2 ? 0.5 : at / (rows.length - 1);
  };

  interface Candidate {
    id: string;
    name: string;
    age: number;
    goals: number;
    assists: number;
    apps: number;
    rating: number;
    ovr: number;
    place: number;
  }

  const candidates: Candidate[] = [];

  // The boys.
  for (const [playerId, stats] of Object.entries(youth.stats)) {
    const player = youth.players[playerId];
    if (!player || stats.apps < 5) continue;
    candidates.push({
      id: playerId,
      name: `${player.firstName} ${player.lastName}`,
      age: season - player.birthYear,
      goals: stats.goals,
      assists: stats.assists,
      apps: stats.apps,
      rating: stats.ratedApps > 0 ? stats.ratingSum / stats.ratedApps : 6.5,
      ovr: overall(player.attributes, player.primaryPos, player.secondaryPos),
      place: placeOf(player.clubId),
    });
  }

  // And him.
  const form = youth.form;
  if (form.apps >= 5) {
    candidates.push({
      id: state.player.id,
      name: `${state.player.firstName} ${state.player.lastName}`,
      age: season - state.player.birthYear,
      goals: form.goals,
      assists: form.assists,
      apps: form.apps,
      rating: form.ratingSum / form.apps,
      ovr: overall(state.player.attributes, state.player.primaryPos, state.player.secondaryPos),
      place: placeOf(state.player.clubId),
    });
  }

  if (candidates.length === 0) return [];

  const winners: YouthAwardWinner[] = [];

  // Golden boot: goals, and nothing else. A tie goes to the one who played less.
  const scorers = [...candidates].sort((a, b) => b.goals - a.goals || a.apps - b.apps);
  const topScorer = scorers[0];
  if (topScorer && topScorer.goals > 0) {
    winners.push({
      award: 'youthLeagueTopScorer',
      playerId: topScorer.id,
      playerName: topScorer.name,
      competitionId: comp.competitionId,
      detail: topScorer.goals,
    });
  }

  // Player of the season: what he produced, how he was rated, and where his side
  // finished - a hatful of goals in a side that came last is worth less than the same
  // season in the champions, and a slightly noisy vote is still a vote.
  const score = (c: Candidate) =>
    c.goals * 1.2 + c.assists * 0.8 + (c.rating - 6.4) * 6 + (1 - c.place) * 4 + rng.gauss(0, 0.8);
  const voted = [...candidates].sort((a, b) => score(b) - score(a));
  const best = voted[0];
  if (best) {
    winners.push({
      award: 'youthPlayerOfSeason',
      playerId: best.id,
      playerName: best.name,
      competitionId: comp.competitionId,
    });
  }

  // Talent of the season: the same question asked of the youngest in the division.
  const young = candidates.filter((c) => c.age <= 17);
  const talent = [...young].sort(
    (a, b) => (b.ovr + b.goals * 1.5 + (b.rating - 6.4) * 8) - (a.ovr + a.goals * 1.5 + (a.rating - 6.4) * 8),
  )[0];
  if (talent && talent.id !== best?.id) {
    winners.push({
      award: 'youthTalentOfSeason',
      playerId: talent.id,
      playerName: talent.name,
      competitionId: comp.competitionId,
    });
  }

  return winners;
}

