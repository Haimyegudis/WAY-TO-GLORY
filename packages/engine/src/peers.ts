/**
 * The other boys.
 *
 * Everybody else in this world was scenery. Team-mates were generated, aged, developed
 * and deleted; a player sold in the summer window stopped existing; the world's stars
 * were rows in a data pack with no seasons behind them. So the one comparison every
 * young footballer actually lives by - the lad he came through the academy with, who is
 * now playing in a better league than he is - could not exist, because that lad was
 * thrown away the first time a squad list was rebuilt.
 *
 * A tracked player is one the world promises to keep: he ages, he develops, he moves
 * clubs, he has a season recorded every year and a career that adds up, and he is never
 * deleted to save memory. There are only a handful of them - the boys from his own age
 * group and the best young players in his first division - because that is all a career
 * needs. They are the yardstick.
 *
 * Where the world simulates their division in detail their record is what actually
 * happened. Where it does not - a boy who moved abroad at nineteen - it is an estimate
 * from the level he plays at, which is exactly what a player back home would have: a
 * number in a newspaper, not a match report.
 */
import { Rng, clamp } from './rng.js';
import { developWeek } from './development.js';
import { clubBaseOvr } from './generate.js';
import { positionGroup, ratingAt } from './positions.js';
import type { PackIndex } from './data.js';
import type { CareerState, Club, Player, PlayerCareer } from './types.js';

/** How many of his own year the world keeps hold of. */
export const TRACKED_PEERS = 8;

export function emptyCareer(season: number): PlayerCareer {
  return { firstSeason: season, apps: 0, goals: 0, assists: 0, trophies: 0, peakOvr: 0, spells: [] };
}

/** Add a season to a career, merging it into the spell at the club he played it for. */
export function recordSeason(
  career: PlayerCareer,
  season: number,
  clubId: string,
  line: { apps: number; goals: number; assists: number; ovr: number; trophies?: number },
): void {
  career.apps += line.apps;
  career.goals += line.goals;
  career.assists += line.assists;
  career.trophies += line.trophies ?? 0;
  career.peakOvr = Math.max(career.peakOvr, Math.round(line.ovr));

  const last = career.spells[career.spells.length - 1];
  if (last && last.clubId === clubId) {
    last.toSeason = season;
    last.apps += line.apps;
    last.goals += line.goals;
    return;
  }
  career.spells.push({ clubId, fromSeason: season, toSeason: season, apps: line.apps, goals: line.goals });
  // A twenty-season career at eight clubs is eight rows. Nobody needs more than that.
  if (career.spells.length > 12) career.spells.splice(0, career.spells.length - 12);
}

/**
 * A season nobody watched, estimated from the level he is playing at.
 *
 * Only the user's own division is simulated player by player. For everybody else this is
 * the same arithmetic a supporter does in his head: a player well above his club's level
 * plays every week and scores what his position scores, one below it does not get in.
 */
export function estimateSeason(rng: Rng, player: Player, club: Club): { apps: number; goals: number; assists: number } {
  const ovr = ratingAt(player.attributes, player.primaryPos);
  const share = clamp(0.35 + (ovr - clubBaseOvr(club)) / 18, 0.04, 0.95);
  const apps = Math.round(share * rng.range(26, 36));
  const group = positionGroup(player.primaryPos);
  const per90 = group === 'ATT' ? 0.42 : group === 'MID' ? 0.16 : group === 'DEF' ? 0.05 : 0;
  const quality = 0.6 + ovr / 120;
  const goals = Math.max(0, Math.round(apps * per90 * quality * rng.range(0.6, 1.45)));
  const assists = Math.max(0, Math.round(apps * per90 * 0.6 * quality * rng.range(0.5, 1.5)));
  return { apps, goals, assists };
}

/** Whether the world is under orders to keep this player for good. */
export function isTracked(state: CareerState, playerId: string): boolean {
  return (state.world.tracked ?? []).includes(playerId);
}

/**
 * The ceiling on how many people the world carries. His own year is eight; the rest of
 * the room is for the men a career runs into - the one they bought to replace him, most
 * of all - and past sixteen it is a database rather than a story.
 */
