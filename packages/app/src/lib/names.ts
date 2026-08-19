import type { Competition, Country, Player } from '@fc/engine';
import type { Lang } from '../i18n/index.js';
import { toHebrew } from './transliterate.js';

/** Competition name in the player's language, falling back to the original. */
export function competitionName(comp: Competition | null | undefined, lang: Lang): string {
  if (!comp) return '';
  return lang === 'he' && comp.nameHe ? comp.nameHe : comp.name;
}

export function countryName(country: Country | null | undefined, lang: Lang): string {
  if (!country) return '';
  return lang === 'he' && country.nameHe ? country.nameHe : country.name;
}

/**
 * Player names. Generated Israeli players already carry Hebrew names; real players
 * from the data pack keep the spelling they are known by.
 */
export function playerName(player: Player | null | undefined, lang: Lang = 'en'): string {
  if (!player) return '';
  const name = `${player.firstName} ${player.lastName}`;
  if (lang !== 'he') return name;
  // Hebrew-generated players already read in Hebrew; everyone else is transliterated,
  // with the rules of the language he is named in.
  return /[\u0590-\u05FF]/.test(name) ? name : toHebrew(name, player.birthCountry);
}

/**
 * Any competition id the engine can hand us: a league from the pack, a domestic cup
 * ("eng_cup"), or one of the three European competitions. Leagues and cups carry
 * their real names; Europe is named in the dictionary.
 */
export function competitionLabel(
  id: string,
  pack: { competitions: Competition[]; countries: Country[] },
  lang: Lang,
  t: (key: string) => string,
): string {
  const league = pack.competitions.find((c) => c.id === id);
  if (league) return competitionName(league, lang);

  if (id === 'ucl' || id === 'uel' || id === 'uecl') return t(`competition.${id}`);

  const cupMatch = /^([a-z]{3})_cup$/.exec(id);
  if (cupMatch) {
    const code = cupMatch[1]!.toUpperCase();
    const country = pack.countries.find((c) => c.code === code);
    const name = lang === 'he' ? country?.cupNameHe : country?.cupName;
    if (name) return name;
    return country ? `${countryName(country, lang)} · ${t('club.cup')}` : t('club.cup');
  }

  return t('club.cup');
}
