/** Where the real-world club and league data comes from. */

export interface JsonSource {
  kind: 'json';
  competitionId: string;
  url: string;
  file: string;
}

export interface TxtSource {
  kind: 'txt';
  competitionId: string;
  url: string;
  file: string;
}

export type Source = JsonSource | TxtSource;

const SEASON_DIR = '2025-26';
const JSON_BASE = `https://raw.githubusercontent.com/openfootball/football.json/master/${SEASON_DIR}`;

function json(competitionId: string, code: string): JsonSource {
  return { kind: 'json', competitionId, url: `${JSON_BASE}/${code}.json`, file: `${code}.json` };
}

export const SOURCES: Source[] = [
  // England: three tiers, all available upstream.
  json('en.1', 'en.1'),
  json('en.2', 'en.2'),
  json('en.3', 'en.3'),
  // Spain and Italy: top two tiers upstream, third tier is authored by hand.
  json('es.1', 'es.1'),
  json('es.2', 'es.2'),
  json('it.1', 'it.1'),
  json('it.2', 'it.2'),
  // Germany: top two from football.json, 3. Liga from the deutschland repo.
  json('de.1', 'de.1'),
  json('de.2', 'de.2'),
  {
    kind: 'txt',
    competitionId: 'de.3',
    url: 'https://raw.githubusercontent.com/openfootball/deutschland/master/2025-26/3-liga3.txt',
    file: 'de.3.txt',
  },
  // Extra countries: they give the transfer market somewhere to move the player abroad.
  json('fr.1', 'fr.1'),
  json('fr.2', 'fr.2'),
  json('pt.1', 'pt.1'),
  json('nl.1', 'nl.1'),
  json('tr.1', 'tr.1'),
  json('be.1', 'be.1'),
  json('at.1', 'at.1'),
  json('gr.1', 'gr.1'),
  json('sco.1', 'sco.1'),
];
