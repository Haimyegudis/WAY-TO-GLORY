import { Rng, clamp } from './rng.js';
import { overall } from './positions.js';
import type { PackIndex } from './data.js';
import type { NationalTeamState, Player } from './types.js';

export type NationalLevel = 'u17' | 'u19' | 'u21' | 'senior';

/** Weeks that hold international fixtures. */
export const INTERNATIONAL_WEEKS = [8, 13, 18, 24, 33, 38, 43];

export function levelForAge(age: number): NationalLevel | null {
  if (age <= 17) return 'u17';
  if (age <= 19) return 'u19';
  if (age <= 21) return 'u21';
  if (age <= 39) return 'senior';
  return null;
}

/** Rough bar a player must clear to be picked, derived from the country's football reputation. */
export function nationalStandard(countryReputation: number, level: NationalLevel): number {
  const seniorBar = 44 + countryReputation * 0.42;
  switch (level) {
    case 'u17': return seniorBar - 22;
    case 'u19': return seniorBar - 16;
    case 'u21': return seniorBar - 10;
    case 'senior': return seniorBar;
  }
}

export interface CallUpContext {
  player: Player;
  age: number;
  season: number;
  minutesPct: number;
  clubReputation: number;
  leagueReputation: number;
  index: PackIndex;
  nt: NationalTeamState;
  /**
   * His youth season. A sixteen year old has no senior minutes by definition, and the
   * under-17 coach is not waiting for him to get some - he is watching the age group.
   */
  youthMinutesPct?: number;
  youthRating?: number;
  youthGoals?: number;
  /** Availability is selection evidence too: scouts cool on a player they cannot pick. */
  injuredWeeks?: number;
  sharpness?: number;
  fitness?: number;
  form?: number;
}

/**
 * Interest is per-country. Playing regularly at a decent level matters as much as raw ability:
 * a bench player at a big club gets called up less than a starter one tier down.
 */
export function updateNationalInterest(ctx: CallUpContext): void {
  const ovr = overall(ctx.player.attributes, ctx.player.primaryPos, ctx.player.secondaryPos);
  const level = levelForAge(ctx.age);
  if (!level) return;

  // Below under-21, a boy with no senior minutes is judged on the football he is
  // actually playing. Doing it in an academy is not the same as doing it in a first
  // team, so it is worth less - but it is not worth nothing, which is what it was.
  const onYouthForm =
    (level === 'u17' || level === 'u19') && ctx.minutesPct < 0.1 && (ctx.youthMinutesPct ?? 0) > 0;

  for (const code of ctx.nt.eligibleCountries) {
    const country = ctx.index.countryByCode.get(code);
    if (!country) continue;
    const bar = nationalStandard(country.reputation, level);
    const playingBonus = onYouthForm
      ? clamp(
        ((ctx.youthMinutesPct ?? 0) - 0.3) * 20
        + ((ctx.youthRating ?? 6.4) - 6.6) * 14
        + Math.min(8, (ctx.youthGoals ?? 0) * 0.7),
        -12,
        20,
      )
      : clamp((ctx.minutesPct - 0.3) * 26, -12, 16);
    const stageBonus = clamp((ctx.leagueReputation - 40) * 0.22, -8, 14);
    const unavailable = (ctx.injuredWeeks ?? 0) > 0;
    const availabilityPenalty = unavailable
      ? clamp(20 + (ctx.injuredWeeks ?? 0) * 2.4, 22, 78)
      : clamp(
        Math.max(0, 68 - (ctx.sharpness ?? 68)) * 0.65
          + Math.max(0, 82 - (ctx.fitness ?? 82)) * 0.35,
        0,
        30,
      );
    const formBonus = clamp(((ctx.form ?? 50) - 50) * 0.2, -10, 10);
    // A player exactly at the standard is a genuine squad candidate, not a hopeful.
    const raw = 52 + (ovr - bar) * 4.5 + playingBonus + stageBonus
      + (ctx.player.reputation - 40) * 0.25 + formBonus - availabilityPenalty;
    const previous = ctx.nt.interest[code] ?? 0;
    // This now runs weekly. Interest moves visibly without snapping from watched to
    // forgotten, and a recovered player must rebuild sharpness, form and minutes.
    ctx.nt.interest[code] = clamp(previous * 0.84 + clamp(raw, 0, 100) * 0.16, 0, 100);
  }
}

