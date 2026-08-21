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
  source: 'openPlay' | 'corner' | 'freeKick';
}

/** Everything the two halves share, worked out once before either is played. */
interface MatchSetup {
  attackers: { player: Player; slot: Position }[];
  userDefenceRating: number;
  oppDefenceRating: number;
  userGoalkeeperRating: number;
  oppGoalkeeperRating: number;
  onPitchFrom: number;
  onPitchTo: number;
  userHome: boolean;
  userSecondHalfEnergy: number;
  oppSecondHalfEnergy: number;
}

/** What the halves write into. */
interface HalfState {
  events: MatchEvent[];
  line: UserMatchLine;
  userGoals: number;
  oppGoals: number;
  /** The minute he got hurt, if he did. His afternoon ends there. */
  userInjuredAt?: number;
  /** A dismissal changes both eligibility and the strength of his ten-man team. */
  userSentOffAt?: number;
  /** Earliest unplanned exit; planned substitutions remain in MatchSetup. */
  userUnavailableAt?: number;
  /** Dismissals elsewhere on the pitch alter every later chance. */
  userTeamRedAt?: number;
  opponentRedAt?: number;
}

type MatchMoment =
  | { minute: number; order: number; kind: 'chance'; chance: Chance }
  | { minute: number; order: number; kind: 'penalty' }
  | { minute: number; order: number; kind: 'yellow' | 'secondYellow' | 'straightRed' | 'injury' }
  | { minute: number; order: number; kind: 'teamRed' | 'opponentRed' | 'teamSub' | 'opponentSub' };

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
    .filter((x): x is { player: Player; slot: Position } => x !== null)
    // The user is inserted explicitly only while actually on the pitch. Keeping him in
    // this fallback pool was how a substituted player could score or assist afterwards.
    .filter((x) => x.player.id !== ctx.user.id);

  const userGoalkeeper = ctx.userClubSquad.find((player) => player.primaryPos === 'GK');
  const opponentGoalkeeper = ctx.opponentStars.find((player) => player.primaryPos === 'GK');

  const setup: MatchSetup = {
    attackers,
    userDefenceRating: userSquadRating,
    oppDefenceRating: oppRating,
    userGoalkeeperRating: userGoalkeeper
      ? ratingAt(userGoalkeeper.attributes, 'GK')
      : userSquadRating,
    oppGoalkeeperRating: opponentGoalkeeper
      ? ratingAt(opponentGoalkeeper.attributes, 'GK')
      : oppRating,
    onPitchFrom: ctx.minutes.cameOnMinute ?? 0,
    onPitchTo: ctx.minutes.offMinute ?? (ctx.minutes.played ? 90 : 0),
    userHome,
    userSecondHalfEnergy: benchEnergy(ctx.userClubSquad, ctx.lineup.bench),
    oppSecondHalfEnergy: opponentBenchEnergy(ctx.opponentStars, oppRating),
  };

  // The chances, spread across the ninety and shared out between the two sides. Which
  // side gets which minute is shuffled, so a match is not one team's first half and the
  // other team's second.
  const minutes = Array.from({ length: totalChances }, (_, i) => 3 + Math.floor((i * 87) / totalChances));
  const owners = rng.shuffle([
    ...Array.from({ length: userChances }, () => true),
    ...Array.from({ length: oppChances }, () => false),
  ]);
  const chances: Chance[] = minutes.map((minute, i) => {
    const setPieceRoll = rng.next();
    return {
      minute,
      forUser: owners[i] ?? true,
      source: setPieceRoll < 0.14 ? 'corner' : setPieceRoll < 0.22 ? 'freeKick' : 'openPlay',
    };
  });

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
  // He is injured if he was hurt during the match. The old blind roll after the whistle
  // is gone: an injury nobody saw happen is a message, not a moment.
  const injuryRolled = Boolean(half.userInjuredAt);

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

