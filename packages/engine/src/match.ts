import { Rng, clamp, logistic } from './rng.js';
import { isInvertedWinger, isNaturalWideMan, positionGroup, ratingAt } from './positions.js';
import { NO_INSTRUCTION, halfTimeEffect, type HalfTimeEffect, type HalfTimeInstructionId } from './halftime.js';
import type { Lineup, MinutesOutcome } from './selection.js';
import type {
  Club,
  MatchEvent,
  MatchImportance,
  MatchResult,
  Player,
  Position,
  UserMatchLine,
} from './types.js';

export function poisson(rng: Rng, lambda: number): number {
  if (lambda <= 0) return 0;
  // Knuth's method: fine for the small lambdas football produces.
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng.next();
  } while (p > l);
  return k - 1;
}

/** Squad quality expressed on the same 0-99 scale as OVR. */
export function teamRatingFromSquad(squad: Player[]): number {
  if (squad.length === 0) return 50;
  const rated = squad
    .map((p) => ratingAt(p.attributes, p.primaryPos) + (p.form - 50) * 0.08)
    .sort((a, b) => b - a);
  const eleven = rated.slice(0, 11);
  const sum = eleven.reduce((a, b) => a + b, 0);
  return sum / eleven.length;
}

/**
 * A club's playing level on the same scale as a player's OVR, so a fourth-tier side
 * really is a fourth-tier side when it draws a giant. The old mapping squeezed every
 * club into a narrow band, which is why cup ties and European nights kept ending 1-0
 * instead of the 4-0 the gap deserved.
 */
export function clubRating(club: Club): number {
  return 30 + club.strength * 0.62;
}

/** Worth about half a goal a game, which is what home advantage is actually worth. */
const HOME_ADVANTAGE = 3.4;

/** Expected goals for a side, from the rating gap. */
export function expectedGoals(attackRating: number, defenceRating: number, home: boolean): number {
  const gap = attackRating - defenceRating + (home ? HOME_ADVANTAGE : 0);
  return clamp(1.35 * Math.exp(gap / 22), 0.15, 5.2);
}

export interface UserMatchContext {
  season: number;
  week: number;
  competitionId: string;
  homeClub: Club;
  awayClub: Club;
  userIsHome: boolean;
  userClubSquad: Player[];
  opponentStars: Player[];
  opponentRating: number;
  user: Player;
  lineup: Lineup;
  minutes: MinutesOutcome;
  importance: MatchImportance;
  matchId: string;
  /**
   * How the player turns up: his head, his sharpness, the crowd behind or against
   * him, and the dressing room. 1 is level, below 1 is a player carrying something.
   */
  mental: number;
  /** He is the club's penalty taker, so the ball is his when one is given. */
  penaltyTaker: boolean;
  /**
   * What he was told - or decided - at half time. Read only once the first half is
   * finished, which is what keeps a replayed first half identical.
   */
  instruction?: HalfTimeInstructionId | null;
  /** Play the first half and stop at the whistle, leaving the rest unrolled. */
  stopAtHalfTime?: boolean;
}

/** Weight of a player being the one at the end of a chance. */
function attackWeight(player: Player, slot: Position): number {
  const group = positionGroup(slot);
  const base = group === 'ATT' ? 1 : group === 'MID' ? 0.45 : group === 'DEF' ? 0.12 : 0.005;
  const quality = ratingAt(player.attributes, player.primaryPos) / 60;
  const finishing = 0.6 + player.attributes.finishing / 130;
  const form = 0.8 + player.form / 250;
  return base * quality * finishing * form;
}

function assistWeight(player: Player, slot: Position): number {
  const group = positionGroup(slot);
  const base = group === 'MID' ? 1 : group === 'ATT' ? 0.8 : group === 'DEF' ? 0.35 : 0.02;
  const creative = 0.5 + (player.attributes.vision + player.attributes.passing + player.attributes.crossing) / 400;
  return base * creative * (0.8 + player.form / 250);
}

