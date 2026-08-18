import type { CardRules } from '@fc/engine';

export interface CompetitionSeed {
  id: string;
  name: string;
  nameHe: string;
  country: string;
  tier: number;
  reputation: number;
  rounds: number;
  promotionAuto?: number;
  promotionTo?: string;
  relegationAuto?: number;
  relegationTo?: string;
  ucl?: number;
  uel?: number;
  uecl?: number;
  cards: CardRules;
  /** Set when the club list is authored by hand rather than imported. */
  manual?: boolean;
}

const STANDARD_CARDS: CardRules = {
  yellowSuspensionThreshold: 5,
  resetAfterMatchday: 19,
  secondYellowSuspension: 1,
  redSuspension: 2,
};

const LOWER_CARDS: CardRules = {
  yellowSuspensionThreshold: 5,
  resetAfterMatchday: 0,
  secondYellowSuspension: 1,
  redSuspension: 2,
};

const ISRAEL_CARDS: CardRules = {
  yellowSuspensionThreshold: 4,
  resetAfterMatchday: 0,
  secondYellowSuspension: 1,
  redSuspension: 2,
};

export const COMPETITIONS: CompetitionSeed[] = [
  // England
  { id: 'en.1', name: 'Premier League', nameHe: 'פרמייר ליג', country: 'ENG', tier: 1, reputation: 95, rounds: 2, relegationAuto: 3, relegationTo: 'en.2', ucl: 4, uel: 2, uecl: 1, cards: STANDARD_CARDS },
  { id: 'en.2', name: 'Championship', nameHe: "צ'מפיונשיפ", country: 'ENG', tier: 2, reputation: 72, rounds: 2, promotionAuto: 3, promotionTo: 'en.1', relegationAuto: 3, relegationTo: 'en.3', cards: STANDARD_CARDS },
  { id: 'en.3', name: 'League One', nameHe: 'ליג One', country: 'ENG', tier: 3, reputation: 52, rounds: 2, promotionAuto: 3, promotionTo: 'en.2', relegationAuto: 0, cards: LOWER_CARDS },

  // Spain
  { id: 'es.1', name: 'LaLiga', nameHe: 'לה ליגה', country: 'ESP', tier: 1, reputation: 92, rounds: 2, relegationAuto: 3, relegationTo: 'es.2', ucl: 4, uel: 2, uecl: 1, cards: STANDARD_CARDS },
  { id: 'es.2', name: 'LaLiga 2', nameHe: 'לה ליגה 2', country: 'ESP', tier: 2, reputation: 66, rounds: 2, promotionAuto: 3, promotionTo: 'es.1', relegationAuto: 4, relegationTo: 'es.3', cards: STANDARD_CARDS },
  { id: 'es.3', name: 'Primera Federacion', nameHe: 'פרימרה פדרסיון', country: 'ESP', tier: 3, reputation: 48, rounds: 2, promotionAuto: 4, promotionTo: 'es.2', relegationAuto: 0, cards: LOWER_CARDS, manual: true },

  // Italy
  { id: 'it.1', name: 'Serie A', nameHe: 'סריה A', country: 'ITA', tier: 1, reputation: 89, rounds: 2, relegationAuto: 3, relegationTo: 'it.2', ucl: 4, uel: 2, uecl: 1, cards: STANDARD_CARDS },
  { id: 'it.2', name: 'Serie B', nameHe: 'סריה B', country: 'ITA', tier: 2, reputation: 64, rounds: 2, promotionAuto: 3, promotionTo: 'it.1', relegationAuto: 3, relegationTo: 'it.3', cards: STANDARD_CARDS },
  { id: 'it.3', name: 'Serie C', nameHe: 'סריה C', country: 'ITA', tier: 3, reputation: 46, rounds: 2, promotionAuto: 3, promotionTo: 'it.2', relegationAuto: 0, cards: LOWER_CARDS, manual: true },

  // Germany
  { id: 'de.1', name: 'Bundesliga', nameHe: 'בונדסליגה', country: 'GER', tier: 1, reputation: 89, rounds: 2, relegationAuto: 2, relegationTo: 'de.2', ucl: 4, uel: 2, uecl: 1, cards: STANDARD_CARDS },
  { id: 'de.2', name: '2. Bundesliga', nameHe: 'בונדסליגה 2', country: 'GER', tier: 2, reputation: 68, rounds: 2, promotionAuto: 2, promotionTo: 'de.1', relegationAuto: 2, relegationTo: 'de.3', cards: STANDARD_CARDS },
  { id: 'de.3', name: '3. Liga', nameHe: 'ליגה 3', country: 'GER', tier: 3, reputation: 50, rounds: 2, promotionAuto: 2, promotionTo: 'de.2', relegationAuto: 0, cards: LOWER_CARDS },

  // Israel
  { id: 'il.1', name: 'Ligat HaAl', nameHe: 'ליגת העל', country: 'ISR', tier: 1, reputation: 54, rounds: 2, relegationAuto: 2, relegationTo: 'il.2', uecl: 2, cards: ISRAEL_CARDS, manual: true },
  { id: 'il.2', name: 'Liga Leumit', nameHe: 'ליגה לאומית', country: 'ISR', tier: 2, reputation: 40, rounds: 2, promotionAuto: 2, promotionTo: 'il.1', relegationAuto: 2, relegationTo: 'il.3', cards: ISRAEL_CARDS, manual: true },
  { id: 'il.3', name: 'Liga Alef', nameHe: "ליגה א'", country: 'ISR', tier: 3, reputation: 30, rounds: 2, promotionAuto: 2, promotionTo: 'il.2', relegationAuto: 0, cards: ISRAEL_CARDS, manual: true },

  // Extra countries: depth for the transfer market.
  { id: 'fr.1', name: 'Ligue 1', nameHe: 'ליג 1', country: 'FRA', tier: 1, reputation: 82, rounds: 2, relegationAuto: 2, relegationTo: 'fr.2', ucl: 3, uel: 2, uecl: 1, cards: STANDARD_CARDS },
  { id: 'fr.2', name: 'Ligue 2', nameHe: 'ליג 2', country: 'FRA', tier: 2, reputation: 60, rounds: 2, promotionAuto: 2, promotionTo: 'fr.1', relegationAuto: 2, cards: STANDARD_CARDS },
  { id: 'pt.1', name: 'Primeira Liga', nameHe: 'ליגה פורטוגלית', country: 'POR', tier: 1, reputation: 76, rounds: 2, relegationAuto: 2, ucl: 2, uel: 2, uecl: 1, cards: STANDARD_CARDS },
  { id: 'nl.1', name: 'Eredivisie', nameHe: 'ארדיוויזי', country: 'NED', tier: 1, reputation: 74, rounds: 2, relegationAuto: 2, ucl: 2, uel: 2, uecl: 1, cards: STANDARD_CARDS },
  { id: 'tr.1', name: 'Super Lig', nameHe: 'סופר ליג', country: 'TUR', tier: 1, reputation: 70, rounds: 2, relegationAuto: 3, ucl: 2, uel: 2, uecl: 1, cards: STANDARD_CARDS },
  { id: 'be.1', name: 'Pro League', nameHe: 'ליגה בלגית', country: 'BEL', tier: 1, reputation: 66, rounds: 2, relegationAuto: 2, ucl: 2, uel: 1, uecl: 1, cards: STANDARD_CARDS },
  { id: 'at.1', name: 'Bundesliga (AUT)', nameHe: 'בונדסליגה אוסטרית', country: 'AUT', tier: 1, reputation: 62, rounds: 2, relegationAuto: 1, ucl: 1, uel: 1, uecl: 1, cards: STANDARD_CARDS },
  { id: 'gr.1', name: 'Super League', nameHe: 'סופר ליג יוונית', country: 'GRE', tier: 1, reputation: 60, rounds: 2, relegationAuto: 2, ucl: 1, uel: 1, uecl: 1, cards: STANDARD_CARDS },
  { id: 'sco.1', name: 'Scottish Premiership', nameHe: 'ליגה סקוטית', country: 'SCO', tier: 1, reputation: 58, rounds: 2, relegationAuto: 1, ucl: 1, uel: 1, uecl: 1, cards: STANDARD_CARDS },
];

