import type { AttributeKey, Attributes, Position, PositionGroup } from './types.js';
import { clamp } from './rng.js';

/**
 * Attribute weights per position. OVR is derived from these, never stored, so the
 * same set of attributes gives a different rating depending on where you play.
 */
export const POSITION_WEIGHTS: Record<Position, Partial<Record<AttributeKey, number>>> = {
  GK: {
    reflexes: 0.22, handling: 0.16, positioningGK: 0.16, kicking: 0.08,
    concentration: 0.10, decisions: 0.08, composure: 0.06, jumping: 0.06, agility: 0.08,
  },
  CB: {
    marking: 0.16, tackling: 0.16, heading: 0.12, strength: 0.12, positioning: 0.10,
    decisions: 0.08, jumping: 0.08, concentration: 0.07, passing: 0.05, pace: 0.06,
  },
  RB: {
    tackling: 0.12, marking: 0.10, pace: 0.12, stamina: 0.12, crossing: 0.10, positioning: 0.08,
    passing: 0.08, workRate: 0.08, acceleration: 0.08, dribbling: 0.06, decisions: 0.06,
  },
  LB: {
    tackling: 0.12, marking: 0.10, pace: 0.12, stamina: 0.12, crossing: 0.10, positioning: 0.08,
    passing: 0.08, workRate: 0.08, acceleration: 0.08, dribbling: 0.06, decisions: 0.06,
  },
  RWB: {
    pace: 0.13, stamina: 0.13, crossing: 0.12, dribbling: 0.10, tackling: 0.08, marking: 0.06,
    workRate: 0.10, acceleration: 0.10, passing: 0.08, positioning: 0.05, decisions: 0.05,
  },
  LWB: {
    pace: 0.13, stamina: 0.13, crossing: 0.12, dribbling: 0.10, tackling: 0.08, marking: 0.06,
    workRate: 0.10, acceleration: 0.10, passing: 0.08, positioning: 0.05, decisions: 0.05,
  },
  CDM: {
    tackling: 0.14, positioning: 0.12, decisions: 0.12, passing: 0.12, marking: 0.10,
    workRate: 0.10, strength: 0.08, composure: 0.07, concentration: 0.08, vision: 0.07,
  },
  CM: {
    passing: 0.16, vision: 0.12, decisions: 0.12, ballControl: 0.10, stamina: 0.10,
    workRate: 0.08, tackling: 0.08, firstTouch: 0.08, composure: 0.08, positioning: 0.08,
  },
  CAM: {
    vision: 0.16, passing: 0.14, dribbling: 0.12, ballControl: 0.12, firstTouch: 0.10,
    decisions: 0.10, composure: 0.08, shooting: 0.08, agility: 0.05, finishing: 0.05,
  },
  RM: {
    crossing: 0.14, pace: 0.12, dribbling: 0.12, stamina: 0.10, passing: 0.10, workRate: 0.08,
    acceleration: 0.10, ballControl: 0.08, vision: 0.08, firstTouch: 0.08,
  },
  LM: {
    crossing: 0.14, pace: 0.12, dribbling: 0.12, stamina: 0.10, passing: 0.10, workRate: 0.08,
    acceleration: 0.10, ballControl: 0.08, vision: 0.08, firstTouch: 0.08,
  },
  RW: {
    dribbling: 0.16, pace: 0.14, acceleration: 0.13, ballControl: 0.12, crossing: 0.10,
    finishing: 0.10, agility: 0.08, firstTouch: 0.09, vision: 0.08,
  },
  LW: {
    dribbling: 0.16, pace: 0.14, acceleration: 0.13, ballControl: 0.12, crossing: 0.10,
    finishing: 0.10, agility: 0.08, firstTouch: 0.09, vision: 0.08,
  },
  CF: {
    finishing: 0.16, shooting: 0.12, ballControl: 0.12, firstTouch: 0.12, dribbling: 0.10,
    composure: 0.10, passing: 0.08, vision: 0.08, strength: 0.06, positioning: 0.06,
  },
  ST: {
    finishing: 0.22, shooting: 0.14, composure: 0.12, positioning: 0.12, heading: 0.10,
    strength: 0.09, pace: 0.08, firstTouch: 0.08, acceleration: 0.05,
  },
};

