/**
 * What kind of football a match was.
 *
 * A season's numbers used to be one pile: thirty-one appearances, nine goals. A player
 * reads them the way the game is actually played - so many in the league, so many in the
 * cup, a run in Europe, a handful for his country - and a camp friendly is not in any of
 * them. Both the engine and the app need the same answer to "what competition is this",
 * so there is one place that decides.
 */
export type MatchCategory = 'league' | 'cup' | 'leagueCup' | 'europe' | 'national' | 'friendly';

/** Everything that goes on his record. Camp friendlies do not. */
export const OFFICIAL_CATEGORIES: readonly MatchCategory[] = [
  'league', 'cup', 'leagueCup', 'europe', 'national',
];

export function matchCategory(competitionId: string): MatchCategory {
  const id = competitionId.toLowerCase();
  // An international friendly is a cap. A pre-season friendly is a Tuesday.
  if (id === 'friendly.national') return 'national';
  if (id.startsWith('friendly')) return 'friendly';
  if (id === 'ucl' || id === 'uel' || id === 'uecl' || id.startsWith('europe.')) return 'europe';
  if (/_leaguecup(\.youth)?$/.test(id)) return 'leagueCup';
  if (/_cup(\.youth)?$/.test(id) || id.startsWith('cup.')) return 'cup';
  if (id.startsWith('national.') || id.startsWith('international.') || id.startsWith('qualifier.')) {
    return 'national';
  }
  return 'league';
}

/** True for anything that belongs in his career record. */
export function isOfficial(competitionId: string): boolean {
  return matchCategory(competitionId) !== 'friendly';
}