export const TRACKED_LIMIT = 16;

/** Follow somebody the career has run into: a rival for his shirt, a name in the paper. */
export function followPlayer(state: CareerState, playerId: string): boolean {
  const player = state.world.players[playerId];
  if (!player || player.isUser) return false;
  if ((state.world.tracked ?? []).length >= TRACKED_LIMIT) return false;
  trackPlayer(state, player, state.world.season);
  return true;
}

export function trackPlayer(state: CareerState, player: Player, season: number): void {
  state.world.tracked = state.world.tracked ?? [];
  if (state.world.tracked.includes(player.id)) return;
  player.tracked = true;
  player.career = player.career ?? emptyCareer(season);
  state.world.tracked.push(player.id);
  state.world.players[player.id] = player;
}

/**
 * His year.
 *
 * Picked once, from the boys he actually played against on Sunday mornings: the best of
 * his own age group and division. They are the ones a career is measured against, so
 * they are chosen on promise rather than on what they are worth today.
 */
export function trackHisYear(rng: Rng, state: CareerState): void {
  const youth = state.world.youth;
  if (!youth) return;
  const season = state.world.season;
  const age = season - state.player.birthYear;

  const candidates = Object.values(youth.players)
    .filter((boy) => boy.id !== state.player.id && Math.abs(season - boy.birthYear - age) <= 1)
    .map((boy) => ({ boy, promise: boy.potential + ratingAt(boy.attributes, boy.primaryPos) * 0.35 }))
    .sort((a, b) => b.promise - a.promise);

  for (const { boy } of candidates.slice(0, TRACKED_PEERS)) {
    if ((state.world.tracked ?? []).length >= TRACKED_PEERS) break;
    // He keeps the club he was at as a boy until somebody moves him.
    trackPlayer(state, { ...boy, tracked: true, career: emptyCareer(season) }, season);
  }
  void rng;
}

/**
 * A year in the life of everybody the world is keeping.
 *
 * They train, they age, they have a season, and in the summer somebody either comes for
 * them or lets them go. None of it is watched, all of it is written down, and by the
 * time he is twenty-five the boy he used to beat in training has three hundred games
 * somewhere and a record he can be compared with.
 */
export function advanceTrackedPlayers(rng: Rng, state: CareerState, index: PackIndex): void {
  const ids = state.world.tracked ?? [];
  if (ids.length === 0) return;
  const season = state.world.season;
  const alive: string[] = [];

  for (const id of ids) {
    const player = state.world.players[id];
    if (!player || player.isUser) continue;
    const age = season - player.birthYear;
    const club = player.clubId ? state.world.clubs[player.clubId] : undefined;

    /*
     * The careers that end early, which is most of them.
     *
     * A boy who is a division below the worst club in this world at twenty-two is not a
     * professional footballer any more, whatever his academy thought of him at fifteen.
     * Those careers stop, and the record of the eleven games he did play stays where the
     * player can see it - because that is the more likely version of his own story and
     * the game should not hide it from him.
     */
    const belowTheGame = club
      ? ratingAt(player.attributes, player.primaryPos) < clubBaseOvr(club) - 11
      : false;
    if (age >= 22 && belowTheGame && rng.chance(0.4)) {
      player.retired = true;
      player.career = player.career ?? emptyCareer(season);
      player.career.retiredSeason = season;
      alive.push(id);
      continue;
    }

    // Thirty-five and nobody is ringing. A tracked career ends the way any other does,
    // and the record it leaves behind is the point of having kept it.
    if (age >= 35 || (player.retired && age >= 30)) {
      player.retired = true;
      player.career = player.career ?? emptyCareer(season);
      player.career.retiredSeason = player.career.retiredSeason ?? season;
      alive.push(id);
      continue;
    }

    if (club) {
      player.career = player.career ?? emptyCareer(season);
      const modelled = state.world.competitions[club.competitionId];
      const goalsInWorld = modelled?.scorers[id];
      const line = goalsInWorld !== undefined
        // His division is simulated: this is what he actually did in it.
        ? {
          apps: Math.round(clamp(0.3 + (ratingAt(player.attributes, player.primaryPos) - clubBaseOvr(club)) / 22, 0.05, 0.95) * 34),
          goals: goalsInWorld,
          assists: modelled?.assists?.[id] ?? 0,
        }
        : estimateSeason(rng, player, club);
      const wonIt = state.world.history.champions
        .some((record) => record.season === season && record.clubId === club.id);
      recordSeason(player.career, season, club.id, {
        ...line,
        ovr: ratingAt(player.attributes, player.primaryPos),
        trophies: wonIt ? 1 : 0,
      });

      // A season of development, the same coarse pass the rest of the world gets.
      for (let week = 0; week < 30; week++) {
        developWeek(rng, player, season, {
          training: { intensity: 'normal', focus: 'balanced', diet: 'professional' },
          coachQuality: club.training,
          facilities: club.academy,
          minutesPct: clamp(line.apps / 34, 0.05, 0.95),
          competitiveLevel: index.competitionById.get(club.competitionId)?.reputation ?? 40,
          inSeason: true,
        });
      }
    }

    // The summer. A boy who has outgrown where he is gets bought, and one who has not
    // gets moved on - and either way he is still somebody the world knows about.
    const moved = maybeMove(rng, state, player);
    if (moved) player.clubId = moved.id;
    /*
     * And nobody is left standing in the street.
     *
     * A tracked player sold out of the modelled world had his club set to nothing and
     * waited for the next summer to roll a move, so the table could show a
     * thirty-four year old at no club who had not retired either. Without a club he
     * either signs for somebody now or that is his career.
     */
    if (!player.clubId) {
      const home = maybeMove(rng, state, player) ?? nearestClub(state, player);
      if (home) player.clubId = home.id;
      else {
        player.retired = true;
        player.career = player.career ?? emptyCareer(season);
        player.career.retiredSeason = player.career.retiredSeason ?? season;
      }
    }
    alive.push(id);
  }

  state.world.tracked = alive;
}

