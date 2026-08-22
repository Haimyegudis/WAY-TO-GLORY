/**
 * The week before the match.
 *
 * A player-career game cannot hand him a tactics board - he is one man in eleven, and
 * the shape is not his to pick. What is his is the job inside it: where he starts his
 * runs, whether he drops in to get the ball or gambles on the last line, who he is
 * supposed to stop, and how much of himself he spends doing it. Managers give that job
 * out on a Thursday and players work on it all week; here it was the one part of a
 * footballer's week the game did not contain at all, so every match was played the same
 * way against every opponent.
 *
 * Three things now exist before kick-off. A report on the side he is about to play -
 * their shape, what they are good at, who their danger man is, and the man who will be
 * marking him. A plan he chooses for his own afternoon, which is a trade like every
 * other choice in the game. And a right answer that changes every week: a plan that
 * counters what they do is worth real minutes of advantage, and one that plays into it
 * costs him the same.
 */
import { clamp } from './rng.js';
import { FORMATIONS, positionGroup, ratingAt } from './positions.js';
import { NO_INSTRUCTION, type HalfTimeEffect } from './halftime.js';
import type { Club, PositionGroup, Player, Position } from './types.js';

/** What a side does to you, read off the players it actually has. */
export type OpponentThreat = 'pace' | 'possession' | 'pressing' | 'setPieces' | 'physical';

/** Where a side is soft, which is where an afternoon is won. */
export type OpponentWeakness = 'slowDefence' | 'openMidfield' | 'lightUpFront' | 'shakyKeeper' | 'none';

export interface OpponentReport {
  clubId: string;
  clubName: string;
  /** Their shape, so he can see whose job his job collides with. */
  formation: string;
  /** Their playing level on the OVR scale, and how it compares with his own side. */
  rating: number;
  gap: number;
  threat: OpponentThreat;
  weakness: OpponentWeakness;
  /** The one they build it around, when the world models them player by player. */
  dangerMan: { name: string; position: Position; rating: number } | null;
  /** The man in the shirt opposite his. Beating him is most of his afternoon. */
  marker: { name: string; position: Position; rating: number } | null;
  home: boolean;
}

export type MatchPlanId =
  | 'runTheChannels'
  | 'dropIntoSpace'
  | 'gambleOnTheShoulder'
  | 'takeOnYourMan'
  | 'attackEveryCross'
  | 'screenTheBackFour'
  | 'stayGoalside'
  | 'stepUpAndSqueeze'
  | 'keepItSimple';

export interface MatchPlan {
  id: MatchPlanId;
  /** Which positions the job makes any sense for. */
  groups: PositionGroup[];
  effect: HalfTimeEffect;
  /** Threats this job is built to deal with. */
  counters: OpponentThreat[];
  /** Weaknesses it is built to punish. */
  punishes: OpponentWeakness[];
  /** Threats that make this exactly the wrong afternoon for it. */
  exposedTo: OpponentThreat[];
}

/*
 * A whole match rather than forty-five minutes, so every number here is smaller than the
 * half-time equivalent: this is how he intends to play, not a change of plan with the
 * clock running. Both can be true at once - the plan sets the afternoon, the interval
 * changes it - and the match multiplies the two together.
 */
