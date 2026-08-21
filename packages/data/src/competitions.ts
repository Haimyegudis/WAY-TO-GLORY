import type { CardRules } from '@fc/engine';

export interface CompetitionSeed {
  id: string;
  name: string;
  nameHe: string;
  country: string;
  tier: number;
  reputation: number;
  rounds: number;
  split?: { regularRounds: number; regularLastWeek: number; upperTeams: number; groupRounds: number };
  promotionAuto?: number;
  promotionTo?: string;
  relegationAuto?: number;
  relegationTo?: string;
  /** Places that go straight into the group stage. */
  ucl?: number;
  uel?: number;
  uecl?: number;
  /** Places that have to be won through the summer qualifying rounds. */
  uclQual?: number;
  uelQual?: number;
  ueclQual?: number;
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
  // Countries we do not simulate below the top flight, but whose champions are in
  // Europe every August. Ten or so clubs each: enough for a real table and a real
  // route into the qualifying rounds.
  { id: 'sui.1', name: 'Swiss Super League', nameHe: 'הליגה השווייצרית', country: 'SUI', tier: 1, reputation: 60, rounds: 2, uclQual: 1, uelQual: 1, ueclQual: 1, cards: STANDARD_CARDS, manual: true },
  { id: 'ukr.1', name: 'Ukrainian Premier League', nameHe: 'הליגה האוקראינית', country: 'UKR', tier: 1, reputation: 58, rounds: 2, uclQual: 1, uelQual: 1, ueclQual: 1, cards: STANDARD_CARDS, manual: true },
  { id: 'cze.1', name: 'Czech First League', nameHe: 'הליגה הצ׳כית', country: 'CZE', tier: 1, reputation: 57, rounds: 2, uclQual: 1, uelQual: 1, ueclQual: 1, cards: STANDARD_CARDS, manual: true },
  { id: 'cro.1', name: 'Croatian First League', nameHe: 'הליגה הקרואטית', country: 'CRO', tier: 1, reputation: 56, rounds: 2, uclQual: 1, uelQual: 1, ueclQual: 1, cards: STANDARD_CARDS, manual: true },
  { id: 'srb.1', name: 'Serbian SuperLiga', nameHe: 'הליגה הסרבית', country: 'SRB', tier: 1, reputation: 55, rounds: 2, uclQual: 1, uelQual: 1, ueclQual: 1, cards: STANDARD_CARDS, manual: true },
  { id: 'den.1', name: 'Danish Superliga', nameHe: 'הליגה הדנית', country: 'DEN', tier: 1, reputation: 57, rounds: 2, uclQual: 1, uelQual: 1, ueclQual: 1, cards: STANDARD_CARDS, manual: true },
  { id: 'nor.1', name: 'Eliteserien', nameHe: 'הליגה הנורווגית', country: 'NOR', tier: 1, reputation: 54, rounds: 2, uclQual: 1, uelQual: 1, ueclQual: 1, cards: STANDARD_CARDS, manual: true },
  { id: 'swe.1', name: 'Allsvenskan', nameHe: 'הליגה השוודית', country: 'SWE', tier: 1, reputation: 54, rounds: 2, uclQual: 1, uelQual: 1, ueclQual: 1, cards: STANDARD_CARDS, manual: true },
  { id: 'pol.1', name: 'Ekstraklasa', nameHe: 'הליגה הפולנית', country: 'POL', tier: 1, reputation: 53, rounds: 2, uclQual: 1, uelQual: 1, ueclQual: 1, cards: STANDARD_CARDS, manual: true },
  { id: 'rou.1', name: 'Liga I', nameHe: 'הליגה הרומנית', country: 'ROU', tier: 1, reputation: 52, rounds: 2, uclQual: 1, uelQual: 1, ueclQual: 1, cards: STANDARD_CARDS, manual: true },
  { id: 'hun.1', name: 'Nemzeti Bajnokság I', nameHe: 'הליגה ההונגרית', country: 'HUN', tier: 1, reputation: 50, rounds: 2, uclQual: 1, uelQual: 1, ueclQual: 1, cards: STANDARD_CARDS, manual: true },
  { id: 'cyp.1', name: 'Cypriot First Division', nameHe: 'הליגה הקפריסאית', country: 'CYP', tier: 1, reputation: 49, rounds: 2, uclQual: 1, uelQual: 1, ueclQual: 1, cards: STANDARD_CARDS, manual: true },

