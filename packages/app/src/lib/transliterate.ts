/**
 * Latin to Hebrew transliteration for club names we have no Hebrew name for.
 *
 * This is not a translator: it writes an English name the way an Israeli
 * commentator would say it, so a lower-league club reads as "ברדפורד סיטי" rather
 * than sitting in Latin letters in the middle of a Hebrew screen.
 */

const FINALS: Record<string, string> = { מ: 'ם', נ: 'ן', צ: 'ץ', פ: 'ף', כ: 'ך' };

// Longest first: digraphs must win over single letters.
const RULES: [RegExp, string][] = [
  [/^sch/i, 'ש'],
  [/^tsch/i, "צ'"],
  [/^sh/i, 'ש'],
  [/^ch/i, "צ'"],
  [/^ph/i, 'פ'],
  [/^th/i, 'ת'],
  [/^wh/i, 'ו'],
  [/^ck/i, 'ק'],
  [/^qu/i, 'קוו'],
  [/^gh/i, 'ג'],
  [/^kn/i, 'נ'],
  [/^ll/i, 'ל'],
  [/^ss/i, 'ס'],
  [/^tt/i, 'ט'],
  [/^nn/i, 'נ'],
  [/^mm/i, 'מ'],
  [/^ff/i, 'פ'],
  [/^pp/i, 'פ'],
  [/^dd/i, 'ד'],
  [/^bb/i, 'ב'],
  [/^rr/i, 'ר'],
  [/^zz/i, 'ז'],
  [/^cc/i, 'ק'],
  [/^ee/i, 'י'],
  [/^oo/i, 'ו'],
  [/^ou/i, 'או'],
  [/^ow/i, 'או'],
  [/^au/i, 'או'],
  [/^ai/i, 'יי'],
  [/^ay/i, 'יי'],
  [/^ei/i, 'יי'],
  [/^ea/i, 'י'],
  [/^ie/i, 'י'],
  [/^oa/i, 'ו'],
  [/^ue/i, 'ו'],
  [/^ui/i, 'וי'],
];

const SINGLE: Record<string, string> = {
  a: 'א',
  b: 'ב',
  c: 'ק',
  d: 'ד',
  e: '',
  f: 'פ',
  g: 'ג',
  h: 'ה',
  i: 'י',
  j: "ג'",
  k: 'ק',
  l: 'ל',
  m: 'מ',
  n: 'נ',
  o: 'ו',
  p: 'פ',
  q: 'ק',
  r: 'ר',
  s: 'ס',
  t: 'ט',
  u: 'ו',
  v: 'ו',
  w: 'ו',
  x: 'קס',
  y: 'י',
  z: 'ז',
};

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

function transliterateWord(word: string): string {
  const lower = word.toLowerCase();
  let out = '';
  let i = 0;

  while (i < lower.length) {
    const rest = lower.slice(i);
    const rule = RULES.find(([pattern]) => pattern.test(rest));
    if (rule) {
      out += rule[1];
      i += rest.match(rule[0])![0].length;
      continue;
    }

    const ch = lower[i]!;
    if (!/[a-z]/.test(ch)) {
      out += ch;
      i++;
      continue;
    }

    // 'c' is soft before e/i/y, hard elsewhere.
    if (ch === 'c') {
      const next = lower[i + 1];
      out += next && 'eiy'.includes(next) ? 'ס' : 'ק';
      i++;
      continue;
    }

    // Interior vowels mostly vanish in Hebrew spelling; keep the ones that carry sound.
    if (VOWELS.has(ch)) {
      const atStart = i === 0;
      const atEnd = i === lower.length - 1;
      if (ch === 'a') out += atStart ? 'א' : atEnd ? 'ה' : 'א';
      else if (ch === 'e') out += atStart ? 'א' : '';
      else if (ch === 'i') out += 'י';
      else if (ch === 'o') out += 'ו';
      else out += 'ו';
      i++;
      continue;
    }

    out += SINGLE[ch] ?? '';
    i++;
  }

  // Final letter forms.
  const last = out.at(-1);
  if (last && FINALS[last]) out = out.slice(0, -1) + FINALS[last];
  return out;
}

const CACHE = new Map<string, string>();

export function toHebrew(name: string): string {
  const cached = CACHE.get(name);
  if (cached) return cached;
  const result = name
    .split(/\s+/)
    .map((word) => transliterateWord(word))
    .filter(Boolean)
    .join(' ')
    .trim();
  CACHE.set(name, result);
  return result || name;
}
