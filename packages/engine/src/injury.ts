import { Rng, clamp } from './rng.js';
import { DIET_INJURY } from './development.js';
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
    severities: ['serious', 'major'],
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

const SEVERITY_WEIGHT: Record<InjurySeverity, number> = {
  minor: 56,
  moderate: 26,
  serious: 12,
  major: 5,
  careerThreatening: 1,
};

let injuryCounter = 0;

export function rollInjury(rng: Rng, player: Player, season: number, contextRisk = 1): Injury {
  const age = season - player.birthYear;
  const ageRisk = age > 30 ? 1 + (age - 30) * 0.06 : 1;
  const historyRisk = 1 + player.condition.injuryHistory.length * 0.03;

  const type = rng.weighted(TYPES, (t) => {
    const priorSame = player.condition.injuryHistory.filter((i) => i.type === t.type).length;
    return (t.recurrenceProne ? 1 + priorSame * 0.6 : 1) * (t.type === 'acl' ? 0.35 : 1);
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
    light: 0.35, normal: 1, intensive: 1.9, extreme: 3.6,
  };
  const age = season - player.birthYear;
  const ageFactor = age > 30 ? 1 + (age - 30) * 0.07 : age < 18 ? 1.15 : 1;
  const fatigueFactor = 1 + player.condition.fatigue / 90;
  const durability = (player.attributes.strength + player.attributes.balance + player.attributes.agility) / 3;
  const proFactor = 1.15 - player.personality.professionalism / 400;
  return clamp(
    0.006 * intensityFactor[plan.intensity] * ageFactor * fatigueFactor * proFactor * DIET_INJURY[plan.diet] *
      (1.3 - durability / 200),
    0.0005,
    0.2,
  );
}

export type TreatmentChoice = 'surgery' | 'conservative' | 'playThrough';

export interface TreatmentOutcome {
  weeksOut: number;
  aggravationRisk: number;
  recoveryQuality: number; // multiplier applied to attributes on return, 1 = full
}

/** Treatment choices are presented as risk, never as percentages. */
export function applyTreatment(rng: Rng, injury: Injury, choice: TreatmentChoice): TreatmentOutcome {
  injury.treatment = choice;
  switch (choice) {
    case 'surgery': {
      const weeks = Math.round(injury.weeksOut * rng.range(1.15, 1.5));
      injury.weeksRemaining = weeks;
      injury.weeksOut = weeks;
      return { weeksOut: weeks, aggravationRisk: 0.06, recoveryQuality: rng.range(0.985, 1.0) };
    }
    case 'conservative': {
      const weeks = Math.round(injury.weeksOut * rng.range(0.6, 0.85));
      injury.weeksRemaining = weeks;
      injury.weeksOut = weeks;
      return { weeksOut: weeks, aggravationRisk: 0.28, recoveryQuality: rng.range(0.955, 0.995) };
    }
    case 'playThrough': {
      injury.weeksRemaining = 0;
      return { weeksOut: 0, aggravationRisk: 0.62, recoveryQuality: rng.range(0.9, 0.97) };
    }
  }
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

export function totalDaysOut(player: Player): number {
  return player.condition.injuryHistory.reduce((sum, i) => sum + i.weeksOut * 7, 0);
}