/** The club in this world closest to the level he is playing at. */
function nearestClub(state: CareerState, player: Player): Club | null {
  const ovr = ratingAt(player.attributes, player.primaryPos);
  const clubs = Object.values(state.world.clubs);
  if (clubs.length === 0) return null;
  return clubs
    .slice()
    .sort((a, b) => Math.abs(clubBaseOvr(a) - ovr) - Math.abs(clubBaseOvr(b) - ovr))[0]!;
}

/**
 * Where a tracked player goes in the summer, if anywhere.
 *
 * Two kinds of move, and the second one is the one that makes these careers read like
 * careers: a boy who has outgrown his club is bought, and a boy who cannot get in the
 * side drops a level until he can. Without the second, half of his year spent fifteen
 * years registered at clubs they never played for.
 */
function maybeMove(rng: Rng, state: CareerState, player: Player): Club | null {
  const club = player.clubId ? state.world.clubs[player.clubId] : undefined;
  const age = state.world.season - player.birthYear;
  // Nobody is transferred at sixteen; he is in an academy, which is where he should be.
  if (age < 17) return null;
  const ovr = ratingAt(player.attributes, player.primaryPos);
  const level = club ? clubBaseOvr(club) : 0;
  const outgrown = club ? ovr - level : 99;
  const chance = outgrown >= 6 ? clamp((outgrown - 5) / 12, 0.1, 0.6)
    : outgrown <= -5 ? 0.55
    : 0.06;
  if (!rng.chance(chance)) return null;

  // A move has to be a real one: a club at about the level he has grown into, or one a
  // step down where he will actually be picked.
  const wanted = clamp(ovr + (outgrown >= 6 ? rng.range(-2, 4) : rng.range(-6, -1)), 20, 95);
  const others = Object.values(state.world.clubs).filter((candidate) => candidate.id !== player.clubId);
  if (others.length === 0) return null;
  const options = others.filter((candidate) => Math.abs(clubBaseOvr(candidate) - wanted) <= 5);
  if (options.length > 0) return rng.pick(options);
  // Nothing at his level, so the nearest thing to it. The bottom of this world is a
  // professional club, and a player below that is a player on his way out of the game.
  return others.slice().sort((a, b) => Math.abs(clubBaseOvr(a) - wanted) - Math.abs(clubBaseOvr(b) - wanted))[0]!;
}

