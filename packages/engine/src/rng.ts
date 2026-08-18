/**
 * Deterministic random number generator.
 *
 * The whole engine draws from this and never from Math.random(), so a career
 * is fully reproducible from its seed: same seed + same decisions => same career.
 */

const UINT32 = 0x100000000;

/** FNV-1a, used to turn a label into a seed offset when forking a stream. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  /** Snapshot for saving mid-career. */
  getState(): number {
    return this.state;
  }

  static fromState(state: number): Rng {
    const r = new Rng(1);
    r.state = state >>> 0;
    return r;
  }

  /** mulberry32 — small, fast, good enough distribution for a game. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32;
  }

  /** Independent stream derived from this one. Advances the parent by one draw. */
  fork(label: string): Rng {
    const seed = (hashString(label) ^ Math.floor(this.next() * UINT32)) >>> 0;
    return new Rng(seed);
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    if (max < min) return min;
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: empty array');
    return items[this.int(0, items.length - 1)]!;
  }

  /** Weighted pick. Non-positive weights are skipped. Returns null if nothing is eligible. */
  weighted<T>(items: readonly T[], weightOf: (item: T, index: number) => number): T | null {
    let total = 0;
    const weights: number[] = [];
    for (let i = 0; i < items.length; i++) {
      const w = Math.max(0, weightOf(items[i]!, i));
      weights.push(w);
      total += w;
    }
    if (total <= 0) return null;
    let roll = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i]!;
      if (roll <= 0) return items[i]!;
    }
    return items[items.length - 1]!;
  }

  /** Shuffle a copy (Fisher-Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const a = out[i]!;
      out[i] = out[j]!;
      out[j] = a;
    }
    return out;
  }

  /** Normal draw via Box-Muller, clamped to +/- 3.5 sd so nothing absurd escapes. */
  gauss(mean: number, sd: number): number {
    const u1 = Math.max(this.next(), 1e-12);
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + sd * clamp(z, -3.5, 3.5);
  }

  /** Normal draw clamped to a hard range. */
  gaussIn(mean: number, sd: number, min: number, max: number): number {
    return clamp(this.gauss(mean, sd), min, max);
  }
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Logistic curve. Used everywhere a difference in quality becomes a probability. */
export function logistic(x: number, midpoint = 0, steepness = 1): number {
  return 1 / (1 + Math.exp(-steepness * (x - midpoint)));
}

/** Linear interpolation over a table of [x, y] breakpoints. */
export function interpolate(points: readonly (readonly [number, number])[], x: number): number {
  if (points.length === 0) return 0;
  const first = points[0]!;
  if (x <= first[0]) return first[1];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const cur = points[i]!;
    if (x <= cur[0]) {
      const span = cur[0] - prev[0];
      if (span === 0) return cur[1];
      const t = (x - prev[0]) / span;
      return prev[1] + t * (cur[1] - prev[1]);
    }
  }
  return points[points.length - 1]![1];
}

export function randomSeed(): number {
  // Only used when creating a brand new career, never inside simulation.
  return Math.floor(Math.random() * UINT32) >>> 0;
}