export const MATCH_PLANS: Record<MatchPlanId, MatchPlan> = {
  // Run the space behind their full-backs. Murder for a slow defence, useless against
  // a side that sits deep and dares you to play through them.
  runTheChannels: {
    id: 'runTheChannels',
    groups: ['ATT', 'MID'],
    effect: { involvement: 1.12, shooting: 1.08, conversion: 1.02, creating: 1.05, defending: 0.9, fatigue: 1.14, cardRisk: 1, injuryRisk: 1.05, variance: 1.08 },
    counters: ['possession'],
    punishes: ['slowDefence'],
    exposedTo: ['pressing'],
  },
  // Come off the front line to get on the ball where nobody is marking.
  dropIntoSpace: {
    id: 'dropIntoSpace',
    groups: ['ATT', 'MID'],
    effect: { involvement: 1.18, shooting: 0.85, conversion: 1.02, creating: 1.2, defending: 0.98, fatigue: 1.02, cardRisk: 0.95, injuryRisk: 0.95, variance: 0.92 },
    counters: ['pressing', 'physical'],
    punishes: ['openMidfield'],
    exposedTo: [],
  },
  // Play on the last shoulder and live off one ball in ninety minutes.
  gambleOnTheShoulder: {
    id: 'gambleOnTheShoulder',
    groups: ['ATT'],
    effect: { involvement: 0.82, shooting: 1.35, conversion: 1.14, creating: 0.7, defending: 0.72, fatigue: 0.94, cardRisk: 0.9, injuryRisk: 1, variance: 1.35 },
    counters: ['possession'],
    punishes: ['slowDefence', 'shakyKeeper'],
    exposedTo: ['physical'],
  },
  // One against one, every time, until the full-back is booked or beaten.
  takeOnYourMan: {
    id: 'takeOnYourMan',
    groups: ['ATT', 'MID'],
    effect: { involvement: 1.12, shooting: 1.1, conversion: 1.04, creating: 1.14, defending: 0.85, fatigue: 1.16, cardRisk: 1.08, injuryRisk: 1.18, variance: 1.25 },
    counters: ['pressing'],
    punishes: ['slowDefence'],
    exposedTo: ['physical'],
  },
  // Attack the ball in the box. A centre-half's goals come from here, and so does a
  // striker's against a side that cannot defend a corner.
  attackEveryCross: {
    id: 'attackEveryCross',
    groups: ['ATT', 'DEF'],
    effect: { involvement: 1.05, shooting: 1.15, conversion: 1.08, creating: 0.92, defending: 1.05, fatigue: 1.06, cardRisk: 1.05, injuryRisk: 1.08, variance: 1.12 },
    counters: ['possession'],
    punishes: ['shakyKeeper', 'lightUpFront'],
    exposedTo: ['pace'],
  },
  // Sit in front of the back four and break it up before it starts.
  screenTheBackFour: {
    id: 'screenTheBackFour',
    groups: ['MID', 'DEF'],
    effect: { involvement: 0.95, shooting: 0.6, conversion: 0.98, creating: 0.95, defending: 1.35, fatigue: 1.05, cardRisk: 1.1, injuryRisk: 1, variance: 0.85 },
    counters: ['possession', 'pace'],
    punishes: ['lightUpFront'],
    exposedTo: [],
  },
  // Stay behind the ball, do not get dragged out, let them come.
  stayGoalside: {
    id: 'stayGoalside',
    groups: ['DEF', 'MID', 'GK'],
    effect: { involvement: 0.85, shooting: 0.7, conversion: 0.96, creating: 0.85, defending: 1.42, fatigue: 0.92, cardRisk: 0.8, injuryRisk: 0.9, variance: 0.78 },
    counters: ['pace', 'physical'],
    punishes: [],
    exposedTo: ['possession'],
  },
  // Push the line up and squeeze the pitch. It wins the ball high and it is one pass
  // from being embarrassing.
  stepUpAndSqueeze: {
    id: 'stepUpAndSqueeze',
    groups: ['DEF', 'MID'],
    effect: { involvement: 1.15, shooting: 0.9, conversion: 0.98, creating: 1.05, defending: 1.2, fatigue: 1.3, cardRisk: 1.25, injuryRisk: 1.12, variance: 1.2 },
    counters: ['possession'],
    punishes: ['openMidfield'],
    exposedTo: ['pace'],
  },
  // Do the simple thing well for ninety minutes. Nobody writes about it and nobody
  // blames him for it either.
  keepItSimple: {
    id: 'keepItSimple',
    groups: ['GK', 'DEF', 'MID', 'ATT'],
    effect: { involvement: 0.98, shooting: 0.9, conversion: 1.06, creating: 1.02, defending: 1.08, fatigue: 0.94, cardRisk: 0.82, injuryRisk: 0.92, variance: 0.72 },
    counters: [],
    punishes: [],
    exposedTo: [],
  },
};

export function plansFor(group: PositionGroup): MatchPlan[] {
  return Object.values(MATCH_PLANS).filter((plan) => plan.groups.includes(group));
}

/**
 * A side read off its players: what it will hurt him with, and where it is soft.
 *
 * Only the user's own division is modelled man by man, so a cup tie against a club from
 * another country has nothing to read but a strength number. That is not a failure - a
 * scouting report on a side nobody has seen is exactly that thin - and the report says
 * so by having no danger man in it.
 */
/*
 * The five families do not sit at the same height in a generated squad: a side's passing
 * and vision read a couple of points above its strength and balance in every squad in
 * the game. These are the measured averages, so "what is this side good at" means what
 * it is good at compared with other sides rather than which attribute the generator
 * happens to write highest. Forwards also run about eight points faster than the team
 * they play in, which is normal and not a warning.
 */
/*
 * The same for the soft spots. A back four reads a couple of points quicker than the
 * side it plays in once a goalkeeper is in the average, and a midfield reads slightly
 * under the club's rating in every squad. A weakness is a line that is worse than that.
 */
const WEAKNESS_BASELINE: Record<Exclude<OpponentWeakness, 'none'>, number> = {
  slowDefence: -2.7,
  openMidfield: 1.7,
  lightUpFront: 1.3,
  shakyKeeper: 0.9,
};