export interface CallUpResult {
  countryCode: string;
  level: NationalLevel;
  isFirst: boolean;
  isSenior: boolean;
}

export function rollCallUp(rng: Rng, ctx: CallUpContext): CallUpResult | null {
  const level = levelForAge(ctx.age);
  if (!level) return null;

  /*
   * Once committed to an association, only that association can call you up - and a
   * pledge counts. Saying yes to a federation and then being picked by the one he turned
   * down would make the choice meaningless.
   */
  const eligible = ctx.nt.countryCode
    ? [ctx.nt.countryCode]
    : ctx.nt.eligibleCountries;

  let best: { code: string; interest: number } | null = null;
  for (const code of eligible) {
    const interest = ctx.nt.interest[code] ?? 0;
    if (!best || interest > best.interest) best = { code, interest };
  }
  if (!best || best.interest < 55) return null;

  const chance = clamp((best.interest - 50) / 90, 0.02, 0.85);
  if (!rng.chance(chance)) return null;

  const isFirst = ctx.nt.caps === 0 && ctx.nt.callUpHistory.length === 0;
  return { countryCode: best.code, level, isFirst, isSenior: level === 'senior' };
}

export interface InternationalMatchOutcome {
  played: boolean;
  minutes: number;
  goals: number;
  assists: number;
  rating: number;
}

export function simulateInternationalMatch(
  rng: Rng,
  player: Player,
  level: NationalLevel,
  countryReputation: number,
): InternationalMatchOutcome {
  const ovr = overall(player.attributes, player.primaryPos, player.secondaryPos);
  const bar = nationalStandard(countryReputation, level);
  const startChance = clamp(0.25 + (ovr - bar) / 26, 0.05, 0.95);
  const started = rng.chance(startChance);
  const played = started || rng.chance(0.45);
  if (!played) return { played: false, minutes: 0, goals: 0, assists: 0, rating: 0 };

  const minutes = started ? (rng.chance(0.3) ? rng.int(60, 89) : 90) : rng.int(8, 35);
  const attackish = ['ST', 'CF', 'RW', 'LW', 'CAM'].includes(player.primaryPos);
  const goalChance = clamp(((player.attributes.finishing - 40) / 300) * (minutes / 90) * (attackish ? 1 : 0.3), 0, 0.5);
  const goals = rng.chance(goalChance) ? (rng.chance(0.12) ? 2 : 1) : 0;
  const assistChance = clamp(((player.attributes.vision - 40) / 340) * (minutes / 90), 0, 0.35);
  const assists = rng.chance(assistChance) ? 1 : 0;

  const rating = clamp(
    6.1 + (ovr - bar) / 30 + goals * 0.9 + assists * 0.6 + rng.gauss(0, 0.4),
    4.0,
    10,
  );

  return { played: true, minutes, goals, assists, rating: Math.round(rating * 10) / 10 };
}

export function initNationalTeam(player: Player): NationalTeamState {
  return {
    countryCode: null,
    eligibleCountries: player.citizenships.slice(),
    level: 'none',
    caps: 0,
    goals: 0,
    youthCaps: 0,
    youthGoals: 0,
    callUpHistory: [],
    capturedBySenior: false,
    interest: Object.fromEntries(player.citizenships.map((c) => [c, 0])),
  };
}

/** A senior competitive cap ties the player to that association. */
export function commitToCountry(nt: NationalTeamState, code: string): void {
  nt.countryCode = code;
  nt.capturedBySenior = true;
}
