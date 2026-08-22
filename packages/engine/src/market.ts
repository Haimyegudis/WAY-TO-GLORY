/**
 * The transfer market as the rest of the world experiences it.
 *
 * Two things happen every summer, at two different resolutions. Across the whole world
 * only money and standing are modelled, so clubs trade strength: a rich club spends what
 * a poor one cannot and pulls away, and a club everybody is picking over falls further.
 * That is what stops a league being the same league for twenty seasons.
 *
 * At the clubs we model player by player - his own, and the rest of his division - real
 * signings arrive and real team-mates leave. This is the half he feels: a striker bought
 * in his position is a season on the bench, and a captain sold is a shirt going spare.
 */
import { Rng, clamp } from './rng.js';
import { clubBaseOvr, generatePlayer } from './generate.js';
import { namesInUse } from './youth-squads.js';
import { ratingAt } from './positions.js';
import { marketValue } from './value.js';
import type { PackIndex } from './data.js';
import type { CareerState, Club, Player, Position } from './types.js';

/** A move at a club we model player by player. */
export interface SquadMove {
  direction: 'in' | 'out';
  clubId: string;
  playerId: string;
  playerName: string;
  fee: number;
  /** Position he plays, for working out whether this lands on the user. */
  position: Position;
  rating: number;
}

/**
 * Money buys players and players win matches. Each club is pushed toward or away from
 * where its wallet says it belongs, relative to the division it is in - so the richest
 * club in a poor league still climbs, and a big spender who has just gone down does not
 * stay big for long.
 */
export function runAbstractMarket(rng: Rng, state: CareerState, index: PackIndex): void {
  const byCompetition = new Map<string, Club[]>();
  for (const club of Object.values(state.world.clubs)) {
    const list = byCompetition.get(club.competitionId);
    if (list) list.push(club);
    else byCompetition.set(club.competitionId, [club]);
  }

  for (const [competitionId, clubs] of byCompetition) {
    if (clubs.length < 2) continue;
    const competition = index.competitionById.get(competitionId);
    const meanFinances = clubs.reduce((sum, c) => sum + c.finances, 0) / clubs.length;

    for (const club of clubs) {
      // What this club can outspend its neighbours by, in strength points a season.
      const edge = (club.finances - meanFinances) / 100;
      const spend = edge * rng.range(1.2, 3.2);

      // A window is not only spending: every club loses somebody, and the smaller the
      // club the harder it is to say no when a bigger one comes in.
      const exposure = clamp((60 - club.reputation) / 60, 0, 1);
      const raided = -exposure * rng.range(0, 2.2);

      club.strength = Math.round(clamp(club.strength + spend + raided + rng.gauss(0, 0.6), 5, 99));

      // Selling brings money in, and a division's television money sets the floor under
      // everyone in it. A club that keeps selling well grows into a bigger one, slowly.
      const leagueMoney = (competition?.reputation ?? 40) / 2.2;
      const drift = (leagueMoney - club.finances) * 0.12 + (exposure > 0.5 ? rng.range(0, 1.6) : 0);
      club.finances = Math.round(clamp(club.finances + drift, 3, 99));
    }
  }
}

/** Roughly how good a signing this club can attract, before luck. */
function targetLevelFor(club: Club, rng: Rng): number {
  return clamp(Math.round(clubBaseOvr(club) + rng.gaussIn(0, 3, -7, 7)), 25, 95);
}

/**
 * Whether a player is out of place at his club: too good for it, or not good enough. The
 * first kind gets bought, the second gets moved on, and everybody else stays put.
 */
function outOfPlace(player: Player, club: Club, season: number, rng: Rng): 'sold' | 'released' | null {
  const level = clubBaseOvr(club);
  const rating = ratingAt(player.attributes, player.primaryPos);
  const age = season - player.birthYear;

  // Too good for the shirt. A small club cannot hold a player the continent has noticed,
  // and the bigger the gap the shorter the wait.
  if (rating > level + 5) {
    const pull = clamp((rating - level - 5) / 10, 0.08, 0.55);
    if (rng.chance(pull)) return 'sold';
  }

  // Not good enough, or too old to be worth the wage. Clubs are unsentimental in July.
  if (rating < level - 7 && rng.chance(0.32)) return 'released';
  if (age >= 32 && rating < level && rng.chance(0.3)) return 'released';
  return null;
}

