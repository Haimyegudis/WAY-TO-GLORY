import { Rng, clamp, logistic } from './rng.js';
import { positionGroup, ratingAt } from './positions.js';
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

export function clubRating(club: Club): number {
  return 38 + club.strength * 0.46;
}

const HOME_ADVANTAGE = 2.4;

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
}

/**
 * Chance-based simulation, used only for matches the user is involved in.
 * The scoreline emerges from resolved chances, which is what makes the
 * narrative events real rather than decorative.
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

  const events: MatchEvent[] = [];
  let userGoals = 0;
  let oppGoals = 0;

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

  const onPitchFrom = ctx.minutes.cameOnMinute ?? 0;
  const onPitchTo = ctx.minutes.offMinute ?? (ctx.minutes.played ? 90 : 0);

  // Who can be on the end of a chance for the user's club.
  const attackers = ctx.lineup.starters
    .map((s) => {
      const p = ctx.userClubSquad.find((q) => q.id === s.playerId);
      return p ? { player: p, slot: s.slot } : null;
    })
    .filter((x): x is { player: Player; slot: Position } => x !== null);

  const conversionBase = 0.115;
  const userDefenceRating = userSquadRating;
  const oppDefenceRating = oppRating;

  const minutes = rng.shuffle(Array.from({ length: totalChances }, (_, i) => 3 + Math.floor((i * 87) / totalChances)))
    .sort((a, b) => a - b);

  let chanceIndex = 0;
  for (let i = 0; i < userChances; i++) {
    const minute = minutes[chanceIndex++] ?? rng.int(1, 90);
    const userOnPitch = ctx.minutes.played && minute >= onPitchFrom && minute <= onPitchTo;

    const picked = rng.weighted(attackers, (a) => attackWeight(a.player, a.slot));
    if (!picked) continue;

    // If the user is on the pitch, they get their positional share of involvement.
    const shooter = userOnPitch && rng.chance(userInvolvementChance(ctx.user, ctx.minutes.slot, ctx.mental))
      ? { player: ctx.user, slot: ctx.minutes.slot ?? ctx.user.primaryPos }
      : picked;

    const isUser = shooter.player.id === ctx.user.id;
    const finishing = shooter.player.attributes.finishing;
    const composure = shooter.player.attributes.composure;
    const rawQuality = finishing * 0.6 + composure * 0.25 + shooter.player.attributes.shooting * 0.15;
    // Confidence is worth a few points of finishing either way.
    const quality = isUser ? rawQuality * (0.88 + ctx.mental * 0.12) : rawQuality;
    const p = clamp(conversionBase * (0.5 + logistic((quality - oppDefenceRating) / 12) * 1.6), 0.03, 0.55);

    if (isUser) line.shots++;

    if (rng.chance(p)) {
      userGoals++;
      if (isUser) line.goals++;
      let assistId: string | undefined;
      if (rng.chance(0.68)) {
        const creators = attackers.filter((a) => a.player.id !== shooter.player.id);
        const userCanAssist = userOnPitch && !isUser && rng.chance(userInvolvementChance(ctx.user, ctx.minutes.slot, ctx.mental) * 1.35);
        const creator = userCanAssist
          ? { player: ctx.user, slot: ctx.minutes.slot ?? ctx.user.primaryPos }
          : rng.weighted(creators, (a) => assistWeight(a.player, a.slot));
        if (creator) {
          assistId = creator.player.id;
          if (creator.player.id === ctx.user.id) line.assists++;
        }
      }
      events.push({
        minute,
        type: 'goal',
        playerId: shooter.player.id,
        byUser: isUser,
        detailKey: isUser ? 'match.event.userGoal' : 'match.event.teamGoal',
        score: userHome ? [userGoals, oppGoals] : [oppGoals, userGoals],
      });
      if (assistId) {
        events.push({
          minute,
          type: 'assist',
          playerId: assistId,
          byUser: assistId === ctx.user.id,
          detailKey: 'match.event.assist',
        });
      }
    } else if (isUser) {
      const near = rng.chance(0.45);
      events.push({
        minute,
        type: near ? 'miss' : 'save',
        playerId: ctx.user.id,
        byUser: true,
        detailKey: near ? 'match.event.userMiss' : 'match.event.userSaved',
      });
    } else if (userOnPitch && rng.chance(0.6)) {
      // The user was involved in the build-up even when someone else finished.
      const involved = rng.chance(userInvolvementChance(ctx.user, ctx.minutes.slot, ctx.mental) * 0.8);
      if (involved) line.keyPasses++;
    }
  }

  for (let i = 0; i < oppChances; i++) {
    const minute = minutes[chanceIndex++] ?? rng.int(1, 90);
    const userOnPitch = ctx.minutes.played && minute >= onPitchFrom && minute <= onPitchTo;
    const slot = ctx.minutes.slot ?? ctx.user.primaryPos;
    const group = positionGroup(slot);

    const shooterRating = oppRating + rng.gauss(0, 6);
    const p = clamp(conversionBase * (0.5 + logistic((shooterRating - userDefenceRating) / 12) * 1.6), 0.03, 0.55);

    // Defensive involvement: keepers save, defenders intervene.
    if (userOnPitch && group === 'GK') {
      const saveSkill = ctx.user.attributes.reflexes * 0.5 + ctx.user.attributes.positioningGK * 0.3 + ctx.user.attributes.handling * 0.2;
      const adjusted = clamp(p * (1 - (saveSkill - 50) / 160), 0.02, 0.6);
      if (rng.chance(adjusted)) {
        oppGoals++;
        events.push({ minute, type: 'concede', playerId: ctx.user.id, byUser: true, detailKey: 'match.event.conceded' });
      } else {
        line.saves++;
        events.push({ minute, type: 'save', playerId: ctx.user.id, byUser: true, detailKey: 'match.event.userSave' });
      }
      continue;
    }

    if (userOnPitch && group === 'DEF' && rng.chance(0.45)) {
      const defSkill = ctx.user.attributes.tackling * 0.4 + ctx.user.attributes.marking * 0.35 + ctx.user.attributes.positioning * 0.25;
      if (rng.chance(clamp(0.35 + (defSkill - oppRating) / 90, 0.1, 0.85))) {
        line.tackles++;
        events.push({ minute, type: 'tackle', playerId: ctx.user.id, byUser: true, detailKey: 'match.event.userTackle' });
        continue;
      }
    }

    if (rng.chance(p)) {
      oppGoals++;
      const scorer = ctx.opponentStars.length > 0
        ? rng.weighted(ctx.opponentStars, (s) => attackWeight(s, s.primaryPos))
        : null;
      events.push({
        minute,
        type: 'concede',
        playerId: scorer?.id,
        byUser: false,
        detailKey: 'match.event.oppGoal',
        score: userHome ? [userGoals, oppGoals] : [oppGoals, userGoals],
      });
    }
  }

  // Cards.
  if (ctx.minutes.played) {
    const discipline = ctx.user.personality.discipline;
    const group = positionGroup(ctx.minutes.slot ?? ctx.user.primaryPos);
    const cardBase = group === 'DEF' ? 0.16 : group === 'MID' ? 0.13 : group === 'ATT' ? 0.07 : 0.03;
    const yellowP = clamp(cardBase * (1.4 - discipline / 100) * (ctx.minutes.minutes / 90), 0.005, 0.4);
    if (rng.chance(yellowP)) {
      line.yellow++;
      events.push({ minute: rng.int(10, 88), type: 'yellow', playerId: ctx.user.id, byUser: true, detailKey: 'match.event.yellow' });
      if (rng.chance(0.07)) {
        line.yellow++;
        line.red = 1;
        events.push({ minute: rng.int(50, 90), type: 'red', playerId: ctx.user.id, byUser: true, detailKey: 'match.event.secondYellow' });
      }
    } else if (rng.chance(0.006)) {
      line.red = 1;
      events.push({ minute: rng.int(20, 88), type: 'red', playerId: ctx.user.id, byUser: true, detailKey: 'match.event.straightRed' });
    }
  }

  addBroadcastEvents(rng, ctx, events);

  const homeGoals = userHome ? userGoals : oppGoals;
  const awayGoals = userHome ? oppGoals : userGoals;

  line.rating = computeRating(rng, ctx, line, userGoals, oppGoals);
  line.motm = line.played && line.rating >= 8.3 && (userGoals > oppGoals || line.goals >= 2);

  const result: MatchResult = {
    id: ctx.matchId,
    season: ctx.season,
    week: ctx.week,
    competitionId: ctx.competitionId,
    homeClubId: ctx.homeClub.id,
    awayClubId: ctx.awayClub.id,
    homeGoals,
    awayGoals,
    detailLevel: 1,
    importance: ctx.importance,
    userLine: line,
    events: events.sort((a, b) => a.minute - b.minute),
  };

  const injuryRolled = ctx.minutes.played && rng.chance(inMatchInjuryChance(ctx.user, ctx.minutes.minutes));

  return { result, events, line, injuryRolled };
}

/**
 * Colour for a match you watch rather than read: corners, free kicks, balls flashing
 * across the six-yard box, the moment you came off. None of it touches the scoreline -
 * that has already emerged from the chances - but ninety minutes with nothing but two
 * goals in it is not a match, it is a result.
 */