const FAMILY_BASELINE: Record<OpponentThreat, number> = {
  pace: -0.5,
  possession: 2,
  pressing: -0.6,
  setPieces: 0.1,
  physical: -1.2,
};

export function readOpponent(input: {
  club: Club;
  squad: Player[];
  rating: number;
  ownRating: number;
  home: boolean;
  /** The slot he expects to play, so the report can name the man opposite him. */
  slot: Position;
  /** Their shape, which decides who that man is. */
  formation: string;
}): OpponentReport {
  const { club, squad, rating, ownRating, home, slot } = input;
  const shape = FORMATIONS[input.formation] ? input.formation : '4-3-3';

  const rated = squad.map((player) => ({ player, ovr: ratingAt(player.attributes, player.primaryPos) }));
  const byGroup = (group: PositionGroup) =>
    rated.filter((entry) => positionGroup(entry.player.primaryPos) === group);
  const mean = (entries: typeof rated) =>
    entries.length === 0 ? rating : entries.reduce((sum, entry) => sum + entry.ovr, 0) / entries.length;

  const midfield = mean(byGroup('MID'));
  const attack = mean(byGroup('ATT'));
  const keeper = byGroup('GK')[0]?.ovr ?? rating;

  const attackers = byGroup('ATT');
  const avg = (pick: (p: Player) => number, pool = rated) =>
    pool.length === 0 ? 55 : pool.reduce((sum, entry) => sum + pick(entry.player), 0) / pool.length;

  /*
   * What they will actually do to him, decided by what they are made of.
   *
   * Every side has a highest attribute and it was almost always the same one: strength
   * and work rate sit higher than vision in every squad ever generated, so the report
   * read the same against everybody. What matters is not which number is biggest but
   * which one is bigger than the rest of this side - a team that presses is a team whose
   * legs are ahead of the rest of it.
   */
  const teamPace = avg((p) => (p.attributes.pace + p.attributes.acceleration) / 2);
  const measures: [OpponentThreat, number][] = [
    ['pace', teamPace],
    ['possession', avg((p) => (p.attributes.passing + p.attributes.vision) / 2)],
    ['pressing', avg((p) => (p.attributes.workRate + p.attributes.stamina) / 2)],
    ['setPieces', avg((p) => (p.attributes.heading + p.attributes.jumping) / 2)],
    ['physical', avg((p) => (p.attributes.strength + p.attributes.balance) / 2)],
  ];
  const across = measures.reduce((sum, [, value]) => sum + value, 0) / measures.length;
  // Every measure is read the same way, off the whole side, so none of them wins by
  // being measured somewhere flattering. A quick front three then counts for something
  // on top: it is the thing an opposing defender is actually warned about.
  const frontPace = attackers.length > 0
    ? avg((p) => (p.attributes.pace + p.attributes.acceleration) / 2, attackers) - teamPace
    : 0;
  const deviation = (entry: [OpponentThreat, number]) =>
    entry[1] - across - FAMILY_BASELINE[entry[0]] + (entry[0] === 'pace' ? (frontPace - 8) * 0.25 : 0);
  const threat: OpponentThreat = squad.length < 6
    ? 'physical'
    : measures.slice().sort((a, b) => deviation(b) - deviation(a))[0]![0];

  /*
   * And where they are soft, on the same terms.
   *
   * This compared a back four's pace - a number that is naturally in the forties -
   * against three whole-team ratings in the sixties, so "their back line is slow" won
   * every week against every opponent in the game. Each line is now measured against
   * what this side is elsewhere, which is what a scout means by a weak link.
   */
  const squadPace = avg((p) => (p.attributes.pace + p.attributes.acceleration) / 2);
  const defencePace = avg((p) => (p.attributes.pace + p.attributes.acceleration) / 2, byGroup('DEF'));
  const lines: [Exclude<OpponentWeakness, 'none'>, number][] = [
    ['slowDefence', squadPace - defencePace],
    ['openMidfield', rating - midfield],
    ['lightUpFront', rating - attack],
    ['shakyKeeper', rating - keeper],
  ];
  const softest = squad.length < 6
    ? null
    : lines
      .map(([line, value]) => [line, value - WEAKNESS_BASELINE[line]] as const)
      .sort((a, b) => b[1] - a[1])[0]!;
  // A weakness is only worth naming when the line is genuinely behind the rest of them.
  const weakness: OpponentWeakness = softest && softest[1] >= 2.5 ? softest[0] : 'none';

  const dangerMan = rated.length > 0
    ? rated.slice().sort((a, b) => b.ovr - a.ovr)[0]!
    : null;

  // Whoever is in the shirt his job runs into: their side of the pitch, mirrored.
  const opposite = mirrorSlot(slot);
  const markerPool = rated.filter((entry) => entry.player.primaryPos === opposite);
  const marker = (markerPool.length > 0 ? markerPool : rated.filter((entry) =>
    positionGroup(entry.player.primaryPos) === positionGroup(opposite)))
    .slice()
    .sort((a, b) => b.ovr - a.ovr)[0] ?? null;

  return {
    clubId: club.id,
    clubName: club.name,
    formation: shape,
    rating: Math.round(rating),
    gap: Math.round(rating - ownRating),
    threat,
    weakness,
    dangerMan: dangerMan
      ? { name: `${dangerMan.player.firstName} ${dangerMan.player.lastName}`, position: dangerMan.player.primaryPos, rating: Math.round(dangerMan.ovr) }
      : null,
    marker: marker
      ? { name: `${marker.player.firstName} ${marker.player.lastName}`, position: marker.player.primaryPos, rating: Math.round(marker.ovr) }
      : null,
    home,
  };
}

