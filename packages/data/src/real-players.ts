/**
 * Real squad members, read from TheSportsDB by src/fetch-squads.ts.
 *
 * Kept as a generated JSON file rather than hand-written source: it is data, it is
 * refreshed by rerunning the fetcher, and it should never be edited by hand.
 */
import { createRequire } from 'node:module';
import type { StarPlayerSeed } from '@fc/engine';

const require = createRequire(import.meta.url);

let loaded: Record<string, StarPlayerSeed[]> = {};
try {
  loaded = require('../packs/real-players.json') as Record<string, StarPlayerSeed[]>;
} catch {
  // Not fetched yet: the pack simply ships the hand-written stars.
}

export const REAL_PLAYERS = loaded;
