import { Rng, clamp } from './rng.js';
import { overall } from './positions.js';
import { sortedTable } from './league.js';
import type { CareerState, Player } from './types.js';
import type { PackIndex } from './data.js';

/**
 * The individual honours.
 *
 * A career is remembered by its trophies, and not all of them are won by a team: the
 * golden boot, player of the season, and at the very top the Ballon d'Or. These are
 * decided at the end of every season from what actually happened in the world - goals
 * scored in the competitions we simulate, trophies won, the level of the league - so
 * they can be argued with, which is the point of an award.
 */

export type AwardId =
  | 'leaguePlayerOfSeason'
  | 'leagueTopScorer'
  | 'leagueYoungPlayer'
  | 'goldenShoe'
  | 'europeanPlayerOfYear'
  | 'worldPlayerOfYear'
  | 'ballonDOr';

export interface AwardResult {
  award: AwardId;
  playerId: string;
  /** Display name, needed for the stars the world does not model player by player. */
  playerName: string;
  /** Three names, so the user can see he was in the conversation even when he lost. */
  shortlist: string[];
  competitionId?: string;
  detail?: number;
}

interface Candidate {
  player: Player;
  goals: number;
  competitionId: string | null;
  leagueReputation: number;
  trophyScore: number;
  ovr: number;
  age: number;
}

/** Everyone the world actually models, with the season they just had attached. */
function buildCandidates(state: CareerState, index: PackIndex): Candidate[] {
  const season = state.world.season;
  const goalsByPlayer = new Map<string, { goals: number; competitionId: string }>();

  for (const compState of Object.values(state.world.competitions)) {
    for (const [playerId, goals] of Object.entries(compState.scorers)) {
      const current = goalsByPlayer.get(playerId);
      if (!current || goals > current.goals) {
        goalsByPlayer.set(playerId, { goals, competitionId: compState.competitionId });
      }
    }
  }

  // A trophy is worth more than a hat-trick when the votes are counted.
  const trophyScore = new Map<string, number>();
  for (const record of state.world.history.champions.filter((c) => c.season === season)) {
    const competition = index.competitionById.get(record.competitionId);
    const weight = competition ? competition.reputation / 20 : 2;
    for (const playerId of state.world.squads[record.clubId] ?? []) {
      trophyScore.set(playerId, (trophyScore.get(playerId) ?? 0) + weight);
    }
  }
  for (const record of (state.world.history.europeanWinners ?? []).filter((c) => c.season === season)) {
    const weight = record.tier === 'ucl' ? 9 : record.tier === 'uel' ? 5 : 3;
    for (const playerId of state.world.squads[record.clubId] ?? []) {
      trophyScore.set(playerId, (trophyScore.get(playerId) ?? 0) + weight);
    }
  }

  const out: Candidate[] = [];
  for (const player of Object.values(state.world.players)) {
    if (player.retired) continue;
    const club = player.clubId ? state.world.clubs[player.clubId] : null;
    const competition = club ? index.competitionById.get(club.competitionId) : null;
    const scored = goalsByPlayer.get(player.id);
    out.push({
      player,
      goals: scored?.goals ?? 0,
      competitionId: club?.competitionId ?? null,
      leagueReputation: competition?.reputation ?? 30,
      trophyScore: trophyScore.get(player.id) ?? 0,
      ovr: overall(player.attributes, player.primaryPos, player.secondaryPos),
      age: season - player.birthYear,
    });
  }
  return out;
}

/**
 * The rest of football. Only the user's league is modelled player by player, so the
 * global awards are contested by the real players the data pack knows: their rating
 * is real, and the season they had is estimated from it and from what their club won.
 * Without this the Ballon d'Or is decided inside whatever division the user plays in.
 */