/** The man in the opposite shirt: a winger runs at a full-back, a striker at a centre-half. */
export function mirrorSlot(slot: Position): Position {
  switch (slot) {
    case 'GK': return 'ST';
    case 'CB': return 'ST';
    case 'RB': case 'RWB': return 'LW';
    case 'LB': case 'LWB': return 'RW';
    case 'CDM': return 'CAM';
    case 'CM': return 'CM';
    case 'CAM': return 'CDM';
    case 'RM': return 'LM';
    case 'LM': return 'RM';
    case 'RW': return 'LB';
    case 'LW': return 'RB';
    case 'CF': case 'ST': return 'CB';
    default: return 'CM';
  }
}

/**
 * How well the plan fits the afternoon: -1 is exactly the wrong idea, +1 is the one the
 * staff would have picked. It is deliberately readable rather than clever, because the
 * player is being asked to make this judgement himself from a report he can see.
 */
export function planFit(plan: MatchPlan, report: OpponentReport): number {
  let fit = 0;
  if (plan.counters.includes(report.threat)) fit += 0.6;
  if (plan.exposedTo.includes(report.threat)) fit -= 0.7;
  if (report.weakness !== 'none' && plan.punishes.includes(report.weakness)) fit += 0.5;
  // Nothing clever is required against a side that is simply better than yours.
  if (report.gap >= 8 && plan.effect.defending >= 1.2) fit += 0.25;
  if (report.gap <= -8 && plan.effect.involvement >= 1.1) fit += 0.2;
  return clamp(fit, -1, 1);
}

/**
 * The plan as the match engine sees it, once the week's work is taken into account.
 *
 * Getting the read right is not a different player, it is a player who knows what is
 * coming: the effect he chose is sharpened by up to a quarter, and the parts of it that
 * were always going to cost him - his legs, his discipline - are not refunded for being
 * clever.
 */
export function planEffect(plan: MatchPlan, fit: number): HalfTimeEffect {
  const read = clamp(fit, -1, 1);
  const sharpen = 1 + read * 0.4;
  const scale = (value: number) => 1 + (value - 1) * sharpen;
  // Being right about them is not only a sharper version of the same job: it is being in
  // the right place before the ball gets there, which is worth chances and touches on its
  // own. Being wrong about them is the same amount of running for less.
  const edge = 1 + read * 0.16;
  return {
    involvement: scale(plan.effect.involvement) * (1 + read * 0.12),
    shooting: scale(plan.effect.shooting),
    conversion: scale(plan.effect.conversion) * edge,
    creating: scale(plan.effect.creating) * edge,
    defending: scale(plan.effect.defending) * (1 + read * 0.08),
    // The bill is the bill.
    fatigue: plan.effect.fatigue,
    cardRisk: plan.effect.cardRisk,
    injuryRisk: plan.effect.injuryRisk,
    variance: plan.effect.variance,
  };
}

/** Two sets of instructions multiplied together: the week's plan, and the interval. */
export function combineEffects(a: HalfTimeEffect, b: HalfTimeEffect): HalfTimeEffect {
  return {
    involvement: a.involvement * b.involvement,
    shooting: a.shooting * b.shooting,
    conversion: a.conversion * b.conversion,
    creating: a.creating * b.creating,
    defending: a.defending * b.defending,
    fatigue: a.fatigue * b.fatigue,
    cardRisk: a.cardRisk * b.cardRisk,
    injuryRisk: a.injuryRisk * b.injuryRisk,
    variance: a.variance * b.variance,
  };
}

export { NO_INSTRUCTION };

/** What the staff would tell him to do, for a player who would rather be told. */
export function recommendedPlan(group: PositionGroup, report: OpponentReport): MatchPlanId {
  const options = plansFor(group);
  let best = options[0]!;
  let bestFit = -2;
  for (const plan of options) {
    const fit = planFit(plan, report);
    if (fit > bestFit) {
      best = plan;
      bestFit = fit;
    }
  }
  return best.id;
}
