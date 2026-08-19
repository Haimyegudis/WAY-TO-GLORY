import { Rng, clamp } from './rng.js';
import { generatePlayer } from './generate.js';
import { overall } from './positions.js';
import { YOUTH_MAX_AGE, youthClubRating, youthMembers } from './youth.js';
import type { PackIndex } from './data.js';
import type { CareerState, Club, Player, Position, SeasonStats, YouthWorld } from './types.js';

/**
 * The boys.
 *
 * A youth league whose sides are numbers is a table, not a league: nobody is chasing
 * anybody for the golden boot and the seventeen year old who scores thirty is not a
 * person. So the division the player is in gets real squads - sixteen to a club, aged
 * fifteen to nineteen, rated at the level a youth side of that club would actually be -
 * and they age out of it and are replaced every summer, which is what makes finishing
 * above them mean anything.
 *
 * Only his own division is populated. Doing this for a whole country would put a few
 * thousand people in the save file to decide results nobody reads.
 */

export const YOUTH_SQUAD_SIZE = 16;

/** One keeper short of a senior template, and no room for a fourth striker. */
const YOUTH_TEMPLATE: { pos: Position; count: number }[] = [
  { pos: 'GK', count: 2 },
  { pos: 'CB', count: 3 },
  { pos: 'RB', count: 1 },
  { pos: 'LB', count: 1 },
  { pos: 'CDM', count: 1 },
  { pos: 'CM', count: 3 },
  { pos: 'CAM', count: 1 },
  { pos: 'RW', count: 1 },
  { pos: 'LW', count: 1 },
  { pos: 'ST', count: 2 },
];

/** An age group is mostly seventeens and eighteens, with a couple of boys pushed up. */
function youthAge(rng: Rng, slot: number): number {
  const roll = rng.next();
  if (slot < 2) return rng.int(17, 19);
  if (roll < 0.2) return rng.int(15, 16);
  if (roll < 0.75) return rng.int(17, 18);
  return 19;
}

export function emptyYouthStats(season: number, clubId: string, competitionId: string): SeasonStats {
  return {
    season,
    clubId,
    competitionId,
    apps: 0, starts: 0, subApps: 0, minutes: 0,
    goals: 0, assists: 0, cleanSheets: 0,
    yellowCards: 0, redCards: 0, motm: 0,
    ratingSum: 0, ratedApps: 0,
  };
}

/**
 * Sixteen boys for one club, at the level that club's age group would actually play at.
 * The best of them is a year or two from the first team; the rest never make it, which
 * is what the youth league is.
 */
export function generateYouthSquad(rng: Rng, index: PackIndex, club: Club, season: number): Player[] {
  const players: Player[] = [];
  const homeCountry = club.country;
  const otherCountries = index.pack.countries.map((c) => c.code).filter((c) => c !== homeCountry);
  // Academies are local. A boy from abroad at sixteen is the exception, not the rule.
  const foreignChance = clamp(club.reputation / 400, 0.02, 0.18);

  let slot = 0;
  for (const entry of YOUTH_TEMPLATE) {
    for (let i = 0; i < entry.count; i++) {
      const age = youthAge(rng, slot);
      const level = youthClubRating(club, age);
      const depthPenalty = i * rng.range(1.5, 3);
      const target = clamp(Math.round(level - depthPenalty + rng.gaussIn(0, 3.5, -9, 9)), 20, 70);
      const country = rng.chance(foreignChance) && otherCountries.length > 0
        ? rng.pick(otherCountries)
        : homeCountry;

      players.push(
        generatePlayer(rng, index, {
          clubId: club.id,
          pos: entry.pos,
          age,
          targetOvr: target,
          season,
          countryCode: country,
          squadRole: 'academy',
        }),
      );
      slot++;
    }
  }

  return players;
}

/**
 * Fills one youth division with players and clears out any club that is no longer in
 * it - which happens when the player himself moves, or when his club goes up or down
 * the youth pyramid.
 */
