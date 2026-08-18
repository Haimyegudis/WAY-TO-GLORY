import { clamp, interpolate } from './rng.js';
import { overall } from './positions.js';
import type { Competition, Contract, Player } from './types.js';

const AGE_VALUE_CURVE: readonly (readonly [number, number])[] = [
  [15, 0.9], [17, 1.15], [19, 1.35], [21, 1.4], [23, 1.3], [26, 1.15],
  [28, 1.0], [30, 0.72], [32, 0.46], [34, 0.24], [36, 0.1], [39, 0.03],
];

/** Base value from ability alone, on a steep curve: elite players cost exponentially more. */
export function baseValueFromOvr(ovr: number): number {
  return Math.exp((ovr - 40) / 6.9) * 30_000;
}

export interface ValueContext {
  season: number;
  leagueReputation: number;
  contract: Contract | null;
  internationalCaps: number;
}

export function marketValue(player: Player, ctx: ValueContext): number {
  const ovr = overall(player.attributes, player.primaryPos, player.secondaryPos);
  const age = ctx.season - player.birthYear;

  let value = baseValueFromOvr(ovr);
  value *= interpolate(AGE_VALUE_CURVE, age);

  // Unrealised potential is worth money while the player is young enough to reach it.
  const gap = Math.max(0, player.potential - ovr);
  if (age <= 24 && gap > 0) value *= 1 + Math.min(1.1, gap / 22);

  value *= 0.7 + ctx.leagueReputation / 140;
  value *= 0.88 + player.form / 420;
  value *= 0.92 + player.reputation / 500;
  value *= 1 + Math.min(0.35, ctx.internationalCaps * 0.006);

  if (ctx.contract) {
    const yearsLeft = ctx.contract.endSeason - ctx.season;
    if (yearsLeft <= 0) value *= 0.35;
    else if (yearsLeft === 1) value *= 0.62;
    else if (yearsLeft >= 4) value *= 1.08;
  } else {
    value *= 0.3;
  }

  const injuryLoad = player.condition.injuryHistory.reduce((s, i) => s + i.weeksOut, 0);
  value *= clamp(1 - injuryLoad / 420, 0.55, 1);

  // Even the very best transfer for a finite amount of money.
  return Math.min(260_000_000, Math.round(value / 10_000) * 10_000);
}

/** Weekly wage a club would realistically pay for this player. */
export function expectedWage(
  player: Player,
  ovr: number,
  clubFinances: number,
  competition: Competition,
  age: number,
): number {
  const base = Math.exp((ovr - 42) / 8.2) * 420;
  const financeFactor = 0.45 + clubFinances / 90;
  // What a league pays matters as much as how good you are: the same player earns
  // several times more in England than in the Israeli top flight.
  const leagueFactor = 0.25 + competition.reputation / 85;
  const ageFactor = age < 20 ? 0.45 : age < 23 ? 0.72 : age > 33 ? 0.8 : 1;
  const repFactor = 0.9 + player.reputation / 500;
  return Math.round((base * financeFactor * leagueFactor * ageFactor * repFactor) / 100) * 100;
}

export function formatMoney(value: number): string {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `€${Math.round(value / 1_000)}K`;
  return `€${value}`;
}