export interface CountrySeed {
  code: string;
  name: string;
  nameHe: string;
  reputation: number;
  nameLocale: string;
}

export const COUNTRIES: CountrySeed[] = [
  { code: 'ENG', name: 'England', nameHe: 'אנגליה', reputation: 90, nameLocale: 'en' },
  { code: 'ESP', name: 'Spain', nameHe: 'ספרד', reputation: 93, nameLocale: 'es' },
  { code: 'ITA', name: 'Italy', nameHe: 'איטליה', reputation: 88, nameLocale: 'it' },
  { code: 'GER', name: 'Germany', nameHe: 'גרמניה', reputation: 90, nameLocale: 'de' },
  { code: 'ISR', name: 'Israel', nameHe: 'ישראל', reputation: 55, nameLocale: 'he' },
  { code: 'FRA', name: 'France', nameHe: 'צרפת', reputation: 92, nameLocale: 'fr' },
  { code: 'POR', name: 'Portugal', nameHe: 'פורטוגל', reputation: 87, nameLocale: 'pt' },
  { code: 'NED', name: 'Netherlands', nameHe: 'הולנד', reputation: 85, nameLocale: 'nl' },
  { code: 'TUR', name: 'Turkey', nameHe: 'טורקיה', reputation: 70, nameLocale: 'tr' },
  { code: 'BEL', name: 'Belgium', nameHe: 'בלגיה', reputation: 82, nameLocale: 'fr' },
  { code: 'AUT', name: 'Austria', nameHe: 'אוסטריה', reputation: 72, nameLocale: 'de' },
  { code: 'GRE', name: 'Greece', nameHe: 'יוון', reputation: 66, nameLocale: 'gr' },
  { code: 'SCO', name: 'Scotland', nameHe: 'סקוטלנד', reputation: 66, nameLocale: 'en' },
];