export interface UserMatchOutcome {
  result: MatchResult;
  events: MatchEvent[];
  line: UserMatchLine;
  /** True if the user picked up a knock during the match. */
  injuryRolled: boolean;
  /** The score at the break: what a half-time decision is actually made on. */
  halfTimeScore: [number, number];
  /**
   * What the second half took out of his legs, as a multiplier on the fatigue a match
   * normally costs. Chasing everything for forty-five minutes is not free.
   */
  fatigueFactor: number;
}

/** One side's chance, already placed in the match. */
interface Chance {
  minute: number;
  forUser: boolean;
}

/** Everything the two halves share, worked out once before either is played. */
interface MatchSetup {
  attackers: { player: Player; slot: Position }[];
  userDefenceRating: number;
  oppDefenceRating: number;
  onPitchFrom: number;
  onPitchTo: number;
  userHome: boolean;
}

/** What the halves write into. */
interface HalfState {
  events: MatchEvent[];
  line: UserMatchLine;
  userGoals: number;
  oppGoals: number;
}

const CONVERSION_BASE = 0.115;

/**
 * Chance-based simulation, used only for matches the user is involved in.
 * The scoreline emerges from resolved chances, which is what makes the
 * narrative events real rather than decorative.
 *
 * The match is played one half at a time, and nothing about the second half is rolled
 * until the first has finished. That is what lets the game stop at the break, ask him
 * a question, and then play the rest out from the same seed: the forty-five minutes he
 * has already watched cannot change under him, whatever he decides in the dressing room.
 */
export function simulateUserMatch(rng: Rng, ctx: UserMatchContext): UserMatchOutcome {
  const userSquadRating = teamRatingFromSquad(ctx.userClubSquad);
  const oppRating = ctx.opponentRating;

  const userHome = ctx.userIsHome;
  const userXg = expectedGoals(userSquadRating, oppRating, userHome);
  const oppXg = expectedGoals(oppRating, userSquadRating, !userHome);

  const totalChances = clamp(Math.round((userXg + oppXg) * 4.2 + rng.range(-2, 2)), 6, 22);
  const userShare = userXg / (userXg + oppXg);
  const userChances = clamp(Math.round(totalChances * userShare), 1, totalChances - 1);
  const oppChances = totalChances - userChances;

  const line: UserMatchLine = {
    played: ctx.minutes.played,
    started: ctx.minutes.started,
    minutes: ctx.minutes.minutes,
    position: ctx.minutes.slot,
    goals: 0,
    assists: 0,
    shots: 0,
    keyPasses: 0,
    tackles: 0,
    saves: 0,
    yellow: 0,
    red: 0,
    rating: 6.0,
    motm: false,
    ...(ctx.minutes.cameOnMinute !== undefined ? { cameOnMinute: ctx.minutes.cameOnMinute } : {}),
    ...(ctx.minutes.offMinute !== undefined ? { offMinute: ctx.minutes.offMinute } : {}),
  };

  // Who can be on the end of a chance for the user's club.
  const attackers = ctx.lineup.starters
    .map((s) => {
      const p = ctx.userClubSquad.find((q) => q.id === s.playerId);
      return p ? { player: p, slot: s.slot } : null;
    })
    .filter((x): x is { player: Player; slot: Position } => x !== null);

  const setup: MatchSetup = {
    attackers,
    userDefenceRating: userSquadRating,
    oppDefenceRating: oppRating,
    onPitchFrom: ctx.minutes.cameOnMinute ?? 0,
    onPitchTo: ctx.minutes.offMinute ?? (ctx.minutes.played ? 90 : 0),
    userHome,
  };

  // The chances, spread across the ninety and shared out between the two sides. Which
  // side gets which minute is shuffled, so a match is not one team's first half and the
  // other team's second.
  const minutes = Array.from({ length: totalChances }, (_, i) => 3 + Math.floor((i * 87) / totalChances));
  const owners = rng.shuffle([
    ...Array.from({ length: userChances }, () => true),
    ...Array.from({ length: oppChances }, () => false),
  ]);
  const chances: Chance[] = minutes.map((minute, i) => ({ minute, forUser: owners[i] ?? true }));

  const half: HalfState = { events: [], line, userGoals: 0, oppGoals: 0 };

  playHalf(rng, ctx, setup, half, 1, chances.filter((c) => c.minute <= 45), NO_INSTRUCTION);
  const halfTimeScore: [number, number] = userHome
    ? [half.userGoals, half.oppGoals]
    : [half.oppGoals, half.userGoals];

  if (ctx.stopAtHalfTime) {
    // The break. Nothing beyond it has been rolled, so the same seed can pick this up
    // again once he has been told - or has decided - what the second half looks like.
    return {
      result: buildResult(ctx, half, setup, ctx.importance),
      events: half.events.slice().sort((a, b) => a.minute - b.minute),
      line,
      injuryRolled: false,
      halfTimeScore,
      fatigueFactor: 1,
    };
  }

  const mods = halfTimeEffect(ctx.instruction);
  const oppGoalsAtBreak = half.oppGoals;
  playHalf(rng, ctx, setup, half, 2, chances.filter((c) => c.minute > 45), mods);
  const cleanSecondHalf = half.oppGoals === oppGoalsAtBreak;

  line.rating = computeRating(rng, ctx, line, half.userGoals, half.oppGoals, mods, cleanSecondHalf);
  line.motm = line.played && line.rating >= 8.3 && (half.userGoals > half.oppGoals || line.goals >= 2);

  const result = buildResult(ctx, half, setup, ctx.importance);
  const injuryRolled =
    ctx.minutes.played && rng.chance(inMatchInjuryChance(ctx.user, ctx.minutes.minutes) * mods.injuryRisk);

  return {
    result,
    events: result.events!,
    line,
    injuryRolled,
    halfTimeScore,
    // Only the second half was played under the instruction, so it is worth half of it.
    fatigueFactor: 1 + (mods.fatigue - 1) * 0.5,
  };
}

