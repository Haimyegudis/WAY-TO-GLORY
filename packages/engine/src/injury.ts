import { Rng, clamp } from './rng.js';
import { DIET_INJURY, FOCUS_LOAD } from './development.js';
import type { Injury, InjurySeverity, Player, TrainingPlan } from './types.js';

interface InjuryType {
  type: string;
  severities: InjurySeverity[];
  weeks: Record<InjurySeverity, [number, number]>;
  recurrenceProne: boolean;
}

const TYPES: InjuryType[] = [
  {
    type: 'hamstring',
    severities: ['minor', 'moderate', 'serious'],
    weeks: { minor: [1, 3], moderate: [3, 7], serious: [7, 14], major: [14, 22], careerThreatening: [30, 52] },
    recurrenceProne: true,
  },
  {
    type: 'ankle',
    severities: ['minor', 'moderate', 'serious'],
    weeks: { minor: [1, 3], moderate: [4, 8], serious: [8, 16], major: [16, 26], careerThreatening: [30, 52] },
    recurrenceProne: true,
  },
  {
    type: 'knock',
    severities: ['minor'],
    weeks: { minor: [1, 2], moderate: [2, 3], serious: [3, 5], major: [6, 10], careerThreatening: [20, 40] },
    recurrenceProne: false,
  },
  {
    type: 'groin',
    severities: ['minor', 'moderate'],
    weeks: { minor: [1, 3], moderate: [3, 8], serious: [8, 14], major: [14, 20], careerThreatening: [26, 44] },
    recurrenceProne: true,
  },
  {
    type: 'calf',
    severities: ['minor', 'moderate'],
    weeks: { minor: [1, 3], moderate: [3, 7], serious: [7, 12], major: [12, 20], careerThreatening: [26, 40] },
    recurrenceProne: true,
  },
  {
    type: 'shoulder',
    severities: ['moderate', 'serious'],
    weeks: { minor: [1, 3], moderate: [3, 8], serious: [8, 16], major: [16, 24], careerThreatening: [30, 48] },
    recurrenceProne: false,
  },
  {
    type: 'metatarsal',
    severities: ['moderate', 'serious', 'major'],
    weeks: { minor: [2, 4], moderate: [5, 9], serious: [9, 16], major: [16, 26], careerThreatening: [30, 52] },
    recurrenceProne: false,
  },
  {
    type: 'acl',
    severities: ['major', 'careerThreatening'],
    weeks: { minor: [8, 12], moderate: [16, 22], serious: [22, 30], major: [26, 40], careerThreatening: [40, 64] },
    recurrenceProne: true,
  },
  {
    type: 'backStrain',
    severities: ['minor', 'moderate'],
    weeks: { minor: [1, 3], moderate: [3, 7], serious: [7, 12], major: [12, 18], careerThreatening: [24, 40] },
    recurrenceProne: false,
  },
];

/*
 * How bad it usually is.
 *
 * Measured over twelve careers the old spread cost him eleven weeks of every season and
 * a quarter of his club's matches - roughly twice what a fit professional loses. Most of
 * what football does to a body is a fortnight, and the weights say so now; the serious
 * end still exists, and an ACL still ends a year, they are simply as rare as they are in
 * life rather than as common as a knock.
 */
const SEVERITY_WEIGHT: Record<InjurySeverity, number> = {
  minor: 64,
  moderate: 24,
  serious: 8,
  major: 3,
  careerThreatening: 0.6,
};

let injuryCounter = 0;

export function rollInjury(rng: Rng, player: Player, season: number, contextRisk = 1): Injury {
  const age = season - player.birthYear;
  const ageRisk = age > 30 ? 1 + (age - 30) * 0.06 : 1;
  const historyRisk = 1 + player.condition.injuryHistory.length * 0.03;

  const type = rng.weighted(TYPES, (t) => {
    const priorSame = player.condition.injuryHistory.filter((i) => i.type === t.type).length;
    return (t.recurrenceProne ? 1 + priorSame * 0.6 : 1) * (t.type === 'acl' ? 0.2 : 1);
  })!;

  // Dividing every weight by the same number changes nothing once the weights are
  // normalised, which is why age, fatigue and a long injury history used to have no
  // effect on how bad an injury was. Risk now tilts the distribution: the serious end
  // gets heavier and the knocks get lighter.
  const risk = contextRisk * ageRisk * historyRisk;
  const SEVERITY_ORDER: InjurySeverity[] = ['minor', 'moderate', 'serious', 'major', 'careerThreatening'];
  const severity =
    rng.weighted(type.severities, (s) => {
      const step = SEVERITY_ORDER.indexOf(s);          // 0 for a knock, 4 for the worst
      return SEVERITY_WEIGHT[s] * Math.pow(risk, step - 1);
    }) ?? type.severities[0]!;

  const [minW, maxW] = type.weeks[severity];
  const weeks = Math.max(1, Math.round(rng.int(minW, maxW) * clamp(ageRisk * 0.9, 0.85, 1.4)));
  const priorSame = player.condition.injuryHistory.find((i) => i.type === type.type);

  injuryCounter = (injuryCounter + 1) % 100000;
  const injury: Injury = {
    id: `inj_${season}_${injuryCounter}`,
    type: type.type,
    severity,
    weeksOut: weeks,
    weeksRemaining: weeks,
    season,
    ...(priorSame ? { recurrenceOf: priorSame.type } : {}),
  };
  return injury;
}

