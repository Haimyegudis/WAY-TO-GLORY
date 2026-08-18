import { Rng, clamp } from './rng.js';
import { POSITION_WEIGHTS, positionGroup, ratingAt } from './positions.js';
import type { NamePool, PackIndex, StarPlayerSeed } from './data.js';
import {
  ATTRIBUTE_KEYS,
  PERSONALITY_KEYS,
  type AttributeKey,
  type Attributes,
  type Club,
  type Condition,
  type Foot,
  type Personality,
  type Player,
  type Position,
  type SquadRole,
} from './types.js';

const GK_ONLY: AttributeKey[] = ['reflexes', 'handling', 'positioningGK', 'kicking'];

export function emptyCondition(): Condition {
  return { fatigue: 0, sharpness: 60, injuries: [], injuryHistory: [], suspensions: [], yellowCards: {} };
}

/**
 * Build an attribute set that rates close to `target` in `pos`.
 * Relevant attributes sit near the target, irrelevant ones drift lower, then a few
 * correction passes nudge the weighted attributes until the rating lands.
 */
export function buildAttributes(rng: Rng, pos: Position, target: number, spread = 7): Attributes {
  const weights = POSITION_WEIGHTS[pos];
  const attrs = {} as Attributes;
  const isGk = pos === 'GK';

  for (const key of ATTRIBUTE_KEYS) {
    const weight = weights[key] ?? 0;
    if (GK_ONLY.includes(key) && !isGk) {
      attrs[key] = clamp(Math.round(rng.gaussIn(target * 0.25, 6, 1, 40)), 1, 99);
      continue;
    }
    if (!GK_ONLY.includes(key) && isGk && weight === 0) {
      attrs[key] = clamp(Math.round(rng.gaussIn(target * 0.55, 8, 1, 70)), 1, 99);
      continue;
    }
    const base = weight > 0 ? target + (weight - 0.1) * 40 : target * 0.78;
    attrs[key] = clamp(Math.round(rng.gaussIn(base, spread, 1, 99)), 1, 99);
  }

  const weighted = (Object.keys(weights) as AttributeKey[]);
  for (let pass = 0; pass < 8; pass++) {
    const current = ratingAt(attrs, pos);
    const delta = target - current;
    if (Math.abs(delta) <= 0) break;
    for (const key of weighted) {
      attrs[key] = clamp(Math.round(attrs[key] + delta), 1, 99);
    }
  }

  return attrs;
}

export function buildPersonality(rng: Rng, bias = 0): Personality {
  const p = {} as Personality;
  for (const key of PERSONALITY_KEYS) {
    p[key] = clamp(Math.round(rng.gaussIn(50 + bias, 16, 5, 95)), 1, 99);
  }
  return p;
}

export function pickName(rng: Rng, pool: NamePool): { firstName: string; lastName: string } {
  return { firstName: rng.pick(pool.first), lastName: rng.pick(pool.last) };
}

function poolFor(index: PackIndex, countryCode: string): NamePool {
  const country = index.countryByCode.get(countryCode);
  const locale = country?.nameLocale ?? 'en';
  return index.namesByLocale.get(locale) ?? index.namesByLocale.get('en')!;
}

let idCounter = 0;
export function newPlayerId(rng: Rng, prefix = 'p'): string {
  idCounter = (idCounter + 1) % 1_000_000;
  return `${prefix}_${rng.int(0, 0xffffff).toString(36)}${idCounter.toString(36)}`;
}

export interface GenerateOptions {
  clubId: string | null;
  pos: Position;
  age: number;
  targetOvr: number;
  season: number;
  countryCode: string;
  squadRole?: SquadRole;
  potential?: number;
  isUser?: boolean;
  personalityBias?: number;
}

