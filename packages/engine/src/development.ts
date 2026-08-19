import { Rng, clamp, interpolate } from './rng.js';
import { POSITION_WEIGHTS, overall, positionGroup } from './positions.js';
import {
  ATTRIBUTE_KEYS,
  MENTAL_ATTRS,
  PHYSICAL_ATTRS,
  type AttributeKey,
  type Player,
  type Position,
  type TrainingFocus,
  type TrainingPlan,
} from './types.js';

/**
 * Growth multiplier by age. Peaks in the late teens, still positive through the
 * twenties, turns negative around 31. Goalkeepers are shifted three years later.
 */
const AGE_CURVE: readonly (readonly [number, number])[] = [
  [14, 0.85], [16, 1.05], [18, 1.15], [20, 1.05], [22, 0.85], [24, 0.6],
  [26, 0.38], [28, 0.18], [30, 0.02], [31, -0.12], [33, -0.35], [35, -0.6], [38, -0.95], [42, -1.2],
];

export function ageFactor(age: number, pos: Position): number {
  const shift = pos === 'GK' ? 3 : 0;
  return interpolate(AGE_CURVE, age - shift);
}

/** How much room is left before the ceiling. Collapses to zero at potential. */
export function headroom(ovr: number, potential: number): number {
  const gap = potential - ovr;
  if (gap <= 0) return 0;
  if (gap >= 25) return 1;
  return clamp(gap / 25, 0, 1) ** 0.6;
}

const INTENSITY_DEV: Record<TrainingPlan['intensity'], number> = {
  light: 0.55, normal: 1.0, intensive: 1.3, extreme: 1.6,
};
const INTENSITY_FATIGUE: Record<TrainingPlan['intensity'], number> = {
  light: -3.5, normal: 1.2, intensive: 4.5, extreme: 9,
};
const DIET_FACTOR: Record<TrainingPlan['diet'], number> = {
  poor: 0.85, normal: 1.0, professional: 1.08, nutritionist: 1.14,
};
const DIET_RECOVERY: Record<TrainingPlan['diet'], number> = {
  poor: 0.7, normal: 1.0, professional: 1.2, nutritionist: 1.35,
};
/**
 * What a diet costs, in money, every week.
 *
 * A cook who weighs your food and a nutritionist who plans your month are people, and
 * people are paid. It is a share of the wage rather than a flat fee - the same standard
 * of eating costs a Premier League forward and a boy in the third tier very different
 * money - with a floor under it so a fifteen year old on nothing cannot buy the best
 * table in football out of pocket money.
 */
export const DIET_COST: Record<TrainingPlan['diet'], { share: number; floor: number }> = {
  poor: { share: 0, floor: 0 },
  normal: { share: 0, floor: 0 },
  professional: { share: 0.03, floor: 120 },
  nutritionist: { share: 0.08, floor: 420 },
};

/** What he pays this week for eating the way he has chosen to eat. */
export function dietCost(diet: TrainingPlan['diet'], weeklyWage: number): number {
  const rate = DIET_COST[diet];
  if (rate.share === 0) return 0;
  return Math.round(Math.max(rate.floor, weeklyWage * rate.share));
}

/**
 * What a diet costs you in the head. A weighed, policed week is hard to live with
 * month after month, so the stricter plans pull morale down a little every week while
 * the body benefits. Small numbers on purpose: one good run of games outweighs them.
 */
const DIET_MORALE: Record<TrainingPlan['diet'], number> = {
  poor: 0.4, normal: 0, professional: -0.3, nutritionist: -0.85,
};

const FOCUS_ATTRS: Record<TrainingFocus, AttributeKey[]> = {
  balanced: [],
  physical: ['pace', 'acceleration', 'strength', 'stamina', 'agility', 'balance', 'jumping'],
  technical: ['passing', 'crossing', 'dribbling', 'ballControl', 'firstTouch', 'shooting'],
  mental: ['decisions', 'composure', 'positioning', 'vision', 'concentration', 'leadership'],
  finishing: ['finishing', 'shooting', 'composure', 'positioning'],
  defending: ['tackling', 'marking', 'heading', 'positioning', 'strength', 'concentration'],
  goalkeeping: ['reflexes', 'handling', 'positioningGK', 'kicking'],
  recovery: [],
};