function valueOf(player: Player, club: Club, season: number, index: PackIndex): number {
  const value = marketValue(player, {
    season,
    leagueReputation: index.competitionById.get(club.competitionId)?.reputation ?? 40,
    contract: null,
    internationalCaps: 0,
  });
  return Math.round(value / 50_000) * 50_000;
}

/**
 * Summer at the clubs we model. Players leave, players arrive, and the squad he is
 * fighting for a place in is not the squad it was in May.
 */
export function runSquadWindow(rng: Rng, state: CareerState, index: PackIndex): SquadMove[] {
  const season = state.world.season;
  const moves: SquadMove[] = [];
  const userClubId = state.player.clubId;
  // Every name already spoken for in this world. Without it the window signed a second
  // Oshri Moskovitz into the same dressing room as the first.
  const taken = namesInUse(state);

  for (const [clubId, ids] of Object.entries(state.world.squads)) {
    const club = state.world.clubs[clubId];
    if (!club) continue;

    // His own club is modelled in full; the rest of the division is a first eleven's
    // worth of names, and stripping those back leaves nothing to print in the charts.
    const floor = clubId === userClubId ? 20 : 8;
    const kept: string[] = [];
    const departures: SquadMove[] = [];

    for (const id of ids) {
      const player = state.world.players[id];
      if (!player) continue;
      if (player.isUser) {
        kept.push(id);
        continue;
      }

      const room = ids.length - departures.length > floor;
      const verdict = room ? outOfPlace(player, club, season, rng) : null;
      if (!verdict) {
        kept.push(id);
        continue;
      }

      departures.push({
        direction: 'out',
        clubId,
        playerId: id,
        playerName: `${player.firstName} ${player.lastName}`,
        fee: verdict === 'released' ? 0 : valueOf(player, club, season, index),
        position: player.primaryPos,
        rating: Math.round(ratingAt(player.attributes, player.primaryPos)),
      });
      // A player the world is following has been sold, not deleted: he turns up
      // somewhere else in the summer and his career carries on without us watching.
      if ((state.world.tracked ?? []).includes(id)) player.clubId = null;
      else delete state.world.players[id];
    }

    // Nobody runs a season a man short. A club replaces what it sold, and a club with
    // money to spend adds one on top.
    const wealthy = club.finances > 62 && rng.chance(0.5);
    const shortfall = Math.max(0, floor - kept.length);
    const arrivals = departures.length + (wealthy ? 1 : 0) + (shortfall > departures.length ? shortfall - departures.length : 0);

    for (let i = 0; i < arrivals; i++) {
      // Buy where the squad is thinnest, which is usually where somebody has just left.
      const position: Position = departures[i]?.position ?? thinnestPosition(kept, state);
      const signing = generatePlayer(rng, index, {
        clubId,
        pos: position,
        age: rng.int(19, 29),
        targetOvr: targetLevelFor(club, rng),
        season,
        countryCode: rng.chance(0.55) ? club.country : pickForeignCountry(rng, index, club),
        squadRole: 'starter',
        taken,
      });
      state.world.players[signing.id] = signing;
      kept.push(signing.id);

      moves.push({
        direction: 'in',
        clubId,
        playerId: signing.id,
        playerName: `${signing.firstName} ${signing.lastName}`,
        fee: valueOf(signing, club, season, index),
        position,
        rating: Math.round(ratingAt(signing.attributes, position)),
      });
    }

    moves.push(...departures);
    state.world.squads[clubId] = kept;
  }

  return moves;
}

/** Half of a squad is local and half is bought from somewhere else. */
function pickForeignCountry(rng: Rng, index: PackIndex, club: Club): string {
  const codes = [...index.countryByCode.keys()].filter((code) => code !== club.country);
  return codes.length > 0 ? rng.pick(codes) : club.country;
}

/** Where the squad is shortest, so a signing lands where one is actually needed. */
function thinnestPosition(squadIds: string[], state: CareerState): Position {
  const counts = new Map<Position, number>();
  for (const id of squadIds) {
    const player = state.world.players[id];
    if (!player) continue;
    counts.set(player.primaryPos, (counts.get(player.primaryPos) ?? 0) + 1);
  }
  const wanted: Position[] = ['GK', 'CB', 'RB', 'LB', 'CDM', 'CM', 'CAM', 'RW', 'LW', 'ST'];
  let thinnest = wanted[0]!;
  for (const position of wanted) {
    if ((counts.get(position) ?? 0) < (counts.get(thinnest) ?? 0)) thinnest = position;
  }
  return thinnest;
}