  // England
  { id: 'en.1', name: 'Premier League', nameHe: 'פרמייר ליג', country: 'ENG', tier: 1, reputation: 95, rounds: 2, relegationAuto: 3, relegationTo: 'en.2', ucl: 4, uel: 2, uecl: 1, cards: STANDARD_CARDS },
  { id: 'en.2', name: 'Championship', nameHe: "צ'מפיונשיפ", country: 'ENG', tier: 2, reputation: 72, rounds: 2, promotionAuto: 3, promotionTo: 'en.1', relegationAuto: 3, relegationTo: 'en.3', cards: STANDARD_CARDS },
  { id: 'en.3', name: 'League One', nameHe: 'ליגה One', country: 'ENG', tier: 3, reputation: 52, rounds: 2, promotionAuto: 3, promotionTo: 'en.2', relegationAuto: 0, cards: LOWER_CARDS },

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
  { id: 'il.1', name: 'Ligat HaAl', nameHe: 'ליגת העל', country: 'ISR', tier: 1, reputation: 54, rounds: 2, split: { regularRounds: 2, regularLastWeek: 34, upperTeams: 6, groupRounds: 2 }, relegationAuto: 2, relegationTo: 'il.2', uclQual: 1, uelQual: 1, ueclQual: 2, cards: ISRAEL_CARDS, manual: true },
  { id: 'il.2', name: 'Liga Leumit', nameHe: 'ליגה לאומית', country: 'ISR', tier: 2, reputation: 40, rounds: 2, promotionAuto: 2, promotionTo: 'il.1', relegationAuto: 2, relegationTo: 'il.3', cards: ISRAEL_CARDS, manual: true },
  { id: 'il.3', name: 'Liga Alef', nameHe: "ליגה א'", country: 'ISR', tier: 3, reputation: 30, rounds: 2, promotionAuto: 2, promotionTo: 'il.2', relegationAuto: 0, cards: ISRAEL_CARDS, manual: true },

  // Extra countries: depth for the transfer market.
  { id: 'fr.1', name: 'Ligue 1', nameHe: 'ליג 1', country: 'FRA', tier: 1, reputation: 82, rounds: 2, relegationAuto: 2, relegationTo: 'fr.2', ucl: 3, uclQual: 1, uel: 2, uecl: 1, cards: STANDARD_CARDS },
  { id: 'fr.2', name: 'Ligue 2', nameHe: 'ליג 2', country: 'FRA', tier: 2, reputation: 60, rounds: 2, promotionAuto: 2, promotionTo: 'fr.1', relegationAuto: 2, cards: STANDARD_CARDS },
  { id: 'pt.1', name: 'Primeira Liga', nameHe: 'ליגה פורטוגלית', country: 'POR', tier: 1, reputation: 76, rounds: 2, relegationAuto: 2, ucl: 2, uclQual: 1, uel: 1, uelQual: 1, uecl: 1, cards: STANDARD_CARDS },
  { id: 'nl.1', name: 'Eredivisie', nameHe: 'ארדיוויזי', country: 'NED', tier: 1, reputation: 74, rounds: 2, relegationAuto: 2, ucl: 2, uclQual: 1, uel: 1, uelQual: 1, uecl: 1, cards: STANDARD_CARDS },
  { id: 'tr.1', name: 'Super Lig', nameHe: 'סופר ליג', country: 'TUR', tier: 1, reputation: 70, rounds: 2, relegationAuto: 3, ucl: 1, uclQual: 1, uel: 1, uelQual: 1, uecl: 1, cards: STANDARD_CARDS },
  { id: 'be.1', name: 'Pro League', nameHe: 'ליגה בלגית', country: 'BEL', tier: 1, reputation: 66, rounds: 2, relegationAuto: 2, ucl: 1, uclQual: 1, uel: 1, uecl: 1, cards: STANDARD_CARDS },
  { id: 'at.1', name: 'Bundesliga (AUT)', nameHe: 'בונדסליגה אוסטרית', country: 'AUT', tier: 1, reputation: 62, rounds: 2, relegationAuto: 1, uclQual: 1, uel: 1, uelQual: 1, uecl: 1, cards: STANDARD_CARDS },
  { id: 'gr.1', name: 'Super League', nameHe: 'סופר ליג יוונית', country: 'GRE', tier: 1, reputation: 60, rounds: 2, relegationAuto: 2, uclQual: 1, uel: 1, uelQual: 1, uecl: 1, cards: STANDARD_CARDS },
  { id: 'sco.1', name: 'Scottish Premiership', nameHe: 'ליגה סקוטית', country: 'SCO', tier: 1, reputation: 58, rounds: 2, relegationAuto: 1, uclQual: 1, uel: 1, uelQual: 1, uecl: 1, cards: STANDARD_CARDS },