export interface DevelopmentContext {
  training: TrainingPlan;
  coachQuality: number;      // 0-100
  facilities: number;        // 0-100
  minutesPct: number;        // rolling share of available minutes, 0-1
  competitiveLevel: number;  // 0-100 quality of the football being played
  inSeason: boolean;
}

export interface DevelopmentBreakdown {
  age: number;
  ageFactor: number;
  headroom: number;
  training: number;
  playingTime: number;
  professionalism: number;
  morale: number;
  fitness: number;
  total: number;
  ovrBefore: number;
  ovrAfter: number;
}

/** One week of development. Attributes are floats internally and only rounded for display. */
export function developWeek(
  rng: Rng,
  player: Player,
  season: number,
  ctx: DevelopmentContext,
): DevelopmentBreakdown {
  const age = season - player.birthYear;
  const ovrBefore = overall(player.attributes, player.primaryPos, player.secondaryPos);

  const aF = ageFactor(age, player.primaryPos);
  const hR = headroom(ovrBefore, player.potential);

  const trainingF =
    INTENSITY_DEV[ctx.training.intensity] *
    DIET_FACTOR[ctx.training.diet] *
    (0.6 + ctx.coachQuality / 200 + ctx.facilities / 250);

  // Minutes matter more than anything else. A benched teenager stalls.
  const playingF = ctx.inSeason ? 0.35 + Math.min(1, ctx.minutesPct * 1.6) * 0.95 : 0.75;

  const proF = 0.7 + player.personality.professionalism / 170;
  const moraleF = 0.82 + player.morale / 550;
  const fitnessF = 0.7 + player.fitness / 330;
  const levelF = 0.85 + ctx.competitiveLevel / 400;

  const injuredPenalty = player.condition.injuries.length > 0 ? 0.25 : 1;

  let total =
    0.2 * aF * trainingF * playingF * proF * moraleF * fitnessF * levelF * injuredPenalty * rng.range(0.75, 1.3);

  if (aF > 0) total *= hR;

  applyGrowth(rng, player, total, ctx.training.focus, age);

  const ovrAfter = overall(player.attributes, player.primaryPos, player.secondaryPos);
  return {
    age,
    ageFactor: aF,
    headroom: hR,
    training: trainingF,
    playingTime: playingF,
    professionalism: proF,
    morale: moraleF,
    fitness: fitnessF,
    total,
    ovrBefore,
    ovrAfter,
  };
}

function applyGrowth(rng: Rng, player: Player, points: number, focus: TrainingFocus, age: number): void {
  if (points === 0) return;
  const weights = POSITION_WEIGHTS[player.primaryPos];
  const focusSet = new Set(FOCUS_ATTRS[focus]);
  const isGk = player.primaryPos === 'GK';

  if (points > 0) {
    // Growth concentrates on what the player's position and training care about.
    let totalWeight = 0;
    const share: Partial<Record<AttributeKey, number>> = {};
    for (const key of ATTRIBUTE_KEYS) {
      if (!isGk && (key === 'reflexes' || key === 'handling' || key === 'positioningGK' || key === 'kicking')) continue;
      // Attributes the position does not ask for still improve, just slower - otherwise
      // a player becomes unplayable anywhere except his exact slot.
      const posW = weights[key] ?? 0.035;
      const focusW = focusSet.has(key) ? 2.2 : focusSet.size === 0 ? 1 : 0.55;
      const w = posW * focusW;
      share[key] = w;
      totalWeight += w;
    }
    if (totalWeight <= 0) return;

    // `points` is expressed in OVR points, but gains land on individual attributes.
    // Normalise by how much this distribution actually moves the weighted OVR, so
    // one point of growth means one point of rating regardless of position.
    let ovrPerUnit = 0;
    for (const key of ATTRIBUTE_KEYS) {
      const w = share[key];
      if (!w) continue;
      ovrPerUnit += (weights[key] ?? 0) * (w / totalWeight);
    }
    if (ovrPerUnit <= 0) return;

    for (const key of ATTRIBUTE_KEYS) {
      const w = share[key];
      if (!w) continue;
      const gain = (points * (w / totalWeight) / ovrPerUnit) * rng.range(0.6, 1.4);
      player.attributes[key] = clamp(player.attributes[key] + gain, 1, 99);
    }
    return;
  }

  // Decline: legs go first, the head keeps improving for a while.
  const decline = -points;
  for (const key of ATTRIBUTE_KEYS) {
    const isPhysical = (PHYSICAL_ATTRS as readonly AttributeKey[]).includes(key);
    const isMental = (MENTAL_ATTRS as readonly AttributeKey[]).includes(key);
    let factor = 1;
    if (isPhysical) factor = 2.3;
    else if (isMental) factor = age < 34 ? -0.35 : 0.2;
    else factor = 0.7;
    const change = -decline * factor * rng.range(0.7, 1.3);
    player.attributes[key] = clamp(player.attributes[key] + change, 1, 99);
  }
}