function buildResult(
  ctx: UserMatchContext,
  half: HalfState,
  setup: MatchSetup,
  importance: MatchImportance,
): MatchResult {
  const homeGoals = setup.userHome ? half.userGoals : half.oppGoals;
  const awayGoals = setup.userHome ? half.oppGoals : half.userGoals;
  return {
    id: ctx.matchId,
    season: ctx.season,
    week: ctx.week,
    competitionId: ctx.competitionId,
    homeClubId: ctx.homeClub.id,
    awayClubId: ctx.awayClub.id,
    homeGoals,
    awayGoals,
    detailLevel: 1,
    importance,
    userLine: half.line,
    events: half.events.slice().sort((a, b) => a.minute - b.minute),
  };
}

/**
 * Forty-five minutes. Chances first, then the penalty, then the cards, then the colour,
 * then the whistle - in that order every time, so the two halves consume the random
 * stream in a fixed pattern and a replayed first half is the first half he watched.
 */
function playHalf(
  rng: Rng,
  ctx: UserMatchContext,
  setup: MatchSetup,
  half: HalfState,
  which: 1 | 2,
  chances: Chance[],
  mods: HalfTimeEffect,
): void {
  const { line } = half;

  for (const chance of chances) {
    const { minute } = chance;
    const userOnPitch = ctx.minutes.played && minute >= setup.onPitchFrom && minute <= setup.onPitchTo;

    if (chance.forUser) {
      resolveUserChance(rng, ctx, setup, half, minute, userOnPitch, mods);
    } else {
      resolveOpponentChance(rng, ctx, setup, half, minute, userOnPitch, mods);
    }
  }

  // Penalties. Taking them is worth goals over a season and nothing else in football
  // is missed as publicly, which is the whole point of accepting the job.
  if (ctx.penaltyTaker && ctx.minutes.played && rng.chance(0.075 * (ctx.minutes.minutes / 90))) {
    const minute = which === 1 ? rng.int(6, 45) : rng.int(46, 90);
    const nerve = ctx.user.attributes.composure * 0.45 + ctx.user.attributes.finishing * 0.55;
    // A penalty is a shot, on every scoresheet ever printed. Leaving it out gave him
    // match lines with two goals from one shot.
    line.shots++;
    if (rng.chance(clamp(0.6 + nerve / 300 + (ctx.mental - 1) * 0.25, 0.45, 0.95))) {
      half.userGoals++;
      line.goals++;
      half.events.push({
        minute,
        type: 'penaltyScored',
        playerId: ctx.user.id,
        byUser: true,
        detailKey: 'match.event.penaltyScored',
        score: setup.userHome ? [half.userGoals, half.oppGoals] : [half.oppGoals, half.userGoals],
      });
    } else {
      half.events.push({
        minute,
        type: 'penaltyMissed',
        playerId: ctx.user.id,
        byUser: true,
        detailKey: 'match.event.penaltyMissed',
      });
    }
  }

  // Cards, rolled for the half he was actually on the pitch for.
  const minutesThisHalf = minutesOnPitchIn(ctx, setup, which);
  if (minutesThisHalf > 0 && line.red === 0) {
    const discipline = ctx.user.personality.discipline;
    const group = positionGroup(ctx.minutes.slot ?? ctx.user.primaryPos);
    const cardBase = group === 'DEF' ? 0.16 : group === 'MID' ? 0.13 : group === 'ATT' ? 0.07 : 0.03;
    const yellowP = clamp(cardBase * (1.4 - discipline / 100) * (minutesThisHalf / 90) * mods.cardRisk, 0.003, 0.4);
    const from = which === 1 ? 8 : 47;
    const to = which === 1 ? 45 : 90;
    if (rng.chance(yellowP)) {
      line.yellow++;
      half.events.push({
        minute: rng.int(from, to), type: 'yellow', playerId: ctx.user.id,
        byUser: true, detailKey: 'match.event.yellow',
      });
      // A second yellow can only follow a first, and the first is usually behind him.
      if (line.yellow >= 2 && rng.chance(0.35)) {
        line.red = 1;
        half.events.push({
          minute: rng.int(from, to), type: 'red', playerId: ctx.user.id,
          byUser: true, detailKey: 'match.event.secondYellow',
        });
      }
    } else if (rng.chance(0.003)) {
      line.red = 1;
      half.events.push({
        minute: rng.int(from, to), type: 'red', playerId: ctx.user.id,
        byUser: true, detailKey: 'match.event.straightRed',
      });
    }
  }

  addBroadcastEvents(rng, ctx, setup, half.events, which, mods);
}