/** Weekly chance of picking up an injury in training. */
export function trainingInjuryChance(player: Player, plan: TrainingPlan, season: number): number {
  const intensityFactor: Record<TrainingPlan['intensity'], number> = {
    light: 0.35, normal: 1, intensive: 1.55, extreme: 2.5,
  };
  const age = season - player.birthYear;
  const ageFactor = age > 30 ? 1 + (age - 30) * 0.07 : age < 18 ? 1.15 : 1;
  const fatigueFactor = 1 + player.condition.fatigue / 90;
  const durability = (player.attributes.strength + player.attributes.balance + player.attributes.agility) / 3;
  const proFactor = 1.15 - player.personality.professionalism / 400;
  return clamp(
    0.0034 * intensityFactor[plan.intensity] * ageFactor * fatigueFactor * proFactor * DIET_INJURY[plan.diet]
      * FOCUS_LOAD[plan.focus].injury * (1.3 - durability / 200),
    0.0003,
    0.2,
  );
}

/**
 * What the medical room offers him, and what each of them is really a bet on.
 *
 * A footballer does not choose how long he is out; he chooses which risk he takes and
 * then finds out. Surgery is the long, safe road and it is the only road for some of
 * these. An injection gets him on the pitch on Saturday and lies to his body about what
 * is wrong with it. Conservative treatment is what a club does when nobody wants to
 * gamble. And a proper rest is longer than it needs to be on purpose, because coming
 * back properly is worth more than coming back early.
 *
 * Every one of them is rolled: the same choice on the same injury can come back early,
 * on time, or worse than it started, and the odds are what separates the four options.
 */
export type TreatmentChoice = 'surgery' | 'injection' | 'conservative' | 'longRest' | 'playThrough';

export interface TreatmentProfile {
  id: TreatmentChoice;
  /** Multiplier on the weeks he was told, before the roll. */
  weeks: [number, number];
  /** Chance the recovery goes better than anybody expected. */
  goodChance: number;
  /** Chance it goes wrong and the weeks get longer. */
  setbackChance: number;
  /** How much of it he carries with him afterwards. */
  aggravationRisk: number;
  /** What comes back with him: 1 is everything. */
  quality: [number, number];
}

export const TREATMENTS: Record<TreatmentChoice, TreatmentProfile> = {
  surgery: {
    id: 'surgery',
    weeks: [1.15, 1.5],
    goodChance: 0.18,
    setbackChance: 0.08,
    aggravationRisk: 0.05,
    quality: [0.99, 1],
  },
  injection: {
    id: 'injection',
    weeks: [0.3, 0.55],
    goodChance: 0.3,
    setbackChance: 0.42,
    aggravationRisk: 0.5,
    quality: [0.93, 0.985],
  },
  conservative: {
    id: 'conservative',
    weeks: [0.7, 0.95],
    goodChance: 0.22,
    setbackChance: 0.22,
    aggravationRisk: 0.24,
    quality: [0.965, 0.995],
  },
  longRest: {
    id: 'longRest',
    weeks: [1.1, 1.35],
    goodChance: 0.26,
    setbackChance: 0.05,
    aggravationRisk: 0.02,
    quality: [1, 1.01],
  },
  // Kept for the pack event that offers it: no treatment at all, straight back out.
  playThrough: {
    id: 'playThrough',
    weeks: [0, 0],
    goodChance: 0,
    setbackChance: 0.62,
    aggravationRisk: 0.62,
    quality: [0.9, 0.97],
  },
};

