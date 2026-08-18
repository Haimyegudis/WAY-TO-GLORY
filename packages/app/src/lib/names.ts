import type { Competition, Country, Player } from '@fc/engine';
import type { Lang } from '../i18n/index.js';

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
export function playerName(player: Player | null | undefined): string {
  if (!player) return '';
  return `${player.firstName} ${player.lastName}`;
}