/** How much of this half he was on the pitch for. */
function minutesOnPitchIn(ctx: UserMatchContext, setup: MatchSetup, which: 1 | 2): number {
  if (!ctx.minutes.played) return 0;
  const start = which === 1 ? 0 : 45;
  const end = which === 1 ? 45 : 90;
  const from = Math.max(start, setup.onPitchFrom);
  const to = Math.min(end, setup.onPitchTo);
  return Math.max(0, to - from);
}

function resolveUserChance(
  rng: Rng,
  ctx: UserMatchContext,
  setup: MatchSetup,
  half: HalfState,
  minute: number,
  userOnPitch: boolean,
  mods: HalfTimeEffect,
): void {
  const { line } = half;
  const picked = rng.weighted(setup.attackers, (a) => attackWeight(a.player, a.slot));
  if (!picked) return;

  // If the user is on the pitch, they get their positional share of involvement.
  const shooter = userOnPitch
    && rng.chance(
      userInvolvementChance(ctx.user, ctx.minutes.slot, ctx.mental) * mods.involvement
      * shootingBias(ctx) * mods.shooting,
    )
    ? { player: ctx.user, slot: ctx.minutes.slot ?? ctx.user.primaryPos }
    : picked;

  const isUser = shooter.player.id === ctx.user.id;
  const finishing = shooter.player.attributes.finishing;
  const composure = shooter.player.attributes.composure;
  const rawQuality = finishing * 0.6 + composure * 0.25 + shooter.player.attributes.shooting * 0.15;
  // Confidence is worth a few points of finishing either way.
  const quality = isUser ? rawQuality * (0.88 + ctx.mental * 0.12) : rawQuality;
  const p = clamp(CONVERSION_BASE * (0.5 + logistic((quality - setup.oppDefenceRating) / 12) * 1.6), 0.03, 0.55);

  if (isUser) line.shots++;

  if (rng.chance(p)) {
    half.userGoals++;
    if (isUser) line.goals++;
    let assistId: string | undefined;
    if (rng.chance(0.68)) {
      const creators = setup.attackers.filter((a) => a.player.id !== shooter.player.id);
      const userCanAssist = userOnPitch && !isUser
        && rng.chance(
          userInvolvementChance(ctx.user, ctx.minutes.slot, ctx.mental) * mods.involvement
          * 1.35 * creatingBias(ctx) * mods.creating,
        );
      const creator = userCanAssist
        ? { player: ctx.user, slot: ctx.minutes.slot ?? ctx.user.primaryPos }
        : rng.weighted(creators, (a) => assistWeight(a.player, a.slot));
      if (creator) {
        assistId = creator.player.id;
        if (creator.player.id === ctx.user.id) line.assists++;
      }
    }
    half.events.push({
      minute,
      type: 'goal',
      playerId: shooter.player.id,
      byUser: isUser,
      detailKey: isUser ? 'match.event.userGoal' : 'match.event.teamGoal',
      score: setup.userHome ? [half.userGoals, half.oppGoals] : [half.oppGoals, half.userGoals],
    });
    if (assistId) {
      half.events.push({
        minute,
        type: 'assist',
        playerId: assistId,
        byUser: assistId === ctx.user.id,
        detailKey: 'match.event.assist',
      });
    }
  } else if (isUser) {
    const near = rng.chance(0.45);
    half.events.push({
      minute,
      type: near ? 'miss' : 'save',
      playerId: ctx.user.id,
      byUser: true,
      detailKey: near ? 'match.event.userMiss' : 'match.event.userSaved',
    });
  } else if (userOnPitch && rng.chance(0.6)) {
    // The user was involved in the build-up even when someone else finished.
    const involved = rng.chance(
      userInvolvementChance(ctx.user, ctx.minutes.slot, ctx.mental) * mods.involvement * 0.8 * mods.creating,
    );
    if (involved) line.keyPasses++;
  }
}