/** Forty-five minutes resolved in chronological order. */
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
  const minutesThisHalf = minutesOnPitchIn(ctx, setup, which);
  const [activeFrom, activeTo] = onPitchBounds(ctx, setup, half, which);
  const moments: MatchMoment[] = chances.map((chance, order) => ({
    minute: chance.minute,
    order: 100 + order,
    kind: 'chance',
    chance,
  }));

  // A penalty is a team event. The designated taker takes it only when present at that
  // exact minute; otherwise a teammate steps up. Its likelihood no longer depends on
  // whether a substitute happened to play in the other half.
  if (rng.chance(0.0375)) {
    moments.push({
      minute: rng.int(which === 1 ? 6 : 46, which === 1 ? 45 : 90),
      order: 30,
      kind: 'penalty',
    });
  }

  // Personal incidents are rolled from the minutes he can actually play in this half,
  // then inserted into the same timeline as chances. At equal minutes an exit is
  // processed first, so he cannot be dismissed and score afterwards at 62'.
  if (minutesThisHalf > 0 && line.red === 0 && activeTo > activeFrom) {
    const discipline = ctx.user.personality.discipline;
    const group = positionGroup(ctx.minutes.slot ?? ctx.user.primaryPos);
    const cardBase = group === 'DEF' ? 0.28 : group === 'MID' ? 0.24 : group === 'ATT' ? 0.14 : 0.06;
    const yellowP = clamp(cardBase * (1.4 - discipline / 100) * (minutesThisHalf / 90) * mods.cardRisk, 0.003, 0.4);
    if (rng.chance(yellowP)) {
      moments.push({
        minute: rng.int(Math.ceil(activeFrom), Math.floor(activeTo)),
        order: 10,
        kind: line.yellow > 0 ? 'secondYellow' : 'yellow',
      });
    } else if (rng.chance(0.0012)) {
      moments.push({
        minute: rng.int(Math.ceil(activeFrom), Math.floor(activeTo)),
        order: 10,
        kind: 'straightRed',
      });
    }
  }

  if (minutesThisHalf > 0 && !half.userInjuredAt && activeTo > activeFrom) {
    const risk = inMatchInjuryChance(ctx.user, minutesThisHalf) * mods.injuryRisk;
    if (rng.chance(risk)) {
      moments.push({
        minute: rng.int(Math.ceil(activeFrom), Math.floor(activeTo)),
        order: 20,
        kind: 'injury',
      });
    }
  }

  // Cards and substitutions elsewhere on the pitch are match state, not commentary.
  // A dismissal changes every later chance; fresh legs modestly change second-half
  // attacking energy. Rates are intentionally low and close to real match frequency.
  if (rng.chance(0.0125)) {
    moments.push({
      minute: rng.int(which === 1 ? 18 : 50, which === 1 ? 44 : 84),
      order: 12,
      kind: rng.chance(0.5) ? 'teamRed' : 'opponentRed',
    });
  }
  if (which === 2) {
    moments.push({ minute: rng.int(56, 76), order: 40, kind: 'teamSub' });
    moments.push({ minute: rng.int(58, 80), order: 41, kind: 'opponentSub' });
  }

  moments.sort((a, b) => a.minute - b.minute || a.order - b.order);
  for (const moment of moments) {
    const userOnPitch = userOnPitchAt(ctx, setup, half, moment.minute);
    switch (moment.kind) {
      case 'chance':
        if (moment.chance.forUser) {
          resolveUserChance(rng, ctx, setup, half, moment.chance, userOnPitch, mods);
        } else {
          resolveOpponentChance(rng, ctx, setup, half, moment.chance, userOnPitch, mods);
        }
        break;
      case 'penalty':
        resolvePenalty(rng, ctx, setup, half, moment.minute, userOnPitch);
        break;
      case 'yellow':
        if (!userOnPitch) break;
        line.yellow++;
        half.events.push({
          minute: moment.minute, type: 'yellow', playerId: ctx.user.id,
          byUser: true, detailKey: 'match.event.yellow',
        });
        break;
      case 'secondYellow':
        if (!userOnPitch) break;
        line.yellow++;
        dismissUser(ctx, half, moment.minute, 'match.event.secondYellow');
        break;
      case 'straightRed':
        if (!userOnPitch) break;
        dismissUser(ctx, half, moment.minute, 'match.event.straightRed');
        break;
      case 'injury':
        if (!userOnPitch) break;
        injureUser(ctx, half, moment.minute);
        break;
      case 'teamRed':
        half.userTeamRedAt = moment.minute;
        half.events.push({
          minute: moment.minute, type: 'red', byUser: false,
          detailKey: 'match.event.teamRed',
        });
        break;
      case 'opponentRed':
        half.opponentRedAt = moment.minute;
        half.events.push({
          minute: moment.minute, type: 'red', byUser: false,
          detailKey: 'match.event.opponentRed',
        });
        break;
      case 'teamSub':
        half.events.push({
          minute: moment.minute, type: 'sub-on', byUser: false,
          detailKey: setup.userSecondHalfEnergy >= 1 ? 'match.event.teamAttackingSub' : 'match.event.teamFreshLegs',
        });
        break;
      case 'opponentSub':
        half.events.push({
          minute: moment.minute, type: 'sub-on', byUser: false,
          detailKey: setup.oppSecondHalfEnergy >= 1 ? 'match.event.opponentAttackingSub' : 'match.event.opponentFreshLegs',
        });
        break;
    }
  }

  addBroadcastEvents(rng, ctx, setup, half, which, mods);
}

