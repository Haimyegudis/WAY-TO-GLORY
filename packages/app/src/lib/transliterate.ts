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
  // Endings and clusters that a Hebrew speaker writes a particular way.
  [/^tz$/i, 'ץ'],
  [/^tz/i, 'צ'],
  [/^ts$/i, 'ץ'],
  [/^cz/i, "צ'"],
  [/^sz/i, 'ש'],
  [/^wski$/i, 'בסקי'],
  [/^owski$/i, 'ובסקי'],
  [/^aard/i, 'ארד'],
  [/^aa/i, 'א'],
  [/^ee$/i, 'י'],
  [/^ck$/i, 'ק'],
  [/^gn/i, 'ני'],
  [/^kh/i, 'ח'],
];

/**
 * Names that every Hebrew speaker already knows how to spell, where letter-by-letter
 * transliteration gets it wrong. Kept short on purpose: it is a correction list for
 * the common cases, not a dictionary.
 */
const KNOWN: Record<string, string> = {
  peretz: 'פרץ',
  perez: 'פרס',
  cohen: 'כהן',
  levy: 'לוי',
  levi: 'לוי',
  elad: 'אלעד',
  madmon: 'מדמון',
  dor: 'דור',
  yosef: 'יוסף',
  david: 'דוד',
  moshe: 'משה',
  shlomo: 'שלמה',
  itay: 'איתי',
  omri: 'עומרי',
  eli: 'אלי',
  gal: 'גל',
  ofir: 'אופיר',
  idan: 'עידן',
  ilay: 'עילאי',
  amir: 'אמיר',
  yarden: 'ירדן',
  raz: 'רז',
  liel: 'ליאל',
  shon: 'שון',
  bar: 'בר',
  ben: 'בן',
  lewandowski: 'לבנדובסקי',
  odegaard: 'אדגור',
  mbappe: 'מבאפה',
  haaland: 'הלאנד',
  bellingham: "בלינגהאם",
  vinicius: "ויניסיוס",
  rodrygo: 'רודריגו',
  messi: 'מסי',
  ronaldo: 'רונאלדו',
  neymar: 'ניימאר',
  salah: 'סלאח',
  kane: 'קיין',
  saka: 'סאקה',
  rice: 'רייס',
  saliba: 'סאליבה',
  raya: 'ראיה',
  foden: 'פודן',
  maddison: 'מדיסון',
};

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

/**
 * Languages where a final 'e' is silent. In English "Kane" ends on the n; in Turkish,
 * Italian, Spanish or Portuguese "Efe", "Conte" and "Vicente" end on the vowel, and
 * dropping it gives you "אף" instead of "אפה".
 */
const SILENT_FINAL_E = new Set(['ENG', 'SCO', 'WAL', 'IRL', 'USA', 'AUS', 'FRA']);

/**
 * Letters with no plain-Latin twin, which stripping accents cannot reach on its own.
 */
const ODD_LETTERS: Record<string, string> = {
  ø: 'o', Ø: 'o', đ: 'd', Đ: 'd', ð: 'd', Ð: 'd', þ: 'th', Þ: 'th', ß: 'ss',
  æ: 'ae', Æ: 'ae', œ: 'oe', Œ: 'oe', ł: 'l', Ł: 'l', ı: 'i', ħ: 'h', ŋ: 'ng',
};

/**
 * Down to the twenty-six letters the rules below are written for.
 *
 * Squads read off Wikipedia come spelled properly - Mbappé, Gyökeres, Šeško - and every
 * one of those accents fell through the rules and was printed as it stood, so a Hebrew
 * name came out with a Latin letter sitting in the middle of it. The accent carries no
 * sound Hebrew writes anyway, so it is dropped before anything else happens.
 */
function fold(word: string): string {
  const swapped = [...word].map((ch) => ODD_LETTERS[ch] ?? ch).join('');
  return swapped.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function transliterateWord(word: string, silentFinalE = true): string {
  const lower = fold(word).toLowerCase();
  const known = KNOWN[lower.replace(/[^a-z]/g, '')];
  if (known) return known;
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
      // A final 'e' is a syllable in most languages, and writing it keeps the letter
      // before it out of its final form: "Efe" is אפה, never אף.
      if (ch === 'e' && atEnd && !silentFinalE && out.length > 0) {
        out += 'ה';
        i++;
        continue;
      }
      if (ch === 'a') {
        // Only the first and last vowel get a letter; the middle ones are implied,
        // which is how Hebrew actually spells a foreign name.
        const previous = out.at(-1);
        out += atStart ? 'א' : atEnd ? 'ה' : previous === 'א' ? '' : 'א';
      }
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

export function toHebrew(name: string, countryCode?: string): string {
  const silentFinalE = countryCode === undefined || SILENT_FINAL_E.has(countryCode);
  const key = `${countryCode ?? '-'}|${name}`;
  const cached = CACHE.get(key);
  if (cached) return cached;
  const result = name
    .split(/\s+/)
    .map((word) => transliterateWord(word, silentFinalE))
    .filter(Boolean)
    .join(' ')
    .trim();
  CACHE.set(key, result);
  return result || name;
}
