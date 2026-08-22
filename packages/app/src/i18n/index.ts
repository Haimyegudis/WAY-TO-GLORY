import { create } from 'zustand';
import { en } from './en.js';
import { he } from './he.js';

export type Lang = 'he' | 'en';

const DICTS: Record<Lang, Record<string, string>> = { he, en };

export const LANG_LABEL: Record<Lang, string> = { he: 'עברית', en: 'English' };

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

function initialLang(): Lang {
  const stored = localStorage.getItem('fc.lang');
  if (stored === 'he' || stored === 'en') return stored;
  return navigator.language?.startsWith('he') ? 'he' : 'en';
}

export const useLang = create<LangState>((set) => ({
  lang: initialLang(),
  setLang: (lang) => {
    localStorage.setItem('fc.lang', lang);
    applyDocumentLang(lang);
    set({ lang });
  },
}));

export function applyDocumentLang(lang: Lang): void {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
}

export type TranslateArgs = Record<string, string | number | undefined>;

/*
 * Names arrive from the engine in one language: its own.
 *
 * The engine writes "Maccabi Tel Aviv" and "Bruno Machado" because it has no idea who is
 * reading. Screens used to fix that one call at a time, which meant every new message
 * was English until somebody noticed - the pre-match question, the team-mate who left,
 * the manager who arrived. Translation itself now does it, once, for every message in
 * the game.
 *
 * It is wired in at startup rather than imported, because the thing that knows how to
 * write a club's name in Hebrew needs to know how to write money, and money lives here.
 */
type ArgLocaliser = (args: TranslateArgs | undefined, lang: Lang) => TranslateArgs | undefined;

let localiseArgsFor: ArgLocaliser | null = null;

export function setArgLocaliser(fn: ArgLocaliser): void {
  localiseArgsFor = fn;
}

export function translate(lang: Lang, key: string, args?: TranslateArgs): string {
  const dict = DICTS[lang];
  // 'change.attr.finishing' and 'change.personality.discipline' reuse the
  // attribute and personality names rather than duplicating every label.
  const alias = key.startsWith('change.attr.')
    ? `attr.${key.slice('change.attr.'.length)}`
    : key.startsWith('change.personality.')
      ? `personality.${key.slice('change.personality.'.length)}`
      : null;
  let text = dict[key] ?? DICTS.en[key] ?? (alias ? dict[alias] ?? DICTS.en[alias] : undefined);
  /*
   * A question asked in three different ways is still one question.
   *
   * Several systems vary their wording by numbering it - "milestone.hundredthApp.v2",
   * "match.event.goal2" - and where the second wording was never written the screen
   * printed the word "v2" as if that were what the reporter had asked. The plain version
   * is always there; use it. Keys that really do end in a number are in the dictionary,
   * so this only ever runs for one that is missing.
   */
  if (text === undefined) {
    const base = key.replace(/(?:\.v)?\d+$/, '');
    if (base !== key) text = dict[base] ?? DICTS.en[base];
  }
  if (text === undefined) {
    // A missing key should read as a gap in the copy, not as a crash.
    return key.split('.').pop() ?? key;
  }
  if (args && localiseArgsFor) args = localiseArgsFor(args, lang);
  if (args) {
    for (const [name, value] of Object.entries(args)) {
      if (value === undefined) continue;
      // Values that are themselves keys (an injury type, a role) are translated in place.
      const resolved = typeof value === 'string' && value.includes('.') && (dict[value] ?? DICTS.en[value])
        ? translate(lang, value)
        : String(value);
      text = text.replaceAll(`{${name}}`, resolved);
    }
  }
  return text;
}

/** The hook every component uses: `const t = useT()` then `t('hub.season')`. */
export function useT(): (key: string, args?: TranslateArgs) => string {
  const lang = useLang((s) => s.lang);
  return (key, args) => translate(lang, key, args);
}

/** True when a key has real copy behind it, so optional text can stay hidden. */
export function hasTranslation(lang: Lang, key: string): boolean {
  return DICTS[lang][key] !== undefined || DICTS.en[key] !== undefined;
}

export function useDir(): 'rtl' | 'ltr' {
  return useLang((s) => s.lang) === 'he' ? 'rtl' : 'ltr';
}

/** Money is written the same way in both languages; only the grouping changes. */
export function formatMoney(value: number, lang: Lang): string {
  const abs = Math.abs(value);
  const locale = lang === 'he' ? 'he-IL' : 'en-GB';
  if (abs >= 1_000_000) return `€${(value / 1_000_000).toLocaleString(locale, { maximumFractionDigits: abs >= 10_000_000 ? 0 : 1 })}M`;
  if (abs >= 1_000) return `€${Math.round(value / 1_000).toLocaleString(locale)}K`;
  return `€${Math.round(value).toLocaleString(locale)}`;
}

export function formatSeason(season: number): string {
  return `${season}/${String((season + 1) % 100).padStart(2, '0')}`;
}
