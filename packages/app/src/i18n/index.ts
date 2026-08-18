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

export function translate(lang: Lang, key: string, args?: TranslateArgs): string {
  const dict = DICTS[lang];
  let text = dict[key] ?? DICTS.en[key];
  if (text === undefined) {
    // A missing key should read as a gap in the copy, not as a crash.
    return key.split('.').pop() ?? key;
  }
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
