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
  const recentMatches = state.matchLog.filter((m) => m.season >= season - 1).slice(0, 140);
  return {
    ...state,
    matchLog: recentMatches.map((m) => (m.season < season ? { ...m, events: undefined } : m)),
    news: state.news.slice(0, 40),
    inbox: state.inbox.slice(0, 50),
    world: { ...state.world, ...(state.world.youth ? { youth: compactYouth(state.world.youth, season) } : {}) },
  };
}

/**
 * The academy, written down small.
 *
 * A youth division is a few hundred boys, most of whom leave without ever being looked
 * at twice. Only the ones still in the age group are worth keeping, and only this
 * season's record for them - last season's numbers were used to hand out last season's
 * honours, and those are already in the history.
 */
function compactYouth(youth: NonNullable<CareerState['world']['youth']>, season: number) {
  const alive = new Set(Object.values(youth.squads).flat());
  const players: typeof youth.players = {};
  const stats: typeof youth.stats = {};
  for (const id of alive) {
    const player = youth.players[id];
    if (player) players[id] = player;
    const record = youth.stats[id];
    if (record && record.season >= season) stats[id] = record;
  }
  return { ...youth, players, stats };
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
const MIGRATIONS: Record<number, Migration> = {
  /**
   * Schema 1 to 2: the youth league grows from one shadow table into a pyramid.
   *
   * The old table cannot be turned into the new one - it has no squads, no membership
   * and no boys in it - so it is set aside and the world is left without a youth
   * pyramid until the next season boundary builds one properly. A career that has
   * already outgrown the age group never notices.
   */
  1: (state) => {
    const world = state.world as CareerState['world'] & {
      youthForm?: unknown;
      youth?: unknown;
    };
    const legacy = world.youth as CareerState['world']['youthLegacy'];
    if (legacy && 'fixtures' in (legacy as object)) {
      world.youthLegacy = legacy;
    }
    world.youth = undefined;
    delete world.youthForm;

    const nt = state.nationalTeam as CareerState['nationalTeam'] & {
      youthCaps?: number;
      youthGoals?: number;
    };
    nt.youthCaps = nt.youthCaps ?? 0;
    nt.youthGoals = nt.youthGoals ?? 0;

    return state;
  },
};

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