function worldCandidates(rng: Rng, state: CareerState, index: PackIndex): Candidate[] {
  const season = state.world.season;
  const userCompetition = state.player.clubId
    ? state.world.clubs[state.player.clubId]?.competitionId ?? null
    : null;

  const championClubs = new Set(
    state.world.history.champions.filter((c) => c.season === season).map((c) => c.clubId),
  );
  const europeanWinners = new Map(
    (state.world.history.europeanWinners ?? [])
      .filter((c) => c.season === season)
      .map((c) => [c.clubId, c.tier] as const),
  );

  const out: Candidate[] = [];
  for (const club of Object.values(state.world.clubs)) {
    if (club.tier !== 1) continue;
    if (club.competitionId === userCompetition) continue;   // already modelled
    const competition = index.competitionById.get(club.competitionId);
    const reputation = competition?.reputation ?? 40;
    if (reputation < 65) continue;

    for (const star of (index.starsByClub.get(club.id) ?? []).slice(0, 6)) {
      const attacking = star.pos === 'ST' || star.pos === 'CF' || star.pos === 'RW' || star.pos === 'LW' || star.pos === 'CAM';
      // A 90-rated striker scores about 25 in a league season; a defender does not.
      const base = attacking ? (star.ovr - 62) * 0.95 : (star.ovr - 74) * 0.25;
      const goals = Math.max(0, Math.round(base * rng.range(0.65, 1.35)));

      let trophyScore = championClubs.has(club.id) ? reputation / 20 : 0;
      const euro = europeanWinners.get(club.id);
      if (euro) trophyScore += euro === 'ucl' ? 9 : euro === 'uel' ? 5 : 3;

      out.push({
        player: {
          id: `star:${club.id}:${star.firstName} ${star.lastName}`,
          firstName: star.firstName,
          lastName: star.lastName,
          birthYear: season - star.age,
        } as unknown as Player,
        goals,
        competitionId: club.competitionId,
        leagueReputation: reputation,
        trophyScore,
        ovr: star.ovr,
        age: star.age,
      });
    }
  }
  return out;
}

/** The user is modelled apart from the rest of the world, so he is added by hand. */
function userCandidate(state: CareerState, index: PackIndex): Candidate {
  const player = state.player;
  const season = state.world.season;
  const stats = state.world.seasonStats[player.id];
  const club = player.clubId ? state.world.clubs[player.clubId] : null;
  const competition = club ? index.competitionById.get(club.competitionId) : null;

  let trophyScore = 0;
  for (const trophy of state.trophies.filter((t) => t.season === season)) {
    trophyScore += trophy.competitionId === 'ucl' ? 9 : trophy.competitionId === 'uel' ? 5 : 4;
  }

  return {
    player,
    goals: stats?.goals ?? 0,
    competitionId: club?.competitionId ?? null,
    leagueReputation: competition?.reputation ?? 30,
    trophyScore,
    ovr: overall(player.attributes, player.primaryPos, player.secondaryPos),
    age: season - player.birthYear,
  };
}

/** A season in one number, with the level he played at taken into account. */
function seasonScore(candidate: Candidate, worldWeighted: boolean): number {
  // Where he played counts for a lot in a global vote: 25 goals in the Premier League
  // and 25 goals in the Israeli second tier are not the same 25 goals.
  const level = worldWeighted ? Math.pow(clamp(candidate.leagueReputation, 20, 100) / 80, 2.2) : 1;
  const contribution = candidate.goals * 2.4 + candidate.ovr * 0.55;
  return (contribution + candidate.trophyScore * 3.2) * level;
}

function pick(rng: Rng, ranked: Candidate[], award: AwardId, competitionId?: string, detail?: number): AwardResult | null {
  const winner = ranked[0];
  if (!winner) return null;
  // A hair of noise so the same names do not win for twenty seasons running.
  return {
    award,
    playerId: winner.player.id,
    playerName: `${winner.player.firstName} ${winner.player.lastName}`,
    shortlist: ranked.slice(0, 3).map((c) => c.player.id),
    ...(competitionId ? { competitionId } : {}),
    ...(detail !== undefined ? { detail } : {}),
    ...(rng ? {} : {}),
  };
}