function resolveOpponentChance(
  rng: Rng,
  ctx: UserMatchContext,
  setup: MatchSetup,
  half: HalfState,
  minute: number,
  userOnPitch: boolean,
  mods: HalfTimeEffect,
): void {
  const { line } = half;
  const slot = ctx.minutes.slot ?? ctx.user.primaryPos;
  const group = positionGroup(slot);

  const shooterRating = setup.oppDefenceRating + rng.gauss(0, 6);
  const p = clamp(
    CONVERSION_BASE * (0.5 + logistic((shooterRating - setup.userDefenceRating) / 12) * 1.6),
    0.03,
    0.55,
  );

  // Defensive involvement: keepers save, defenders intervene.
  if (userOnPitch && group === 'GK') {
    const saveSkill = ctx.user.attributes.reflexes * 0.5 + ctx.user.attributes.positioningGK * 0.3 + ctx.user.attributes.handling * 0.2;
    const adjusted = clamp(p * (1 - (saveSkill - 50) / 160) / mods.defending, 0.02, 0.6);
    if (rng.chance(adjusted)) {
      half.oppGoals++;
      half.events.push({ minute, type: 'concede', playerId: ctx.user.id, byUser: true, detailKey: 'match.event.conceded' });
    } else {
      line.saves++;
      half.events.push({ minute, type: 'save', playerId: ctx.user.id, byUser: true, detailKey: 'match.event.userSave' });
    }
    return;
  }

  if (userOnPitch && group === 'DEF' && rng.chance(clamp(0.45 * mods.defending, 0.1, 0.9))) {
    const defSkill = ctx.user.attributes.tackling * 0.4 + ctx.user.attributes.marking * 0.35 + ctx.user.attributes.positioning * 0.25;
    if (rng.chance(clamp(0.35 + (defSkill - setup.oppDefenceRating) / 90, 0.1, 0.85) * mods.defending)) {
      line.tackles++;
      half.events.push({ minute, type: 'tackle', playerId: ctx.user.id, byUser: true, detailKey: 'match.event.userTackle' });
      return;
    }
  }

  // A midfielder who has been told to chase everything gets in the way of some of it.
  if (userOnPitch && group === 'MID' && mods.defending > 1 && rng.chance(clamp((mods.defending - 1) * 0.6, 0, 0.4))) {
    line.tackles++;
    half.events.push({ minute, type: 'tackle', playerId: ctx.user.id, byUser: true, detailKey: 'match.event.userTackle' });
    return;
  }

  if (rng.chance(p)) {
    half.oppGoals++;
    const scorer = ctx.opponentStars.length > 0
      ? rng.weighted(ctx.opponentStars, (s) => attackWeight(s, s.primaryPos))
      : null;
    half.events.push({
      minute,
      type: 'concede',
      playerId: scorer?.id,
      byUser: false,
      detailKey: 'match.event.oppGoal',
      score: setup.userHome ? [half.userGoals, half.oppGoals] : [half.oppGoals, half.userGoals],
    });
  }
}