/** Clubs whose global standing is bigger than this season's results suggest. */
export const REPUTATION_OVERRIDES: Record<string, number> = {
  'en.1:Manchester United FC': 92,
  'en.1:Liverpool FC': 96,
  'en.1:Manchester City FC': 96,
  'en.1:Arsenal FC': 94,
  'en.1:Chelsea FC': 92,
  'en.1:Tottenham Hotspur FC': 88,
  'en.1:Newcastle United FC': 84,
  'es.1:Real Madrid CF': 99,
  'es.1:FC Barcelona': 98,
  'es.1:Club Atlético de Madrid': 90,
  'es.1:Sevilla FC': 82,
  'es.1:Valencia CF': 80,
  'it.1:Juventus FC': 91,
  'it.1:AC Milan': 91,
  'it.1:FC Internazionale Milano': 92,
  'it.1:AS Roma': 86,
  'it.1:SSC Napoli': 88,
  'de.1:FC Bayern München': 97,
  'de.1:Borussia Dortmund': 90,
  'de.1:Bayer 04 Leverkusen': 86,
  'de.1:RB Leipzig': 84,
  'fr.1:Paris Saint-Germain FC': 96,
  'fr.1:Olympique de Marseille': 82,
  'fr.1:Olympique Lyonnais': 80,
  'pt.1:SL Benfica': 86,
  'pt.1:FC Porto': 86,
  'pt.1:Sporting CP': 85,
  'nl.1:AFC Ajax': 84,
  'nl.1:PSV Eindhoven': 83,
  'tr.1:Galatasaray SK': 82,
  'tr.1:Fenerbahce SK': 81,
  'sco.1:Celtic FC': 78,
  'sco.1:Rangers FC': 77,
  'il.1:Maccabi Tel Aviv': 62,
  'il.1:Maccabi Haifa': 60,
  'il.1:Hapoel Beer Sheva': 58,
};