/** How much of this half he was on the pitch for. */
function minutesOnPitchIn(ctx: UserMatchContext, setup: MatchSetup, which: 1 | 2, half?: HalfState): number {
  const [from, to] = onPitchBounds(ctx, setup, half, which);
  return Math.max(0, to - from);
}

function onPitchBounds(
  ctx: UserMatchContext,
  setup: MatchSetup,
  half: HalfState | undefined,
  which: 1 | 2,
): [number, number] {
  if (!ctx.minutes.played) return [0, 0];
  const start = which === 1 ? 0 : 45;
  const end = which === 1 ? 45 : 90;
  const from = Math.max(start, setup.onPitchFrom);
  const to = Math.min(end, setup.onPitchTo, half?.userUnavailableAt ?? 90);
  return [from, to];
}

function userOnPitchAt(ctx: UserMatchContext, setup: MatchSetup, half: HalfState, minute: number): boolean {
  return Boolean(
    ctx.minutes.played
    && minute >= setup.onPitchFrom
    && (setup.onPitchTo === 90 ? minute <= 90 : minute < setup.onPitchTo)
    && (half.userUnavailableAt === undefined || minute < half.userUnavailableAt),
  );
}

function actualMinutesUntil(ctx: UserMatchContext, minute: number): number {
  return Math.max(1, minute - (ctx.minutes.cameOnMinute ?? 0));
}

function dismissUser(ctx: UserMatchContext, half: HalfState, minute: number, detailKey: string): void {
  half.line.red = 1;
  half.line.minutes = Math.min(half.line.minutes, actualMinutesUntil(ctx, minute));
  half.line.offMinute = minute;
  half.userSentOffAt = minute;
  half.userUnavailableAt = Math.min(half.userUnavailableAt ?? 90, minute);
  half.events.push({
    minute, type: 'red', playerId: ctx.user.id, byUser: true, detailKey,
  });
}

function injureUser(ctx: UserMatchContext, half: HalfState, minute: number): void {
  half.userInjuredAt = minute;
  half.userUnavailableAt = Math.min(half.userUnavailableAt ?? 90, minute);
  half.line.minutes = Math.min(half.line.minutes, actualMinutesUntil(ctx, minute));
  half.line.offMinute = minute;
  half.events.push({
    minute, type: 'injury', playerId: ctx.user.id,
    byUser: true, detailKey: 'match.event.userInjured',
  });
  half.events.push({
    minute, type: 'sub-off', playerId: ctx.user.id,
    byUser: true, detailKey: 'match.event.offInjured',
  });
}