export function generatePlayer(rng: Rng, index: PackIndex, opts: GenerateOptions): Player {
  const pool = poolFor(index, opts.countryCode);
  const { firstName, lastName } = pickName(rng, pool);
  const attributes = buildAttributes(rng, opts.pos, opts.targetOvr);
  const ovr = ratingAt(attributes, opts.pos);

  // Younger players carry more headroom; by 27 potential is basically current ability.
  const growthYears = Math.max(0, 26 - opts.age);
  const potential = opts.potential ?? clamp(
    Math.round(ovr + rng.gaussIn(growthYears * 1.6, growthYears * 0.9, 0, 45)),
    ovr,
    99,
  );

  const group = positionGroup(opts.pos);
  const heightBase = group === 'GK' ? 190 : group === 'DEF' ? 184 : group === 'MID' ? 179 : 181;
  const heightCm = Math.round(rng.gaussIn(heightBase, 6, 165, 205));
  const weightKg = Math.round(clamp((heightCm - 100) * rng.range(0.92, 1.02), 58, 105));

  const foot: Foot = opts.pos === 'LB' || opts.pos === 'LWB' || opts.pos === 'LM' || opts.pos === 'LW'
    ? (rng.chance(0.75) ? 'L' : 'R')
    : rng.chance(0.78) ? 'R' : rng.chance(0.9) ? 'L' : 'B';

  const secondaryPos = pickSecondary(rng, opts.pos);

  return {
    id: newPlayerId(rng, opts.isUser ? 'user' : 'p'),
    firstName,
    lastName,
    birthYear: opts.season - opts.age,
    birthCountry: opts.countryCode,
    citizenships: [opts.countryCode],
    heightCm,
    weightKg,
    foot,
    primaryPos: opts.pos,
    secondaryPos,
    attributes,
    potential,
    personality: buildPersonality(rng, opts.personalityBias ?? 0),
    form: clamp(Math.round(rng.gaussIn(50, 10, 20, 80)), 0, 100),
    fitness: clamp(Math.round(rng.gaussIn(92, 5, 60, 100)), 0, 100),
    morale: clamp(Math.round(rng.gaussIn(65, 12, 20, 95)), 0, 100),
    condition: emptyCondition(),
    clubId: opts.clubId,
    squadRole: opts.squadRole ?? 'rotation',
    reputation: clamp(Math.round(ovr * 0.7 + rng.gaussIn(0, 6, -15, 15)), 1, 100),
    fame: clamp(Math.round(ovr * 0.55 + rng.gaussIn(0, 8, -20, 20)), 1, 100),
    isUser: opts.isUser ?? false,
  };
}

function pickSecondary(rng: Rng, pos: Position): Position[] {
  if (pos === 'GK') return [];
  const map: Partial<Record<Position, Position[]>> = {
    CB: ['RB', 'LB', 'CDM'],
    RB: ['RWB', 'RM'],
    LB: ['LWB', 'LM'],
    RWB: ['RB', 'RM'],
    LWB: ['LB', 'LM'],
    CDM: ['CM', 'CB'],
    CM: ['CDM', 'CAM'],
    CAM: ['CM', 'CF'],
    RM: ['RW', 'RWB'],
    LM: ['LW', 'LWB'],
    RW: ['RM', 'CF'],
    LW: ['LM', 'CF'],
    CF: ['ST', 'CAM'],
    ST: ['CF', 'RW', 'LW'],
  };
  const options = map[pos] ?? [];
  if (options.length === 0 || rng.chance(0.35)) return [];
  return [rng.pick(options)];
}

/** Rough club strength -> squad quality. A 90-reputation club fields ~80 OVR players. */
export function clubBaseOvr(club: Club): number {
  return clamp(Math.round(38 + club.strength * 0.46), 40, 88);
}

const SQUAD_TEMPLATE: { pos: Position; count: number }[] = [
  { pos: 'GK', count: 3 },
  { pos: 'CB', count: 4 },
  { pos: 'RB', count: 2 },
  { pos: 'LB', count: 2 },
  { pos: 'CDM', count: 2 },
  { pos: 'CM', count: 3 },
  { pos: 'CAM', count: 2 },
  { pos: 'RW', count: 2 },
  { pos: 'LW', count: 2 },
  { pos: 'ST', count: 3 },
];

/** Age curve for a squad: a few kids, a core in its prime, a couple of veterans. */
function squadAge(rng: Rng, slotIndex: number): number {
  const roll = rng.next();
  if (slotIndex < 3 || roll < 0.18) return rng.int(17, 21);
  if (roll < 0.75) return rng.int(22, 28);
  return rng.int(29, 35);
}

export interface SquadGenOptions {
  club: Club;
  season: number;
  index: PackIndex;
  /** Real named players to seed into this squad before generating the rest. */
  stars?: StarPlayerSeed[];
  size?: number;
}

export function generateSquad(rng: Rng, opts: SquadGenOptions): Player[] {
  const { club, season, index } = opts;
  const base = clubBaseOvr(club);
  const players: Player[] = [];
  const filled: Record<string, number> = {};

  for (const star of opts.stars ?? []) {
    const player = starToPlayer(rng, index, star, season, club);
    players.push(player);
    filled[star.pos] = (filled[star.pos] ?? 0) + 1;
  }

  const homeCountry = club.country;
  const foreignChance = clamp(club.reputation / 160, 0.05, 0.6);
  const otherCountries = index.pack.countries.map((c) => c.code).filter((c) => c !== homeCountry);

  let slot = 0;
  for (const entry of SQUAD_TEMPLATE) {
    const already = filled[entry.pos] ?? 0;
    for (let i = already; i < entry.count; i++) {
      const age = squadAge(rng, slot);
      // Squad depth: first choice at base, backups a notch below.
      const depthPenalty = i * rng.range(1.5, 3.5);
      const youthPenalty = age < 21 ? (21 - age) * 1.8 : 0;
      const target = clamp(Math.round(base - depthPenalty - youthPenalty + rng.gaussIn(0, 3, -8, 8)), 25, 95);
      const country = rng.chance(foreignChance) && otherCountries.length > 0 ? rng.pick(otherCountries) : homeCountry;
      players.push(
        generatePlayer(rng, index, {
          clubId: club.id,
          pos: entry.pos,
          age,
          targetOvr: target,
          season,
          countryCode: country,
          squadRole: i === 0 ? 'starter' : i === 1 ? 'rotation' : 'bench',
        }),
      );
      slot++;
    }
  }

  const targetSize = opts.size ?? 25;
  while (players.length > targetSize) players.pop();
  return players;
}