function addBroadcastEvents(rng: Rng, ctx: UserMatchContext, events: MatchEvent[]): void {
  const played = ctx.minutes.played;
  const from = ctx.minutes.cameOnMinute ?? 0;
  const to = ctx.minutes.offMinute ?? (played ? 90 : 0);

  const push = (minute: number, type: MatchEvent['type'], key: string, byUser = false) => {
    events.push({ minute, type, byUser, detailKey: key, ambient: true, playerId: byUser ? ctx.user.id : undefined });
  };

  push(0, 'kickOff', 'match.live.kickOff');

  if (played && ctx.minutes.cameOnMinute) {
    events.push({
      minute: ctx.minutes.cameOnMinute, type: 'sub-on', byUser: true,
      playerId: ctx.user.id, detailKey: 'match.live.subOn',
    });
  }
  if (played && ctx.minutes.offMinute && ctx.minutes.offMinute < 90) {
    events.push({
      minute: ctx.minutes.offMinute, type: 'sub-off', byUser: true,
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

  const count = rng.int(9, 14);
  const used = new Set<string>();
  for (let i = 0; i < count; i++) {
    const minute = rng.int(2, 89);
    const onPitch = played && minute >= from && minute <= to;
    const involvement = onPitch ? userInvolvementChance(ctx.user, ctx.minutes.slot, ctx.mental) * 1.6 : 0;
    const pool = rng.chance(clamp(involvement, 0, 0.65)) ? mine : neutral;
    // Do not run the same line twice in one match; there are enough to go round.
    let pick = pool[rng.int(0, pool.length - 1)]!;
    for (let tries = 0; tries < 3 && used.has(pick[1]); tries++) pick = pool[rng.int(0, pool.length - 1)]!;
    if (used.has(pick[1])) continue;
    used.add(pick[1]);
    push(minute, pick[0], pick[1], pool === mine);
  }

  push(45, 'halfTime', 'match.live.halfTime');
  push(90, 'fullTime', 'match.live.fullTime');
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
function computeRating(
  rng: Rng,
  ctx: UserMatchContext,
  line: UserMatchLine,
  teamGoals: number,
  oppGoals: number,
): number {
  if (!line.played) return 0;
  const group = positionGroup(line.position ?? ctx.user.primaryPos);
  const ovr = ratingAt(ctx.user.attributes, line.position ?? ctx.user.primaryPos);

  // Baseline drifts with quality relative to the level of the game.
  // 6.5 is a competent, unremarkable afternoon; everything else moves from there.
  let rating = 6.5 + (ovr - ctx.opponentRating) / 40 + (ctx.user.form - 50) / 160;
  rating += rng.gauss(0, 0.42) * (1.4 - ctx.user.personality.consistency / 140);


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

  // A cameo can't earn a 9 - or a 4. Short outings pull toward the average.
  if (line.minutes < 30) rating = 6.0 + (rating - 6.0) * 0.5;
  else if (line.minutes < 60) rating = 6.0 + (rating - 6.0) * 0.8;

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