const NORMALISED: Record<Position, [AttributeKey, number][]> = (() => {
  const out = {} as Record<Position, [AttributeKey, number][]>;
  for (const pos of Object.keys(POSITION_WEIGHTS) as Position[]) {
    const raw = POSITION_WEIGHTS[pos];
    const entries = Object.entries(raw) as [AttributeKey, number][];
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    out[pos] = entries.map(([k, w]) => [k, w / total]);
  }
  return out;
})();

export function positionGroup(pos: Position): PositionGroup {
  if (pos === 'GK') return 'GK';
  if (pos === 'CB' || pos === 'RB' || pos === 'LB' || pos === 'RWB' || pos === 'LWB') return 'DEF';
  if (pos === 'CDM' || pos === 'CM' || pos === 'CAM' || pos === 'RM' || pos === 'LM') return 'MID';
  return 'ATT';
}

export function isGoalkeeper(pos: Position): boolean {
  return pos === 'GK';
}

/** Rating for a player in a specific position. */
export function ratingAt(attributes: Attributes, pos: Position): number {
  let sum = 0;
  for (const [key, weight] of NORMALISED[pos]) {
    sum += (attributes[key] ?? 1) * weight;
  }
  return clamp(Math.round(sum), 1, 99);
}

/** Headline OVR: rating in the player's best position among primary + secondary. */
export function overall(attributes: Attributes, primary: Position, secondary: Position[] = []): number {
  let best = ratingAt(attributes, primary);
  for (const pos of secondary) {
    const r = Math.round(ratingAt(attributes, pos) * 0.98);
    if (r > best) best = r;
  }
  return best;
}

/**
 * How natural a player is in a given slot.
 * 1.0 primary, 0.92 secondary, then by tactical adjacency, floor 0.55 (0.35 for outfield in goal).
 */
const ADJACENCY: Record<Position, Position[]> = {
  GK: [],
  CB: ['RB', 'LB', 'CDM'],
  RB: ['RWB', 'CB', 'RM'],
  LB: ['LWB', 'CB', 'LM'],
  RWB: ['RB', 'RM', 'RW'],
  LWB: ['LB', 'LM', 'LW'],
  CDM: ['CM', 'CB'],
  CM: ['CDM', 'CAM', 'RM', 'LM'],
  CAM: ['CM', 'CF', 'RW', 'LW'],
  RM: ['RW', 'RWB', 'CM', 'RB'],
  LM: ['LW', 'LWB', 'CM', 'LB'],
  RW: ['RM', 'CAM', 'CF', 'ST'],
  LW: ['LM', 'CAM', 'CF', 'ST'],
  CF: ['ST', 'CAM', 'RW', 'LW'],
  ST: ['CF', 'RW', 'LW'],
};

export function tacticalFit(player: { primaryPos: Position; secondaryPos: Position[] }, slot: Position): number {
  if (player.primaryPos === slot) return 1;
  if (player.secondaryPos.includes(slot)) return 0.92;
  if (slot === 'GK' || player.primaryPos === 'GK') return 0.3;
  if (ADJACENCY[player.primaryPos]?.includes(slot)) return 0.8;
  if (positionGroup(player.primaryPos) === positionGroup(slot)) return 0.7;
  return 0.55;
}

export const FORMATIONS: Record<string, Position[]> = {
  '4-3-3': ['GK', 'RB', 'CB', 'CB', 'LB', 'CDM', 'CM', 'CM', 'RW', 'ST', 'LW'],
  '4-2-3-1': ['GK', 'RB', 'CB', 'CB', 'LB', 'CDM', 'CDM', 'RM', 'CAM', 'LM', 'ST'],
  '4-4-2': ['GK', 'RB', 'CB', 'CB', 'LB', 'RM', 'CM', 'CM', 'LM', 'ST', 'ST'],
  '3-5-2': ['GK', 'CB', 'CB', 'CB', 'RWB', 'CM', 'CM', 'CDM', 'LWB', 'ST', 'ST'],
  '4-1-4-1': ['GK', 'RB', 'CB', 'CB', 'LB', 'CDM', 'RM', 'CM', 'CM', 'LM', 'ST'],
  '5-3-2': ['GK', 'RWB', 'CB', 'CB', 'CB', 'LWB', 'CDM', 'CM', 'CM', 'ST', 'ST'],
};

export const FORMATION_NAMES = Object.keys(FORMATIONS);