export function starToPlayer(
  rng: Rng,
  index: PackIndex,
  star: StarPlayerSeed,
  season: number,
  club: Club,
): Player {
  const attributes = buildAttributes(rng, star.pos, star.ovr, 5);
  const growthYears = Math.max(0, 26 - star.age);
  const potential = star.potential ?? clamp(
    Math.round(star.ovr + rng.gaussIn(growthYears * 1.3, growthYears * 0.7, 0, 30)),
    star.ovr,
    99,
  );
  return {
    id: `star_${star.clubId}_${star.lastName.toLowerCase().replace(/[^a-z]/g, '')}`,
    firstName: star.firstName,
    lastName: star.lastName,
    birthYear: season - star.age,
    birthCountry: star.country,
    citizenships: [star.country],
    heightCm: Math.round(rng.gaussIn(star.pos === 'GK' ? 190 : 181, 6, 165, 205)),
    weightKg: Math.round(rng.gaussIn(78, 6, 60, 100)),
    foot: star.foot ?? 'R',
    primaryPos: star.pos,
    secondaryPos: pickSecondary(rng, star.pos),
    attributes,
    potential,
    personality: buildPersonality(rng, 12),
    form: clamp(Math.round(rng.gaussIn(58, 10, 25, 85)), 0, 100),
    fitness: clamp(Math.round(rng.gaussIn(93, 4, 70, 100)), 0, 100),
    morale: clamp(Math.round(rng.gaussIn(70, 10, 30, 95)), 0, 100),
    condition: emptyCondition(),
    clubId: club.id,
    squadRole: star.ovr >= club.strength * 0.85 ? 'key' : 'starter',
    reputation: clamp(Math.round(star.ovr * 0.85 + rng.gaussIn(4, 5, -10, 12)), 1, 100),
    fame: clamp(Math.round(star.ovr * 0.8 + rng.gaussIn(6, 7, -12, 18)), 1, 100),
    isUser: false,
    isReal: true,
  };
}

export interface UserPlayerInput {
  firstName: string;
  lastName: string;
  birthCountry: string;
  secondCitizenship?: string;
  age: number;
  heightCm: number;
  weightKg: number;
  foot: Foot;
  primaryPos: Position;
  secondaryPos: Position[];
}

/**
 * The user's player. Starting ability is deliberately low (30-35) and potential is
 * hidden; the whole game is the gap between the two.
 */
export function createUserPlayer(
  rng: Rng,
  input: UserPlayerInput,
  season: number,
  academyQuality: number,
): Player {
  const targetOvr = clamp(Math.round(28 + academyQuality * 0.06 + rng.gaussIn(2, 1.6, -2, 5)), 28, 38);
  const attributes = buildAttributes(rng, input.primaryPos, targetOvr, 6);
  const potentialRoll = rng.next();
  // Long right tail: most careers top out mid-table, a few are special.
  const potential = clamp(
    Math.round(
      55 +
        (potentialRoll < 0.55
          ? rng.range(0, 14)
          : potentialRoll < 0.85
            ? rng.range(14, 26)
            : potentialRoll < 0.97
              ? rng.range(26, 36)
              : rng.range(36, 44)) +
        academyQuality * 0.03,
    ),
    50,
    99,
  );

  const citizenships = [input.birthCountry];
  if (input.secondCitizenship && input.secondCitizenship !== input.birthCountry) {
    citizenships.push(input.secondCitizenship);
  }

  return {
    id: 'user',
    firstName: input.firstName,
    lastName: input.lastName,
    birthYear: season - input.age,
    birthCountry: input.birthCountry,
    citizenships,
    heightCm: input.heightCm,
    weightKg: input.weightKg,
    foot: input.foot,
    primaryPos: input.primaryPos,
    secondaryPos: input.secondaryPos,
    attributes,
    potential,
    personality: buildPersonality(rng, 6),
    form: 55,
    fitness: 95,
    morale: 75,
    condition: emptyCondition(),
    clubId: null,
    squadRole: 'academy',
    reputation: 5,
    fame: 2,
    isUser: true,
  };
}