export interface PeerLine {
  playerId: string;
  name: string;
  age: number;
  clubId: string | null;
  clubName: string;
  ovr: number;
  apps: number;
  goals: number;
  trophies: number;
  retired: boolean;
  /** True when his career is ahead of the player's on the only measure that travels. */
  aheadOfYou: boolean;
  /** One of the boys he came through with, rather than somebody he ran into later. */
  sameYear: boolean;
}

/**
 * The table he cannot stop looking at: the boys from his year, where they ended up, and
 * whether they are ahead of him.
 */
/**
 * What one of them has done so far this season.
 *
 * A career was only added up in the summer, so from August to May the table said every
 * boy he came through with had played nothing - and in his first year, that everybody
 * including him had a career of zeros. Where his division is modelled the goals are the
 * real ones; where it is not, it is the arithmetic a supporter does: he is playing this
 * often at that level, so by March it is about this many.
 */
function liveSeason(state: CareerState, player: Player): { apps: number; goals: number; assists: number } {
  const club = player.clubId ? state.world.clubs[player.clubId] : undefined;
  if (!club) return { apps: 0, goals: 0, assists: 0 };

  const modelled = state.world.competitions[club.competitionId]
    ?? state.world.youth?.competitions[state.world.youth.membership[club.id] ?? ''];
  const played = (modelled?.fixtures ?? []).filter(
    (fixture) => fixture.played && (fixture.homeClubId === club.id || fixture.awayClubId === club.id),
  ).length;
  const ovr = ratingAt(player.attributes, player.primaryPos);
  const share = clamp(0.3 + (ovr - clubBaseOvr(club)) / 22, 0.05, 0.95);

  if (modelled) {
    return {
      apps: Math.round(share * played),
      goals: modelled.scorers[player.id] ?? 0,
      assists: modelled.assists?.[player.id] ?? 0,
    };
  }

  // Nobody is watching his league. Count the weeks instead of the matches.
  const rounds = clamp(Math.round((state.world.week - 3) * 0.8), 0, 34);
  const apps = Math.round(share * rounds);
  const group = positionGroup(player.primaryPos);
  const per90 = group === 'ATT' ? 0.42 : group === 'MID' ? 0.16 : group === 'DEF' ? 0.05 : 0;
  const quality = 0.6 + ovr / 120;
  return {
    apps,
    goals: Math.round(apps * per90 * quality),
    assists: Math.round(apps * per90 * 0.6 * quality),
  };
}

export function peerTable(state: CareerState): PeerLine[] {
  const season = state.world.season;
  const mine = state.seasonHistory.reduce((sum, record) => sum + record.apps, 0)
    + (state.world.seasonStats[state.player.id]?.apps ?? 0);
  const myGoals = state.seasonHistory.reduce((sum, record) => sum + record.goals, 0)
    + (state.world.seasonStats[state.player.id]?.goals ?? 0);
  const myScore = mine + myGoals * 3;

  return (state.world.tracked ?? [])
    .map((id) => state.world.players[id])
    .filter((player): player is Player => Boolean(player))
    .map((player) => {
      const club = player.clubId ? state.world.clubs[player.clubId] : undefined;
      const career = player.career ?? emptyCareer(season);
      // The season nobody has filed yet counts too - his does.
      const now = player.retired ? { apps: 0, goals: 0, assists: 0 } : liveSeason(state, player);
      const apps = career.apps + now.apps;
      const goals = career.goals + now.goals;
      return {
        playerId: player.id,
        name: `${player.firstName} ${player.lastName}`,
        age: season - player.birthYear,
        clubId: club?.id ?? null,
        clubName: club?.name ?? '',
        ovr: ratingAt(player.attributes, player.primaryPos),
        apps,
        goals,
        trophies: career.trophies,
        retired: Boolean(player.retired),
        aheadOfYou: apps + goals * 3 > myScore,
        sameYear: Math.abs(player.birthYear - state.player.birthYear) <= 1,
      };
    })
    .sort((a, b) => b.apps + b.goals * 3 - (a.apps + a.goals * 3));
}