function resolvePenalty(
  rng: Rng,
  ctx: UserMatchContext,
  setup: MatchSetup,
  half: HalfState,
  minute: number,
  userOnPitch: boolean,
): void {
  const taker = ctx.penaltyTaker && userOnPitch
    ? { player: ctx.user, slot: ctx.minutes.slot ?? ctx.user.primaryPos }
    : rng.weighted(setup.attackers, (candidate) => attackWeight(candidate.player, candidate.slot));
  if (!taker) return;

  const byUser = taker.player.id === ctx.user.id;
  const nerve = taker.player.attributes.composure * 0.45 + taker.player.attributes.finishing * 0.55;
  if (byUser) half.line.shots++;
  if (rng.chance(clamp(0.6 + nerve / 300 + (byUser ? (ctx.mental - 1) * 0.25 : 0), 0.45, 0.95))) {
    half.userGoals++;
    if (byUser) half.line.goals++;
    half.events.push({
      minute,
      type: 'penaltyScored',
      playerId: taker.player.id,
      byUser,
      detailKey: byUser ? 'match.event.penaltyScored' : 'match.event.teamPenaltyScored',
      score: setup.userHome ? [half.userGoals, half.oppGoals] : [half.oppGoals, half.userGoals],
    });
  } else {
    half.events.push({
      minute,
      type: 'penaltyMissed',
      playerId: taker.player.id,
      byUser,
      detailKey: byUser ? 'match.event.penaltyMissed' : 'match.event.teamPenaltyMissed',
    });
  }
}

function resolveUserChance(
  rng: Rng,
  ctx: UserMatchContext,
  setup: MatchSetup,
  half: HalfState,
  chance: Chance,
  userOnPitch: boolean,
  mods: HalfTimeEffect,
): void {
  const { minute, source } = chance;
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
  const rawQuality = source === 'corner'
    ? shooter.player.attributes.heading * 0.55 + shooter.player.attributes.jumping * 0.25 + composure * 0.2
    : source === 'freeKick'
      ? shooter.player.attributes.shooting * 0.55 + finishing * 0.2 + composure * 0.25
      : finishing * 0.6 + composure * 0.25 + shooter.player.attributes.shooting * 0.15;
  // Confidence is worth a few points of finishing either way.
  const quality = isUser ? rawQuality * (0.88 + ctx.mental * 0.12) : rawQuality;
  const resistance = setup.oppDefenceRating * 0.68 + setup.oppGoalkeeperRating * 0.32;
  const userRed = (half.userSentOffAt !== undefined && minute >= half.userSentOffAt)
    || (half.userTeamRedAt !== undefined && minute >= half.userTeamRedAt);
  const opponentRed = half.opponentRedAt !== undefined && minute >= half.opponentRedAt;
  const numerical = userRed ? 0.82 : opponentRed ? 1.17 : 1;
  const setPieceConversion = source === 'corner' ? 0.68 : source === 'freeKick' ? 0.76 : 1;
  const freshLegs = minute >= 56 ? setup.userSecondHalfEnergy : 1;
  const p = clamp(
    CONVERSION_BASE
      * (0.5 + logistic((quality - resistance) / 12) * 1.6)
      * scoreStateAttackFactor(half.userGoals - half.oppGoals, minute)
      * numerical
      * setPieceConversion
      * freshLegs,
    0.025,
    0.55,
  );

  if (isUser) line.shots++;

  if (source !== 'openPlay') {
    half.events.push({
      minute,
      type: source === 'corner' ? 'corner' : 'freeKick',
      byUser: isUser,
      playerId: isUser ? ctx.user.id : undefined,
      detailKey: source === 'corner' ? 'match.event.cornerChance' : 'match.event.freeKickChance',
    });
  }

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
    const outcome = rng.next();
    const type: MatchEvent['type'] = outcome < 0.12 ? 'woodwork' : outcome < 0.38 ? 'blockedShot' : outcome < 0.68 ? 'save' : 'miss';
    half.events.push({
      minute,
      type,
      playerId: ctx.user.id,
      byUser: true,
      detailKey: type === 'woodwork'
        ? 'match.event.userWoodwork'
        : type === 'blockedShot'
          ? 'match.event.userBlocked'
          : type === 'save'
            ? 'match.event.userSaved'
            : 'match.event.userMiss',
    });
  } else {
    const outcome = rng.next();
    const type: MatchEvent['type'] = outcome < 0.1 ? 'woodwork' : outcome < 0.4 ? 'blockedShot' : outcome < 0.7 ? 'save' : 'miss';
    half.events.push({
      minute, type, playerId: shooter.player.id, byUser: false,
      detailKey: type === 'woodwork'
        ? 'match.event.teamWoodwork'
        : type === 'blockedShot'
          ? 'match.event.teamBlocked'
          : type === 'save'
            ? 'match.event.teamSaved'
            : 'match.event.teamMiss',
    });
  }

  if (!isUser && userOnPitch && rng.chance(0.6)) {
    // The user was involved in the build-up even when someone else finished.
    const involved = rng.chance(
      userInvolvementChance(ctx.user, ctx.minutes.slot, ctx.mental) * mods.involvement * 0.8 * mods.creating,
    );
    if (involved) {
      line.keyPasses++;
      half.events.push({
        minute, type: 'keyPass', playerId: ctx.user.id,
        byUser: true, detailKey: 'match.event.userKeyPass',
      });
    }
  }
}