/**
 * Colour for a match you watch rather than read: corners, free kicks, balls flashing
 * across the six-yard box, the moment you came off. None of it touches the scoreline -
 * that has already emerged from the chances - but ninety minutes with nothing but two
 * goals in it is not a match, it is a result.
 *
 * Generated one half at a time, so the first half he watches at the break is the first
 * half he watches again afterwards.
 */
function addBroadcastEvents(
  rng: Rng,
  ctx: UserMatchContext,
  setup: MatchSetup,
  events: MatchEvent[],
  which: 1 | 2,
  mods: HalfTimeEffect,
): void {
  const played = ctx.minutes.played;
  const from = setup.onPitchFrom;
  const to = setup.onPitchTo;
  const start = which === 1 ? 2 : 46;
  const end = which === 1 ? 44 : 89;

  const push = (minute: number, type: MatchEvent['type'], key: string, byUser = false) => {
    events.push({ minute, type, byUser, detailKey: key, ambient: true, playerId: byUser ? ctx.user.id : undefined });
  };

  if (which === 1) {
    push(0, 'kickOff', 'match.live.kickOff');
  }

  const cameOn = ctx.minutes.cameOnMinute;
  if (played && cameOn && inHalf(cameOn, which)) {
    events.push({
      minute: cameOn, type: 'sub-on', byUser: true,
      playerId: ctx.user.id, detailKey: 'match.live.subOn',
    });
  }
  const cameOff = ctx.minutes.offMinute;
  if (played && cameOff && cameOff < 90 && inHalf(cameOff, which)) {
    events.push({
      minute: cameOff, type: 'sub-off', byUser: true,
      playerId: ctx.user.id, detailKey: 'match.live.subOff',
    });
  }

  // Neutral beats, and beats the user is at the centre of while he is on the pitch.
  const neutral: [MatchEvent['type'], string][] = [
    ['corner', 'match.live.corner'],
    ['freeKick', 'match.live.freeKick'],
    ['offside', 'match.live.offside'],
    ['chance', 'match.live.chance'],
    ['oppMiss', 'match.live.oppWide'],
    ['oppMiss', 'match.live.oppSaved'],
    ['corner', 'match.live.cornerOpp'],
    ['chance', 'match.live.scramble'],
  ];
  const mine: [MatchEvent['type'], string][] = [
    ['chance', 'match.live.userDribble'],
    ['chance', 'match.live.userPass'],
    ['freeKick', 'match.live.userFouled'],
    ['corner', 'match.live.userCorner'],
    ['chance', 'match.live.userPress'],
    ['woodwork', 'match.live.userWoodwork'],
    ['chance', 'match.live.userHeader'],
    ['chance', 'match.live.userDuel'],
  ];

  const count = rng.int(5, 7);
  const used = new Set(events.filter((e) => e.ambient && e.detailKey).map((e) => e.detailKey!));
  for (let i = 0; i < count; i++) {
    const minute = rng.int(start, end);
    const onPitch = played && minute >= from && minute <= to;
    const involvement = onPitch
      ? userInvolvementChance(ctx.user, ctx.minutes.slot, ctx.mental) * mods.involvement * 1.6
      : 0;
    const pool = rng.chance(clamp(involvement, 0, 0.65)) ? mine : neutral;
    // Do not run the same line twice in one match; there are enough to go round.
    let pick = pool[rng.int(0, pool.length - 1)]!;
    for (let tries = 0; tries < 3 && used.has(pick[1]); tries++) pick = pool[rng.int(0, pool.length - 1)]!;
    if (used.has(pick[1])) continue;
    used.add(pick[1]);
    push(minute, pick[0], pick[1], pool === mine);
  }

  push(which === 1 ? 45 : 90, which === 1 ? 'halfTime' : 'fullTime',
    which === 1 ? 'match.live.halfTime' : 'match.live.fullTime');
}

