import { MENTORS } from '@fc/engine';
import packJson from '@fc/data/pack';
import type { Club } from '@fc/engine';
import { formatMoney, type Lang } from '../i18n/index.js';
import { toHebrew } from './transliterate.js';

/**
 * Club identity for display. Hebrew names come from the club's own Hebrew
 * Wikipedia article where one exists; otherwise the Latin name is used, which is
 * how Israeli football media writes foreign clubs without a settled spelling anyway.
 */
export function clubName(club: Club | null | undefined, lang: Lang): string {
  if (!club) return '';
  if (lang !== 'he') return club.name;
  if (club.nameHe) return cleanHebrew(club.nameHe);
  // Nothing in the pack: write it the way it is said, so a Hebrew screen stays Hebrew.
  return toHebrew(club.shortName || club.name);
}

/** Wikipedia disambiguation and "football club" boilerplate have no place in the UI. */
function cleanHebrew(name: string): string {
  return name
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/^מועדון הכדורגל\s+/, '')
    .replace(/^מועדון כדורגל\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function clubShortName(club: Club | null | undefined, lang: Lang): string {
  if (!club) return '';
  if (lang !== 'he') return club.shortName;
  if (club.nameHe) return shortenHebrew(club.nameHe);
  return toHebrew(club.shortName || club.name);
}

/** Hebrew club names carry a lot of "מועדון כדורגל" style baggage; trim it for lists. */
function shortenHebrew(name: string): string {
  return name
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/מועדון הכדורגל\s*/g, '')
    .replace(/מועדון כדורגל\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function crestUrl(club: Club | null | undefined): string | null {
  return club?.crest ? `/crests/${club.crest}` : null;
}

/** A stable colour for a club with no crest colour: derived from its id. */
export function clubColor(club: Club | null | undefined): string {
  if (club?.color) return club.color;
  if (!club) return '#24304a';
  let hash = 0;
  for (let i = 0; i < club.id.length; i++) hash = (hash * 31 + club.id.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue} 45% 32%)`;
}

/** Initials for the fallback badge. */
export function clubInitials(club: Club | null | undefined, lang: Lang): string {
  const name = clubName(club, lang) || '?';
  const words = name.split(/\s+/).filter((w) => w.length > 1);
  if (words.length === 0) return name.slice(0, 2);
  if (words.length === 1) return words[0]!.slice(0, 2);
  return (words[0]![0] ?? '') + (words[1]![0] ?? '');
}

/**
 * Messages from the engine carry club names as plain strings, because the engine has
 * no idea what language anyone is reading in. This swaps any argument that is a club
 * name for the name in the player's language - which is why the academy welcome says
 * "מכבי תל אביב" and not "Maccabi Tel Aviv".
 */
let nameIndex: Map<string, Club> | null = null;

/**
 * Values that are money, wherever a message happens to call them.
 *
 * The engine deals in numbers and knows nothing about currency; the app writes money as
 * money everywhere else, and a message saying "they are talking about 59 a week" reads
 * like a mistake because it is one.
 */
const MONEY_ARGS = new Set(['weekly', 'cost', 'amount', 'fee', 'wage', 'bonus', 'value', 'clause']);

let countries: Map<string, string> | null = null;

/** Every country the pack knows, by the name the engine writes, in Hebrew. */
function countryIndex(): Map<string, string> {
  if (!countries) {
    countries = new Map();
    for (const country of (packJson as { countries: { name: string; nameHe?: string }[] }).countries) {
      if (country.nameHe) countries.set(country.name.toLowerCase(), country.nameHe);
    }
  }
  return countries;
}

export function localiseArgs(
  args: Record<string, string | number> | undefined,
  clubs: Club[],
  lang: Lang,
): Record<string, string | number> | undefined {
  if (!args) return args;
  // Money is written the same way in both languages, so this half runs whatever the
  // language is.
  let money: Record<string, string | number> | null = null;
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'number' && MONEY_ARGS.has(key)) {
      money ??= { ...args };
      money[key] = formatMoney(value, lang);
    }
  }
  if (money) args = money;
  if (lang !== 'he') return args;
  if (!nameIndex || nameIndex.size !== clubs.length) {
    nameIndex = new Map(clubs.map((club) => [club.name.toLowerCase(), club]));
  }

  let changed = false;
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string') {
      // A qualifier result read "Switzerland 3-1 Portugal" in the middle of a Hebrew
      // message, because the countries came through as the engine's own names.
      const country = countryIndex().get(value.toLowerCase());
      if (country) {
        out[key] = country;
        changed = true;
        continue;
      }
      const club = nameIndex.get(value.toLowerCase());
      if (club) {
        out[key] = clubName(club, lang);
        changed = true;
        continue;
      }
      // Old players are named the way everybody's father says them, not transliterated.
      const mentor = MENTORS.find((entry) => entry.name === value);
      if (mentor?.nameHe) {
        out[key] = mentor.nameHe;
        changed = true;
        continue;
      }
    }
    out[key] = value;
  }
  return changed ? out : args;
}

/** The town a club plays in, written the way the rest of the screen is written. */
export function cityName(city: string | undefined, lang: 'he' | 'en'): string {
  if (!city) return '';
  if (lang !== 'he') return city;
  return /[֐-׿]/.test(city) ? city : toHebrew(city);
}
