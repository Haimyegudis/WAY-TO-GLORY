import { Rng, clamp } from './rng.js';
import { FORMATIONS, ratingAt, tacticalFit } from './positions.js';
import type { Player, Position } from './types.js';

export interface SelectionContext {
  formation: string;
  /** Manager trust applies to the user only; AI players use reputation as a proxy. */
  managerTrust: number;
  userId: string;
  /** Higher when the fixture list is congested: more rotation. */
  rotationPressure: number;
  importantMatch: boolean;
}

export interface SelectionEntry {
  playerId: string;
  slot: Position;
  score: number;
}

export interface Lineup {
  formation: string;
  starters: SelectionEntry[];
  bench: string[];
  /** Everything the debug view needs to explain "why am I not playing". */
  scores: Record<string, number>;
}

export function isAvailable(player: Player): boolean {
  if (player.retired) return false;
  if (player.condition.injuries.length > 0) return false;
  if (player.condition.suspensions.some((s) => s.matchesRemaining > 0)) return false;
  return true;
}

/**
 * How strong a case this player has for this slot today.
 * The user is scored with exactly the same formula as everyone else.
 */
export function selectionScore(player: Player, slot: Position, ctx: SelectionContext): number {
  // ratingAt already re-weights the attributes for this slot, so fit is only an
  // unfamiliarity penalty on top - not a second multiplier.
  const base = ratingAt(player.attributes, slot);
  const fit = tacticalFit(player, slot);
  const trust = player.id === ctx.userId ? ctx.managerTrust : player.reputation * 0.85 + 10;

  const fatiguePenalty = player.condition.fatigue * (0.18 + ctx.rotationPressure * 0.2);
  const importanceBoost = ctx.importantMatch ? (player.personality.pressureHandling - 50) * 0.06 : 0;

  return (
    base +
    (player.form - 50) * 0.22 +
    (player.fitness - 70) * 0.18 +
    (trust - 50) * 0.30 +
    (fit - 1) * 14 +
    player.reputation * 0.08 +
    (player.morale - 50) * 0.04 +
    importanceBoost -
    fatiguePenalty
  );
}

/**
 * Managers pick the shape that suits the players they have. The club has a preferred
 * formation, but a clearly better XI in another shape wins - which is what lets a
 * good number ten force his way into a side that nominally plays 4-3-3.
 */
export function pickBestLineup(rng: Rng, squad: Player[], ctx: SelectionContext): Lineup {
  const preferred = pickLineup(rng, squad, ctx);
  let best = preferred;
  let bestScore = totalScore(preferred) + 6; // stickiness bonus for the club's own shape

  for (const formation of Object.keys(FORMATIONS)) {
    if (formation === ctx.formation) continue;
    const candidate = pickLineup(rng, squad, { ...ctx, formation });
    const score = totalScore(candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function totalScore(lineup: Lineup): number {
  return lineup.starters.reduce((sum, s) => sum + s.score, 0);
}

export function pickLineup(rng: Rng, squad: Player[], ctx: SelectionContext): Lineup {
  const slots = FORMATIONS[ctx.formation] ?? FORMATIONS['4-3-3']!;
  const available = squad.filter(isAvailable);
  const scores: Record<string, number> = {};

  for (const player of available) {
    scores[player.id] = selectionScore(player, player.primaryPos, ctx);
  }

  const taken = new Set<string>();
  const starters: SelectionEntry[] = [];

  // Fill the specialised slots first (GK, then the rest) so a keeper never ends up on the wing.
  const orderedSlots = [...slots].sort((a, b) => (a === 'GK' ? -1 : b === 'GK' ? 1 : 0));

  for (const slot of orderedSlots) {
    let best: { player: Player; score: number } | null = null;
    for (const player of available) {
      if (taken.has(player.id)) continue;
      if (slot === 'GK' && player.primaryPos !== 'GK') continue;
      if (slot !== 'GK' && player.primaryPos === 'GK') continue;
      const score = selectionScore(player, slot, ctx) + rng.gauss(0, 2.5);
      if (!best || score > best.score) best = { player, score };
    }
    if (best) {
      taken.add(best.player.id);
      starters.push({ playerId: best.player.id, slot, score: best.score });
    }
  }

  const bench = available
    .filter((p) => !taken.has(p.id))
    .sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0))
    .slice(0, 9)
    .map((p) => p.id);

  return { formation: ctx.formation, starters, bench, scores };
}

export interface MinutesOutcome {
  played: boolean;
  started: boolean;
  minutes: number;
  slot: Position | null;
  cameOnMinute?: number;
  offMinute?: number;
}

/** Turn a lineup place into actual minutes: starters get subbed, bench players may come on. */
export function resolveMinutes(rng: Rng, playerId: string, lineup: Lineup, player: Player): MinutesOutcome {
  const starting = lineup.starters.find((s) => s.playerId === playerId);
  if (starting) {
    const enduranceRoll = rng.next();
    const fatigueRisk = clamp(player.condition.fatigue / 140 + (70 - player.attributes.stamina) / 260, 0.02, 0.6);
    if (enduranceRoll < fatigueRisk) {
      const off = rng.int(55, 85);
      return { played: true, started: true, minutes: off, slot: starting.slot, offMinute: off };
    }
    if (rng.chance(0.22)) {
      const off = rng.int(60, 88);
      return { played: true, started: true, minutes: off, slot: starting.slot, offMinute: off };
    }
    return { played: true, started: true, minutes: 90, slot: starting.slot };
  }

  const benchIndex = lineup.bench.indexOf(playerId);
  if (benchIndex === -1) {
    return { played: false, started: false, minutes: 0, slot: null };
  }
  // Top of the bench comes on often; the ninth man almost never does.
  const subChance = clamp(0.62 - benchIndex * 0.075, 0.03, 0.62);
  if (!rng.chance(subChance)) {
    return { played: false, started: false, minutes: 0, slot: null };
  }
  const on = rng.int(55, 85);
  return {
    played: true,
    started: false,
    minutes: 90 - on,
    slot: player.primaryPos,
    cameOnMinute: on,
  };
}