export function stockYouthDivision(
  rng: Rng,
  state: CareerState,
  index: PackIndex,
  competitionId: string,
): void {
  const youth = state.world.youth;
  if (!youth) return;
  const wanted = new Set(youthMembers(youth, competitionId));

  // Anybody outside the division we are modelling goes back to being a number.
  for (const clubId of Object.keys(youth.squads)) {
    if (wanted.has(clubId)) continue;
    for (const playerId of youth.squads[clubId] ?? []) {
      delete youth.players[playerId];
      delete youth.stats[playerId];
    }
    delete youth.squads[clubId];
  }

  for (const clubId of wanted) {
    if (youth.squads[clubId]?.length) continue;
    const club = state.world.clubs[clubId];
    if (!club) continue;
    const squad = generateYouthSquad(rng, index, club, state.world.season);
    youth.squads[clubId] = squad.map((p) => p.id);
    for (const player of squad) {
      youth.players[player.id] = player;
      youth.stats[player.id] = emptyYouthStats(state.world.season, clubId, competitionId);
    }
  }

  youth.userCompetitionId = competitionId;
}

/**
 * The summer. Everyone gets a year older, the ones who have outgrown it leave, and a
 * new intake of fifteen and sixteen year olds walks in. Returns the leavers, because
 * the best of them are the ones the first team has been watching.
 */
export function ageYouthWorld(rng: Rng, state: CareerState, index: PackIndex): Player[] {
  const youth = state.world.youth;
  if (!youth) return [];
  const season = state.world.season;
  const leavers: Player[] = [];

  for (const [clubId, ids] of Object.entries(youth.squads)) {
    const club = state.world.clubs[clubId];
    if (!club) continue;
    const staying: string[] = [];

    for (const id of ids) {
      const player = youth.players[id];
      if (!player) continue;
      const age = season - player.birthYear;
      if (age > YOUTH_MAX_AGE) {
        leavers.push(player);
        delete youth.players[id];
        delete youth.stats[id];
        continue;
      }
      // A year of training. Youth players improve faster than seniors and further from
      // where they started, which is why an academy is worth having.
      developYouthPlayer(rng, player);
      staying.push(id);
    }

    // Back up to a full age group with boys who have just come through.
    const competitionId = youth.membership[clubId] ?? youth.userCompetitionId ?? '';
    while (staying.length < YOUTH_SQUAD_SIZE) {
      const entry = YOUTH_TEMPLATE[staying.length % YOUTH_TEMPLATE.length]!;
      const age = rng.int(15, 16);
      const target = clamp(
        Math.round(youthClubRating(club, age) + rng.gaussIn(0, 4, -10, 10)),
        20,
        66,
      );
      const player = generatePlayer(rng, index, {
        clubId,
        pos: entry.pos,
        age,
        targetOvr: target,
        season,
        countryCode: club.country,
        squadRole: 'academy',
      });
      youth.players[player.id] = player;
      youth.stats[player.id] = emptyYouthStats(season, clubId, competitionId);
      staying.push(player.id);
    }

    youth.squads[clubId] = staying;
  }

  return leavers;
}

/** A year in an academy, on the attributes rather than on a hidden number. */
function developYouthPlayer(rng: Rng, player: Player): void {
  const current = overall(player.attributes, player.primaryPos, player.secondaryPos);
  const headroom = Math.max(0, player.potential - current);
  if (headroom <= 0) return;
  const gain = clamp(rng.range(1.5, 4.5) * clamp(headroom / 20, 0.3, 1.4), 0, 8);
  const keys = Object.keys(player.attributes) as (keyof typeof player.attributes)[];
  // Spread the year across a handful of things rather than all of it onto one.
  const touched = rng.shuffle(keys).slice(0, 8);
  for (const key of touched) {
    player.attributes[key] = clamp(player.attributes[key] + gain / touched.length * rng.range(0.5, 1.8), 1, 99);
  }
}

/** Everybody in one youth squad, as players. */
export function youthSquad(state: CareerState, clubId: string): Player[] {
  const youth = state.world.youth;
  if (!youth) return [];
  return (youth.squads[clubId] ?? [])
    .map((id) => youth.players[id])
    .filter((p): p is Player => Boolean(p));
}

/** The season's record for one boy, created on demand. */
export function youthStatsFor(youth: YouthWorld, playerId: string, season: number, clubId: string, competitionId: string): SeasonStats {
  const existing = youth.stats[playerId];
  if (existing) return existing;
  const fresh = emptyYouthStats(season, clubId, competitionId);
  youth.stats[playerId] = fresh;
  return fresh;
}