function resolveOpponentChance(
  rng: Rng,
  ctx: UserMatchContext,
  setup: MatchSetup,
  half: HalfState,
  chance: Chance,
  userOnPitch: boolean,
  mods: HalfTimeEffect,
): void {
  const { minute, source } = chance;
  const { line } = half;
  const slot = ctx.minutes.slot ?? ctx.user.primaryPos;
  const group = positionGroup(slot);

  const shooterRating = setup.oppDefenceRating + rng.gauss(0, 6);
  const resistance = setup.userDefenceRating * 0.68 + setup.userGoalkeeperRating * 0.32;
  const userRed = (half.userSentOffAt !== undefined && minute >= half.userSentOffAt)
    || (half.userTeamRedAt !== undefined && minute >= half.userTeamRedAt);
  const opponentRed = half.opponentRedAt !== undefined && minute >= half.opponentRedAt;
  const numericalAdvantage = userRed ? 1.18 : opponentRed ? 0.82 : 1;
  const setPieceConversion = source === 'corner' ? 0.7 : source === 'freeKick' ? 0.78 : 1;
  const freshLegs = minute >= 56 ? setup.oppSecondHalfEnergy : 1;
  const p = clamp(
    CONVERSION_BASE
      * (0.5 + logistic((shooterRating - resistance) / 12) * 1.6)
      * scoreStateAttackFactor(half.oppGoals - half.userGoals, minute)
      * numericalAdvantage
      * setPieceConversion
      * freshLegs,
    0.03,
    0.55,
  );

  if (source !== 'openPlay') {
    half.events.push({
      minute, type: source === 'corner' ? 'corner' : 'freeKick', byUser: false,
      detailKey: source === 'corner' ? 'match.event.opponentCornerChance' : 'match.event.opponentFreeKickChance',
    });
  }

  // Defensive involvement: keepers save, defenders intervene.
  if (userOnPitch && group === 'GK') {
    const saveSkill = ctx.user.attributes.reflexes * 0.5 + ctx.user.attributes.positioningGK * 0.3 + ctx.user.attributes.handling * 0.2;
    const adjusted = clamp(p * (1 - (saveSkill - 50) / 160) / mods.defending, 0.02, 0.6);
    if (rng.chance(adjusted)) {
      half.oppGoals++;
      half.events.push({
        minute, type: 'concede', playerId: ctx.user.id, byUser: true,
        detailKey: 'match.event.conceded',
        score: setup.userHome ? [half.userGoals, half.oppGoals] : [half.oppGoals, half.userGoals],
      });
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

  /*
   * Everybody else's share of the defending.
   *
   * Only defenders could win the ball, and a midfielder only when he had been told to
   * chase, so an attacking midfielder finished a hundred and twenty matches with zero
   * tackles - which is not a career, it is a rounding error. Midfielders defend as part
   * of the job and forwards do it when they feel like it; how much of it he does is
   * still what the instruction moves, which is the point of the instruction.
   */
  const shareOfWork = group === 'MID' ? 0.3 : 0.12;
  if (userOnPitch && (group === 'MID' || group === 'ATT') && rng.chance(clamp(shareOfWork * mods.defending, 0.02, 0.65))) {
    const work =
      ctx.user.attributes.tackling * 0.4
      + ctx.user.attributes.workRate * 0.3
      + ctx.user.attributes.positioning * 0.3;
    if (rng.chance(clamp(0.3 + (work - setup.oppDefenceRating) / 100, 0.08, 0.8) * mods.defending)) {
      line.tackles++;
      half.events.push({ minute, type: 'tackle', playerId: ctx.user.id, byUser: true, detailKey: 'match.event.userTackle' });
      return;
    }
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
  } else {
    const outcome = rng.next();
    const type: MatchEvent['type'] = outcome < 0.09 ? 'woodwork' : outcome < 0.34 ? 'blockedShot' : outcome < 0.7 ? 'save' : 'oppMiss';
    half.events.push({
      minute, type, byUser: false,
      detailKey: type === 'woodwork'
        ? 'match.event.opponentWoodwork'
        : type === 'blockedShot'
          ? 'match.event.opponentBlocked'
          : type === 'save'
            ? 'match.event.opponentSaved'
            : 'match.event.opponentMiss',
    });
  }
}

/**
 * After the hour, a side behind commits more bodies; a side protecting a lead gives up
 * some attacking volume. This is deliberately modest: it changes how the match breathes
 * without making every late deficit a scripted comeback.
 */
function scoreStateAttackFactor(goalDifference: number, minute: number): number {
  if (minute < 58 || goalDifference === 0) return 1;
  const urgency = clamp((minute - 55) / 35, 0, 1);
  if (goalDifference < 0) return 1 + urgency * Math.min(0.2, Math.abs(goalDifference) * 0.08);
  return 1 - urgency * Math.min(0.12, goalDifference * 0.05);
}

/** A useful bench lifts the final half hour; a thin one cannot magically do so. */
function benchEnergy(squad: Player[], benchIds: string[]): number {
  const bench = benchIds
    .map((id) => squad.find((player) => player.id === id))
    .filter((player): player is Player => Boolean(player))
    .map((player) => ratingAt(player.attributes, player.primaryPos))
    .sort((a, b) => b - a)
    .slice(0, 3);
  if (bench.length === 0) return 0.96;
  const average = bench.reduce((sum, value) => sum + value, 0) / bench.length;
  return clamp(0.96 + (average - 55) / 500, 0.94, 1.06);
}

function opponentBenchEnergy(players: Player[], teamRating: number): number {
  if (players.length < 5) return clamp(0.98 + (teamRating - 55) / 700, 0.95, 1.05);
  const depth = players
    .map((player) => ratingAt(player.attributes, player.primaryPos))
    .sort((a, b) => b - a)
    .slice(8, 13);
  if (depth.length === 0) return 0.98;
  const average = depth.reduce((sum, value) => sum + value, 0) / depth.length;
  return clamp(0.96 + (average - teamRating) / 180, 0.94, 1.06);
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
  half: HalfState,
  which: 1 | 2,
  mods: HalfTimeEffect,
): void {
  const events = half.events;
  const played = ctx.minutes.played;
  const from = setup.onPitchFrom;
  const to = Math.min(setup.onPitchTo, half.userUnavailableAt ?? 90);
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
  if (
    played
    && cameOff
    && cameOff < 90
    && (half.userUnavailableAt === undefined || half.userUnavailableAt >= cameOff)
    && inHalf(cameOff, which)
  ) {
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

  // Outcome-derived chance events now carry most of the broadcast. A few quieter beats
  // preserve the rhythm between them without drowning the player in invented action.
  const count = rng.int(2, 4);
  const used = new Set(events.filter((e) => e.ambient && e.detailKey).map((e) => e.detailKey!));
  for (let i = 0; i < count; i++) {
    const minute = rng.int(start, end);
    const onPitch = played && minute >= from && (to === 90 ? minute <= 90 : minute < to);
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