function rank(rng: Rng, candidates: Candidate[], score: (c: Candidate) => number): Candidate[] {
  return candidates
    .map((c) => ({ c, s: score(c) * (0.94 + rng.next() * 0.12) }))
    .sort((a, b) => b.s - a.s)
    .map((entry) => entry.c);
}

/**
 * Decides every award for the season just finished. The user's own league gets its
 * own honours; the global awards are argued across every league we simulate.
 */
export function decideAwards(rng: Rng, state: CareerState, index: PackIndex): AwardResult[] {
  const local = [...buildCandidates(state, index), userCandidate(state, index)];
  const candidates = [...local, ...worldCandidates(rng, state, index)];
  if (candidates.length === 0) return [];

  const results: AwardResult[] = [];
  const userCompetition = state.player.clubId
    ? state.world.clubs[state.player.clubId]?.competitionId ?? null
    : null;

  // ---- the user's league
  if (userCompetition) {
    const inLeague = local.filter((c) => c.competitionId === userCompetition);
    if (inLeague.length >= 3) {
      const best = rank(rng, inLeague, (c) => seasonScore(c, false));
      const potm = pick(rng, best, 'leaguePlayerOfSeason', userCompetition);
      if (potm) results.push(potm);

      const scorers = rank(rng, inLeague, (c) => c.goals * 10 + c.ovr * 0.1);
      const topScorer = pick(rng, scorers, 'leagueTopScorer', userCompetition, scorers[0]?.goals);
      if (topScorer && (scorers[0]?.goals ?? 0) > 0) results.push(topScorer);

      const young = inLeague.filter((c) => c.age <= 21);
      if (young.length >= 3) {
        const youngRanked = rank(rng, young, (c) => seasonScore(c, false));
        const youngAward = pick(rng, youngRanked, 'leagueYoungPlayer', userCompetition);
        if (youngAward) results.push(youngAward);
      }
    }
  }

  // ---- the global honours
  const shoe = rank(rng, candidates, (c) => c.goals * 10 + c.leagueReputation * 0.05);
  const goldenShoe = pick(rng, shoe, 'goldenShoe', undefined, shoe[0]?.goals);
  if (goldenShoe && (shoe[0]?.goals ?? 0) > 0) results.push(goldenShoe);

  const european = candidates.filter((c) => c.leagueReputation >= 50);
  if (european.length >= 3) {
    const ranked = rank(rng, european, (c) => seasonScore(c, true));
    const award = pick(rng, ranked, 'europeanPlayerOfYear');
    if (award) results.push(award);
  }

  const worldRanked = rank(rng, candidates, (c) => seasonScore(c, true) * (1 + c.trophyScore / 30));
  const worldAward = pick(rng, worldRanked, 'worldPlayerOfYear');
  if (worldAward) results.push(worldAward);

  // The Ballon d'Or leans hardest on what was won, which is how it actually reads.
  const ballonRanked = rank(rng, candidates, (c) => seasonScore(c, true) + c.trophyScore * 4.5);
  const ballon = pick(rng, ballonRanked, 'ballonDOr');
  if (ballon) results.push(ballon);

  return results;
}

/** How much an award moves the player's standing in the game. */
export function awardFame(award: AwardId): number {
  switch (award) {
    case 'ballonDOr': return 18;
    case 'worldPlayerOfYear': return 14;
    case 'europeanPlayerOfYear': return 11;
    case 'goldenShoe': return 9;
    case 'leaguePlayerOfSeason': return 6;
    case 'leagueTopScorer': return 5;
    case 'leagueYoungPlayer': return 4;
    default: return 2;
  }
}

export function awardReputation(award: AwardId): number {
  return clamp(awardFame(award) * 0.6, 1, 12);
}