function inHalf(minute: number, which: 1 | 2): boolean {
  return which === 1 ? minute <= 45 : minute > 45;
}

/**
 * A left-footer on the right comes inside and shoots; a right-footer on the right gets
 * to the line and puts it in the box. Same position, different afternoon.
 */
function shootingBias(ctx: UserMatchContext): number {
  const slot = ctx.minutes.slot ?? ctx.user.primaryPos;
  if (isInvertedWinger(ctx.user.foot, slot)) return 1.35;
  if (isNaturalWideMan(ctx.user.foot, slot) && (slot === 'RW' || slot === 'LW' || slot === 'RM' || slot === 'LM')) return 0.85;
  return 1;
}

function creatingBias(ctx: UserMatchContext): number {
  const slot = ctx.minutes.slot ?? ctx.user.primaryPos;
  if (isNaturalWideMan(ctx.user.foot, slot) && (slot === 'RW' || slot === 'LW' || slot === 'RM' || slot === 'LM' || slot === 'RB' || slot === 'LB' || slot === 'RWB' || slot === 'LWB')) return 1.35;
  if (isInvertedWinger(ctx.user.foot, slot)) return 0.85;
  return 1;
}

/** How often the ball finds the user, given where they play. */
function userInvolvementChance(user: Player, slot: Position | null, mental = 1): number {
  const group = positionGroup(slot ?? user.primaryPos);
  const base = group === 'ATT' ? 0.44 : group === 'MID' ? 0.30 : group === 'DEF' ? 0.10 : 0.01;
  const quality = clamp(ratingAt(user.attributes, slot ?? user.primaryPos) / 90, 0.4, 1.25);
  // A player who is off his game asks for the ball less and gets it less.
  return clamp(base * quality * (0.85 + user.form / 320) * mental, 0.01, 0.6);
}

function inMatchInjuryChance(user: Player, minutes: number): number {
  const fatigue = user.condition.fatigue;
  const historyCount = user.condition.injuryHistory.length;
  const base = 0.012 + fatigue / 2600 + historyCount * 0.0016;
  const durability = (user.attributes.strength + user.attributes.balance) / 2;
  return clamp(base * (1.35 - durability / 160) * (minutes / 90), 0.001, 0.14);
}

/**
 * Match rating, weighted by position. A centre back is not judged on goals.
 */
