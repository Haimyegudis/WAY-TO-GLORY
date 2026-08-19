import { Rng } from './rng.js';
import type { PositionGroup, SquadRole } from './types.js';

/**
 * Half time.
 *
 * Forty-five minutes gone, a dressing room, and somebody telling him what the second
 * half is going to look like. In a career that is not a tactics screen - he is one
 * player, not the manager - so what he gets is an instruction about himself: get
 * further forward, stop leaving that gap, stop shooting from there, save your legs.
 *
 * Whether he is told or asked depends on where he stands. A key player with the
 * manager's trust is left to decide; a nineteen year old on the bench is told. Refusing
 * is allowed, and it costs, and if the second half comes off he gets it back with
 * interest - which is how a player becomes somebody the manager listens to.
 *
 * Every instruction is a trade. There is no option that makes him better at everything
 * for forty-five minutes.
 */

export type HalfTimeInstructionId =
  | 'pushForward'
  | 'holdShape'
  | 'createForOthers'
  | 'takeThemOn'
  | 'saveLegs'
  | 'chaseEverything';

export const HALF_TIME_INSTRUCTIONS_ORDER: readonly HalfTimeInstructionId[] = [
  'pushForward', 'holdShape', 'createForOthers', 'takeThemOn', 'saveLegs', 'chaseEverything',
];

/**
 * Multipliers applied to the second half only. 1 means unchanged; the numbers are
 * deliberately small, because forty-five minutes of trying harder is worth something
 * and it is not worth a different player.
 */
export interface HalfTimeEffect {
  /** How often the ball finds him. */
  involvement: number;
  /** Whether he shoots or looks for somebody better placed. */
  shooting: number;
  /** How often he is the one who makes the goal. */
  creating: number;
  /** Tackles, blocks, and being where he is supposed to be. */
  defending: number;
  /** What the half takes out of his legs. */
  fatigue: number;
  cardRisk: number;
  injuryRisk: number;
  /** How wide the spread on the half is: a gamble is a gamble. */
  variance: number;
}

export const HALF_TIME_INSTRUCTIONS: Record<HalfTimeInstructionId, HalfTimeEffect> = {
  // Get up there. Somebody has to, and the space behind is the price.
  pushForward: {
    involvement: 1.3, shooting: 1.25, creating: 1.05, defending: 0.7,
    fatigue: 1.25, cardRisk: 1.05, injuryRisk: 1.1, variance: 1.15,
  },
  // Hold the shape, see it out, do not be the reason it goes wrong.
  holdShape: {
    involvement: 0.78, shooting: 0.7, creating: 0.9, defending: 1.35,
    fatigue: 0.9, cardRisk: 0.75, injuryRisk: 0.9, variance: 0.8,
  },
  // Stop trying to be the hero and give it to the man who is free.
  createForOthers: {
    involvement: 1.1, shooting: 0.6, creating: 1.45, defending: 0.95,
    fatigue: 1.05, cardRisk: 0.95, injuryRisk: 1, variance: 0.95,
  },
  // Run at the full-back until something gives. Something usually does, in one direction
  // or the other.
  takeThemOn: {
    involvement: 1.2, shooting: 1.15, creating: 1.2, defending: 0.8,
    fatigue: 1.2, cardRisk: 1.1, injuryRisk: 1.25, variance: 1.4,
  },
  // Nothing stupid, nothing wasted. There is another match on Wednesday.
  saveLegs: {
    involvement: 0.7, shooting: 0.85, creating: 0.85, defending: 0.85,
    fatigue: 0.65, cardRisk: 0.7, injuryRisk: 0.7, variance: 0.85,
  },
  // Every ball, every second ball, every lost cause.
  chaseEverything: {
    involvement: 1.15, shooting: 0.95, creating: 1, defending: 1.25,
    fatigue: 1.45, cardRisk: 1.35, injuryRisk: 1.3, variance: 1.1,
  },
};

/** No instruction at all: the second half plays exactly like the first. */
export const NO_INSTRUCTION: HalfTimeEffect = {
  involvement: 1, shooting: 1, creating: 1, defending: 1,
  fatigue: 1, cardRisk: 1, injuryRisk: 1, variance: 1,
};

export function halfTimeEffect(id: HalfTimeInstructionId | null | undefined): HalfTimeEffect {
  return id ? HALF_TIME_INSTRUCTIONS[id] : NO_INSTRUCTION;
}

/** The roles a manager talks at rather than to. */
const TOLD_WHAT_TO_DO: readonly SquadRole[] = [
  'academy', 'futureProspect', 'prospect', 'fringe', 'bench',
];

/**
 * Whether he is given orders or left to work it out. Standing in the squad matters more
 * than form: a manager tells a nineteen year old what to do however well he is playing.
 */
export function managerDictates(managerTrust: number, role: SquadRole): boolean {
  if (TOLD_WHAT_TO_DO.includes(role)) return true;
  return managerTrust < 55;
}

/**
 * What the manager wants, read off the scoreboard and off how the first half went.
 * Losing means get forward; winning means hold what you have; a poor half means run
 * until you have earned the shirt back.
 */
export function managerDemand(
  rng: Rng,
  scoreDiff: number,
  userRating: number,
  group: PositionGroup,
): HalfTimeInstructionId {
  if (userRating < 6.2) return rng.chance(0.6) ? 'chaseEverything' : 'holdShape';
  if (scoreDiff <= -1) {
    if (group === 'DEF' || group === 'GK') return rng.chance(0.5) ? 'holdShape' : 'pushForward';
    return rng.chance(0.65) ? 'pushForward' : 'takeThemOn';
  }
  if (scoreDiff >= 1) {
    if (group === 'ATT') return rng.chance(0.5) ? 'createForOthers' : 'holdShape';
    return rng.chance(0.7) ? 'holdShape' : 'saveLegs';
  }
  if (group === 'ATT') return rng.chance(0.5) ? 'takeThemOn' : 'createForOthers';
  if (group === 'MID') return rng.chance(0.5) ? 'pushForward' : 'chaseEverything';
  return rng.chance(0.6) ? 'holdShape' : 'chaseEverything';
}

/**
 * The instructions he is allowed to choose from. A goalkeeper is not told to run at
 * the full-back, and a defender is not told to play for others in the final third.
 */
export function instructionsFor(group: PositionGroup): HalfTimeInstructionId[] {
  if (group === 'GK') return ['holdShape', 'saveLegs', 'chaseEverything'];
  if (group === 'DEF') return ['holdShape', 'pushForward', 'chaseEverything', 'saveLegs'];
  return [...HALF_TIME_INSTRUCTIONS_ORDER];
}