  // The Americas. No European qualification: their continental cups are not modelled, so
  // a season here is won at home.
  { id: 'arg.1', name: 'Liga Profesional', nameHe: 'הליגה הארגנטינאית', country: 'ARG', tier: 1, reputation: 70, rounds: 2, cards: STANDARD_CARDS, manual: true },
  { id: 'bra.1', name: 'Brasileirão Série A', nameHe: 'הליגה הברזילאית', country: 'BRA', tier: 1, reputation: 73, rounds: 2, cards: STANDARD_CARDS, manual: true },
  { id: 'usa.1', name: 'Major League Soccer', nameHe: 'MLS', country: 'USA', tier: 1, reputation: 60, rounds: 2, cards: STANDARD_CARDS, manual: true },
];

export interface CountrySeed {
  code: string;
  name: string;
  nameHe: string;
  reputation: number;
  nameLocale: string;
  cupName: string;
  cupNameHe: string;
  /** Defaults to UEFA: everything here was European until the Americas arrived. */
  confederation?: 'UEFA' | 'CONMEBOL' | 'CONCACAF';
}

export const COUNTRIES: CountrySeed[] = [
  { code: 'SUI', name: 'Switzerland', nameHe: 'שווייץ', reputation: 62, nameLocale: 'de', cupName: 'Swiss Cup', cupNameHe: 'גביע שווייץ' },
  { code: 'UKR', name: 'Ukraine', nameHe: 'אוקראינה', reputation: 60, nameLocale: 'ua', cupName: 'Ukrainian Cup', cupNameHe: 'גביע אוקראינה' },
  { code: 'CZE', name: 'Czechia', nameHe: 'צ׳כיה', reputation: 59, nameLocale: 'cz', cupName: 'Czech Cup', cupNameHe: 'גביע צ׳כיה' },
  { code: 'CRO', name: 'Croatia', nameHe: 'קרואטיה', reputation: 60, nameLocale: 'hr', cupName: 'Croatian Cup', cupNameHe: 'גביע קרואטיה' },
  { code: 'SRB', name: 'Serbia', nameHe: 'סרביה', reputation: 58, nameLocale: 'rs', cupName: 'Serbian Cup', cupNameHe: 'גביע סרביה' },
  { code: 'DEN', name: 'Denmark', nameHe: 'דנמרק', reputation: 59, nameLocale: 'dk', cupName: 'Danish Cup', cupNameHe: 'גביע דנמרק' },
  { code: 'NOR', name: 'Norway', nameHe: 'נורווגיה', reputation: 56, nameLocale: 'no', cupName: 'Norwegian Cup', cupNameHe: 'גביע נורווגיה' },
  { code: 'SWE', name: 'Sweden', nameHe: 'שוודיה', reputation: 56, nameLocale: 'se', cupName: 'Svenska Cupen', cupNameHe: 'גביע שוודיה' },
  { code: 'POL', name: 'Poland', nameHe: 'פולין', reputation: 55, nameLocale: 'pl', cupName: 'Polish Cup', cupNameHe: 'גביע פולין' },
  { code: 'ROU', name: 'Romania', nameHe: 'רומניה', reputation: 54, nameLocale: 'ro', cupName: 'Romanian Cup', cupNameHe: 'גביע רומניה' },
  { code: 'HUN', name: 'Hungary', nameHe: 'הונגריה', reputation: 52, nameLocale: 'hu', cupName: 'Magyar Kupa', cupNameHe: 'גביע הונגריה' },
  { code: 'CYP', name: 'Cyprus', nameHe: 'קפריסין', reputation: 50, nameLocale: 'gr', cupName: 'Cypriot Cup', cupNameHe: 'גביע קפריסין' },

  { code: 'ENG', name: 'England', nameHe: 'אנגליה', reputation: 90, nameLocale: 'en' , cupName: 'FA Cup', cupNameHe: 'גביע האנגלי' },
  { code: 'ESP', name: 'Spain', nameHe: 'ספרד', reputation: 93, nameLocale: 'es' , cupName: 'Copa del Rey', cupNameHe: 'קופה דל ריי' },
  { code: 'ITA', name: 'Italy', nameHe: 'איטליה', reputation: 88, nameLocale: 'it' , cupName: 'Coppa Italia', cupNameHe: 'גביע איטליה' },
  { code: 'GER', name: 'Germany', nameHe: 'גרמניה', reputation: 90, nameLocale: 'de' , cupName: 'DFB-Pokal', cupNameHe: 'גביע גרמניה' },
  { code: 'ISR', name: 'Israel', nameHe: 'ישראל', reputation: 55, nameLocale: 'he' , cupName: 'State Cup', cupNameHe: 'גביע המדינה' },
  { code: 'FRA', name: 'France', nameHe: 'צרפת', reputation: 92, nameLocale: 'fr' , cupName: 'Coupe de France', cupNameHe: 'גביע צרפת' },
  { code: 'POR', name: 'Portugal', nameHe: 'פורטוגל', reputation: 87, nameLocale: 'pt' , cupName: 'Taça de Portugal', cupNameHe: 'גביע פורטוגל' },
  { code: 'NED', name: 'Netherlands', nameHe: 'הולנד', reputation: 85, nameLocale: 'nl' , cupName: 'KNVB Beker', cupNameHe: 'גביע הולנד' },
  { code: 'TUR', name: 'Turkey', nameHe: 'טורקיה', reputation: 70, nameLocale: 'tr' , cupName: 'Türkiye Kupası', cupNameHe: 'גביע טורקיה' },
  { code: 'BEL', name: 'Belgium', nameHe: 'בלגיה', reputation: 82, nameLocale: 'fr' , cupName: 'Belgian Cup', cupNameHe: 'גביע בלגיה' },
  { code: 'AUT', name: 'Austria', nameHe: 'אוסטריה', reputation: 72, nameLocale: 'de' , cupName: 'ÖFB-Cup', cupNameHe: 'גביע אוסטריה' },
  { code: 'GRE', name: 'Greece', nameHe: 'יוון', reputation: 66, nameLocale: 'gr' , cupName: 'Greek Cup', cupNameHe: 'גביע יוון' },
  { code: 'SCO', name: 'Scotland', nameHe: 'סקוטלנד', reputation: 66, nameLocale: 'en' , cupName: 'Scottish Cup', cupNameHe: 'גביע סקוטלנד' },

  // Across the water. Not in Europe, so nothing here plays for a European place - but a
  // career that starts in Buenos Aires or ends in Miami is a career people actually have.
  { code: 'ARG', name: 'Argentina', nameHe: 'ארגנטינה', reputation: 84, nameLocale: 'es' , cupName: 'Copa Argentina', cupNameHe: 'גביע ארגנטינה', confederation: 'CONMEBOL' },
  { code: 'BRA', name: 'Brazil', nameHe: 'ברזיל', reputation: 86, nameLocale: 'pt' , cupName: 'Copa do Brasil', cupNameHe: 'גביע ברזיל', confederation: 'CONMEBOL' },
  { code: 'USA', name: 'United States', nameHe: 'ארצות הברית', reputation: 63, nameLocale: 'en' , cupName: 'US Open Cup', cupNameHe: 'גביע ארה״ב', confederation: 'CONCACAF' },
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