/**
 * How much the occasion magnifies what he did. On a normal afternoon a decent game is
 * a 7; in a derby the same game is remembered as more, and a bad one as worse.
 */
function occasionWeight(importance: MatchImportance): number {
  switch (importance) {
    case 'cupFinal': return 1.45;
    case 'titleDecider': return 1.4;
    case 'derby': return 1.35;
    case 'europeanNight': return 1.3;
    case 'cupSemi': return 1.28;
    case 'rival': return 1.22;
    case 'relegationSixPointer': return 1.22;
    case 'firstProMatch': return 1.15;
    case 'debut': return 1.15;
    default: return 1;
  }
}

function computeRating(
  rng: Rng,
  ctx: UserMatchContext,
  line: UserMatchLine,
  teamGoals: number,
  oppGoals: number,
  mods: HalfTimeEffect,
  cleanSecondHalf: boolean,
): number {
  if (!line.played) return 0;
  const group = positionGroup(line.position ?? ctx.user.primaryPos);
  const ovr = ratingAt(ctx.user.attributes, line.position ?? ctx.user.primaryPos);

  // Baseline drifts with quality relative to the level of the game.
  // 6.5 is a competent, unremarkable afternoon; everything else moves from there.
  let rating = 6.5 + (ovr - ctx.opponentRating) / 40 + (ctx.user.form - 50) / 160;
  rating += rng.gauss(0, 0.42) * (1.4 - ctx.user.personality.consistency / 140) * mods.variance;


  if (group === 'GK') {
    rating += line.saves * 0.22;
    rating -= oppGoals * 0.34;
    if (oppGoals === 0 && line.minutes >= 60) rating += 0.7;
  } else if (group === 'DEF') {
    rating += line.tackles * 0.16;
    rating -= oppGoals * 0.22;
    if (oppGoals === 0 && line.minutes >= 60) rating += 0.6;
    rating += line.goals * 1.1 + line.assists * 0.7;
  } else if (group === 'MID') {
    rating += line.keyPasses * 0.14 + line.tackles * 0.1;
    rating += line.goals * 1.0 + line.assists * 0.8;
    rating -= oppGoals * 0.08;
  } else {
    rating += line.goals * 1.15 + line.assists * 0.75 + line.keyPasses * 0.1;
    if (line.goals === 0 && line.shots >= 3) rating -= 0.35;
  }

  if (teamGoals > oppGoals) rating += 0.25;
  else if (teamGoals < oppGoals) rating -= 0.2;

  rating -= line.yellow * 0.12 + line.red * 1.1;

  // Doing the unglamorous job he was given, and it working. A defensive instruction
  // that produced a clean forty-five minutes is a good half even without a goal in it.
  if (mods.defending > 1 && cleanSecondHalf && line.minutes >= 30) rating += 0.3;
  // Running himself into the ground shows up in the marks even when nothing comes of it.
  if (mods.fatigue > 1.2 && line.minutes >= 45) rating += 0.15;

  // A cameo can't earn a 9 - or a 4. Short outings pull toward the average.
  if (line.minutes < 30) rating = 6.0 + (rating - 6.0) * 0.5;
  else if (line.minutes < 60) rating = 6.0 + (rating - 6.0) * 0.8;

  // The big ones count for more, in both directions.
  const occasion = occasionWeight(ctx.importance);
  if (occasion > 1) rating = 6.4 + (rating - 6.4) * occasion;

  return clamp(Math.round(rating * 10) / 10, 3.0, 10.0);
}

export interface QuickMatchInput {
  homeRating: number;
  awayRating: number;
}

/** Result-only simulation for matches the user is not in. */
export function simulateQuickResult(rng: Rng, input: QuickMatchInput): [number, number] {
  const homeXg = expectedGoals(input.homeRating, input.awayRating, true);
  const awayXg = expectedGoals(input.awayRating, input.homeRating, false);
  return [poisson(rng, homeXg), poisson(rng, awayXg)];
}