/**
 * End of season: potential drifts based on whether the season beat expectations.
 * A wasted season at 19 costs a player real ceiling; a breakout season buys some back.
 */
export function driftPotential(
  rng: Rng,
  player: Player,
  season: number,
  performanceScore: number, // -1 bad .. +1 great
): number {
  const age = season - player.birthYear;
  if (age > 25) return 0;
  const youthWeight = clamp((26 - age) / 10, 0.2, 1);
  // A merely ordinary season should not cost a young player his ceiling; only a
  // genuinely wasted one does. Good seasons buy ceiling back faster than bad ones take it.
  const effective = performanceScore > 0 ? performanceScore : Math.min(0, performanceScore + 0.25) * 0.7;
  const drift = effective * youthWeight * rng.range(1.2, 3.2);
  const before = player.potential;
  player.potential = clamp(Math.round(player.potential + drift), 40, 99);
  const ovr = overall(player.attributes, player.primaryPos, player.secondaryPos);
  if (player.potential < ovr) player.potential = ovr;
  return player.potential - before;
}

/** How much of his edge a training load keeps or costs him each week. */
const INTENSITY_SHARPNESS: Record<TrainingPlan['intensity'], number> = {
  light: -2.6,
  normal: -0.4,
  intensive: 1.6,
  extreme: 2.4,
};

/** The fitness ceiling a training load can hold. Coasting has a cost. */
const INTENSITY_FITNESS_CEILING: Record<TrainingPlan['intensity'], number> = {
  light: 84,
  normal: 96,
  intensive: 100,
  extreme: 100,
};

/**
 * Weekly bookkeeping for the body. Training is a real choice here: train too hard
 * and he is exhausted and breakable, coast and he loses sharpness and his ceiling
 * of fitness drops, which shows up in his ratings before it shows up anywhere else.
 */
export function updateCondition(
  player: Player,
  plan: TrainingPlan,
  playedMinutes: number,
): void {
  const cond = player.condition;
  const recovery = DIET_RECOVERY[plan.diet];
  const stamina = player.attributes.stamina;

  const matchFatigue = (playedMinutes / 90) * (14 - stamina / 12);
  const trainingFatigue = INTENSITY_FATIGUE[plan.intensity];
  const naturalRecovery = (6 + stamina / 14) * recovery;

  cond.fatigue = clamp(cond.fatigue + matchFatigue + trainingFatigue - naturalRecovery, 0, 100);

  const matchSharpness = playedMinutes > 0 ? Math.min(12, playedMinutes / 8) : -3.5;
  cond.sharpness = clamp(cond.sharpness + matchSharpness + INTENSITY_SHARPNESS[plan.intensity], 0, 100);

  const ceiling = INTENSITY_FITNESS_CEILING[plan.intensity] * (0.94 + DIET_FACTOR[plan.diet] * 0.06);
  const targetFitness = Math.min(ceiling, 100 - cond.fatigue * 0.75);
  player.fitness = clamp(player.fitness + (targetFitness - player.fitness) * 0.45, 20, 100);

  player.morale = clamp(player.morale + DIET_MORALE[plan.diet], 0, 100);
}

/** Form drifts toward recent match ratings and decays toward the mean when idle. */
export function updateForm(player: Player, recentRatings: number[]): void {
  if (recentRatings.length === 0) {
    player.form = clamp(player.form + (50 - player.form) * 0.12, 0, 100);
    return;
  }
  const avg = recentRatings.reduce((a, b) => a + b, 0) / recentRatings.length;
  // 6.6 is an average performance, so an average run of games keeps form at 50.
  const target = clamp(50 + (avg - 6.6) * 28, 0, 100);
  const consistency = player.personality.consistency / 100;
  player.form = clamp(player.form + (target - player.form) * (0.25 + consistency * 0.2), 0, 100);
}

export function playerAge(player: Player, season: number): number {
  return season - player.birthYear;
}

export function positionalGroupOf(player: Player) {
  return positionGroup(player.primaryPos);
}
