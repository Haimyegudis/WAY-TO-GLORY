/**
 * Top clubs from countries we do not simulate below the first division, read by
 * src/fetch-euro-guests.ts. Data, not source: rerun the fetcher to refresh it.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export interface EuroGuest {
  id: string;
  name: string;
  shortName: string;
  city?: string;
  country: string;
  competitionId: string;
  crest?: string;
  color?: string;
  sourceRef?: string;
}

let loaded: EuroGuest[] = [];
try {
  loaded = require('../packs/euro-guests.json') as EuroGuest[];
} catch {
  // Not fetched yet: the pack simply ships without them.
}

export const EURO_GUESTS = loaded;
