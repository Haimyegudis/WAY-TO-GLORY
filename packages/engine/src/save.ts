import { SCHEMA_VERSION, GAME_VERSION } from './career.js';
import type { CareerState } from './types.js';

export interface SaveEnvelope {
  schemaVersion: number;
  gameVersion: string;
  savedAt: string;
  state: CareerState;
}

/**
 * Keep the save small enough that twenty seasons still fit comfortably in IndexedDB:
 * detail is kept for the recent past, aggregates are kept forever.
 */
export function compact(state: CareerState): CareerState {
  const season = state.world.season;
  const recentMatches = state.matchLog.filter((m) => m.season >= season - 1).slice(0, 60);
  return {
    ...state,
    matchLog: recentMatches.map((m) => (m.season < season ? { ...m, events: undefined } : m)),
    news: state.news.slice(0, 40),
    inbox: state.inbox.slice(0, 50),
  };
}

export function serialize(state: CareerState, now = new Date().toISOString()): string {
  const envelope: SaveEnvelope = {
    schemaVersion: SCHEMA_VERSION,
    gameVersion: GAME_VERSION,
    savedAt: now,
    state: { ...compact(state), savedAt: now },
  };
  return JSON.stringify(envelope);
}

export function deserialize(raw: string): CareerState {
  const parsed = JSON.parse(raw) as SaveEnvelope;
  return migrate(parsed);
}

/**
 * Migrations run in order, each bumping one version. An app update must never
 * destroy a career, so unknown-but-newer saves are rejected loudly instead of
 * being silently half-loaded.
 */
export function migrate(envelope: SaveEnvelope): CareerState {
  if (envelope.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `Save was written by a newer version (schema ${envelope.schemaVersion} > ${SCHEMA_VERSION}). Update the app.`,
    );
  }
  let state = envelope.state;
  let version = envelope.schemaVersion;

  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) break;
    state = step(state);
    version += 1;
  }

  state.schemaVersion = SCHEMA_VERSION;
  return state;
}

type Migration = (state: CareerState) => CareerState;

/** Index N migrates a save at schemaVersion N to N+1. */
const MIGRATIONS: Record<number, Migration> = {};

export function isSameCareer(a: CareerState, b: CareerState): boolean {
  return a.careerSeed === b.careerSeed && a.createdAt === b.createdAt;
}

/** UTF-8 byte length without depending on TextEncoder, so this also runs in bare Node. */
export function saveSizeBytes(state: CareerState): number {
  const text = serialize(state);
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}
