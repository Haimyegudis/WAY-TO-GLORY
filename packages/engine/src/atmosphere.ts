/**
 * The afternoon around the football.
 *
 * A match had a scoreline, a crowd of nobody, no weather and no referee. Every real
 * report starts with those three things, and all three of them change the game: a full
 * ground lifts the side playing in front of it, rain makes a passing side ordinary, and
 * a referee who books people is a different afternoon from one who lets it go.
 *
 * None of it is decoration here. The crowd feeds the player's head, the weather feeds
 * the conversion rate, and the referee feeds the card risk - small numbers, because the
 * football is still the football, but they are read from the same match the player is
 * watching rather than printed next to it.
 */
import { Rng, clamp } from './rng.js';
import { pickName } from './generate.js';
import type { PackIndex } from './data.js';
import type { Club, MatchImportance } from './types.js';

export type Weather = 'clear' | 'rain' | 'heavyRain' | 'wind' | 'heat' | 'cold';

export interface Referee {
  name: string;
  /** 0 lets everything go, 100 books a handshake. */
  strictness: number;
}

export interface Atmosphere {
  attendance: number;
  weather: Weather;
  referee: Referee;
}

/**
 * How many turn up.
 *
 * A club's reputation is the best stand-in for the size of its ground that this world
 * has, and the fixture does the rest: a derby fills a place that is half empty for a
 * Tuesday in November.
 */
export function attendanceFor(
  rng: Rng,
  home: Club,
  away: Club,
  importance: MatchImportance,
  competitionId: string,
): number {
  // Roughly: a village club a couple of thousand, a giant sixty.
  const capacity = Math.round(800 + Math.pow(home.reputation, 2.6) * 0.42);
  const pull = importance === 'derby' || importance === 'titleDecider' || importance === 'cupFinal' ? 1
    : importance === 'rival' || importance === 'europeanNight' || importance === 'cupSemi' ? 0.94
    : importance === 'topSide' || importance === 'relegationSixPointer' ? 0.88
    : 0.74;
  // Who they are playing matters too: nobody stays home for the champions.
  const visitors = clamp(0.9 + (away.reputation - 50) / 260, 0.85, 1.12);
  const youth = competitionId.endsWith('.youth');
  const friendly = competitionId.startsWith('friendly');
  const scale = youth ? 0.012 : friendly ? 0.35 : 1;
  const crowd = capacity * pull * visitors * scale * rng.range(0.88, 1.06);
  return Math.max(youth ? 40 : 250, Math.round(crowd / 50) * 50);
}

/** What the sky is doing, which mostly depends on the time of year. */
export function pickWeather(rng: Rng, week: number, competitionId: string): Weather {
  if (competitionId.startsWith('friendly')) return rng.chance(0.75) ? 'clear' : 'heat';
  // Week 1 is July: a European season runs summer, autumn, winter, spring.
  const winter = week >= 20 && week <= 36;
  const summer = week <= 8 || week >= 46;
  const roll = rng.next();
  if (winter) {
    if (roll < 0.34) return 'rain';
    if (roll < 0.46) return 'heavyRain';
    if (roll < 0.6) return 'cold';
    if (roll < 0.72) return 'wind';
    return 'clear';
  }
  if (summer) {
    if (roll < 0.26) return 'heat';
    if (roll < 0.36) return 'wind';
    if (roll < 0.44) return 'rain';
    return 'clear';
  }
  if (roll < 0.22) return 'rain';
  if (roll < 0.3) return 'wind';
  if (roll < 0.36) return 'heavyRain';
  return 'clear';
}

/** A man in the middle, with a name and a reputation for how he referees. */
export function pickReferee(rng: Rng, index: PackIndex, country: string): Referee {
  const pool = index.namesByLocale.get(index.countryByCode.get(country)?.nameLocale ?? 'en')
    ?? index.namesByLocale.get('en')!;
  const { firstName, lastName } = pickName(rng, pool);
  return {
    name: `${firstName} ${lastName}`,
    strictness: Math.round(rng.gaussIn(50, 18, 8, 95)),
  };
}

export interface AtmosphereEffect {
  /** Multiplier on how often a chance is taken. */
  conversion: number;
  /** Multiplier on the spread of the afternoon: mud makes football random. */
  variance: number;
  /** Multiplier on what the ninety minutes take out of him. */
  fatigue: number;
  /** Multiplier on the chance of a booking. */
  cardRisk: number;
  /** What being watched by that many people does to him, home only. */
  crowd: number;
}

/**
 * What the afternoon is worth, in the numbers the match engine already speaks.
 *
 * Deliberately small. Rain does not make a good player bad; it makes a passing side
 * ordinary and a scrappy afternoon more likely to be decided by something stupid.
 */
export function atmosphereEffect(atmosphere: Atmosphere, userIsHome: boolean): AtmosphereEffect {
  const weather: Record<Weather, Omit<AtmosphereEffect, 'crowd' | 'cardRisk'>> = {
    clear: { conversion: 1, variance: 1, fatigue: 1 },
    rain: { conversion: 0.95, variance: 1.12, fatigue: 1.04 },
    heavyRain: { conversion: 0.88, variance: 1.25, fatigue: 1.1 },
    wind: { conversion: 0.93, variance: 1.18, fatigue: 1.02 },
    heat: { conversion: 0.97, variance: 1.05, fatigue: 1.22 },
    cold: { conversion: 0.98, variance: 1.04, fatigue: 1.06 },
  };
  const w = weather[atmosphere.weather];
  // Thirty thousand people is worth something to the side they came to watch.
  const size = clamp(Math.log10(Math.max(200, atmosphere.attendance)) - 3.3, -0.5, 1.4);
  return {
    conversion: w.conversion,
    variance: w.variance,
    fatigue: w.fatigue,
    cardRisk: clamp(0.72 + atmosphere.referee.strictness / 90, 0.72, 1.45),
    crowd: userIsHome ? 1 + size * 0.035 : 1 - size * 0.02,
  };
}