/**
 * Which of them a doctor would actually put in front of him for this injury.
 *
 * Nobody operates on a dead leg and nobody injects a cruciate. The list is the injury's
 * list, not a menu that is the same every time.
 */
export function treatmentsFor(injury: Injury): TreatmentChoice[] {
  const severe = injury.severity === 'major' || injury.severity === 'careerThreatening';
  const structural = injury.type === 'acl' || injury.type === 'metatarsal' || injury.type === 'shoulder';

  if (severe || (structural && injury.severity === 'serious')) {
    // A knee or a broken bone: an operation, or the long way round with a specialist.
    return ['surgery', 'conservative', 'longRest'];
  }
  if (injury.severity === 'minor') {
    // A knock. Nobody is opening him up for this.
    return ['injection', 'conservative', 'longRest'];
  }
  return structural
    ? ['surgery', 'conservative', 'longRest']
    : ['injection', 'conservative', 'longRest'];
}

export interface TreatmentResult {
  choice: TreatmentChoice;
  weeksBefore: number;
  weeksAfter: number;
  /** better, expected or worse than the room told him. */
  outcome: 'better' | 'expected' | 'setback';
  aggravationRisk: number;
  recoveryQuality: number;
}

/**
 * Taking the treatment. The profile decides the shape of the bet; the roll decides how
 * this one went, and the club's medical people tilt it a little in his favour.
 */
export function treatInjury(
  rng: Rng,
  injury: Injury,
  choice: TreatmentChoice,
  /** How good the medical room is, 0-100. A big club heals people faster. */
  facilities = 50,
): TreatmentResult {
  const profile = TREATMENTS[choice];
  const weeksBefore = injury.weeksOut;
  const care = clamp((facilities - 50) / 200, -0.12, 0.12);

  const roll = rng.next();
  const good = clamp(profile.goodChance + care, 0.02, 0.6);
  const bad = clamp(profile.setbackChance - care, 0.01, 0.7);
  const outcome: TreatmentResult['outcome'] = roll < good ? 'better' : roll > 1 - bad ? 'setback' : 'expected';

  const band = rng.range(profile.weeks[0], profile.weeks[1]);
  const swing = outcome === 'better' ? rng.range(0.45, 0.7) : outcome === 'setback' ? rng.range(1.35, 1.9) : 1;
  const weeks = Math.max(0, Math.round(weeksBefore * band * swing));

  injury.treatment = choice;
  injury.weeksOut = weeks;
  injury.weeksRemaining = weeks;

  const quality = clamp(
    rng.range(profile.quality[0], profile.quality[1]) - (outcome === 'setback' ? 0.02 : 0),
    0.85,
    1.01,
  );
  return {
    choice,
    weeksBefore,
    weeksAfter: weeks,
    outcome,
    aggravationRisk: clamp(profile.aggravationRisk * (outcome === 'setback' ? 1.4 : 1) - care, 0, 0.85),
    recoveryQuality: quality,
  };
}

export interface TreatmentOutcome {
  weeksOut: number;
  aggravationRisk: number;
  recoveryQuality: number; // multiplier applied to attributes on return, 1 = full
}

/** The old three-way call, kept for the pack event that still asks it. */
export function applyTreatment(rng: Rng, injury: Injury, choice: TreatmentChoice): TreatmentOutcome {
  const result = treatInjury(rng, injury, choice);
  return {
    weeksOut: result.weeksAfter,
    aggravationRisk: result.aggravationRisk,
    recoveryQuality: result.recoveryQuality,
  };
}

/** Advance active injuries one week. Returns the injuries that healed. */
export function tickInjuries(player: Player, addedThisWeek: ReadonlySet<string> = new Set()): Injury[] {
  const healed: Injury[] = [];
  const still: Injury[] = [];
  for (const injury of player.condition.injuries) {
    if (addedThisWeek.has(injury.id)) {
      still.push(injury);
      continue;
    }
    injury.weeksRemaining -= 1;
    if (injury.weeksRemaining <= 0) {
      healed.push(injury);
      player.condition.injuryHistory.push(injury);
    } else {
      still.push(injury);
    }
  }
  player.condition.injuries = still;
  if (healed.length > 0) {
    // Coming back is not the same as being back.
    player.condition.sharpness = Math.min(player.condition.sharpness, 35);
    player.fitness = Math.min(player.fitness, 72);
  }
  return healed;
}

export function isInjured(player: Player): boolean {
  return player.condition.injuries.length > 0;
}

