import { SCHEMA_VERSION, GAME_VERSION } from './career.js';
import { overall } from './positions.js';
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
    inbox: state.inbox.slice(0, 90),
    world: {
      ...state.world,
      ...(state.world.youth ? { youth: compactYouth(state.world.youth, season) } : {}),
      competitions: forgetOldScorers(state.world.competitions, season),
    },
  };
}

/**
 * Who scored in each fixture is worth keeping for the season being played and worth
 * nothing afterwards: the season charts and the history already hold what matters.
 */
function forgetOldScorers(
  competitions: CareerState['world']['competitions'],
  season: number,
): CareerState['world']['competitions'] {
  const out: CareerState['world']['competitions'] = {};
  for (const [id, comp] of Object.entries(competitions)) {
    out[id] = comp.season >= season
      ? comp
      : { ...comp, fixtures: comp.fixtures.map((f) => ({ ...f, goals: undefined })) };
  }
  return out;
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
  repairConversationContinuity(state);
  return state;
}

/**
 * Repair conversation state that was valid to older builds but reads as a repeated
 * interaction now.
 *
 * A first professional appearance used to raise both the debut interview and a second
 * "first match in new colours" interview. New careers cover the second milestone at
 * source; loaded careers also need the already-queued duplicate removed or the bug
 * survives an otherwise-correct deployment.
 */
function repairConversationContinuity(state: CareerState): void {
  const season = state.world.season;
  if (!state.flags[`asked:debut:${season}`]) return;

  state.flags[`asked:firstAfterTransfer:${season}`] = true;
  const duplicateDecisionIds = new Set(
    state.pendingDecisions
      .filter((decision) => decision.eventId === 'milestone:firstAfterTransfer')
      .map((decision) => decision.id),
  );
  if (duplicateDecisionIds.size === 0) return;
  state.pendingDecisions = state.pendingDecisions.filter(
    (decision) => !duplicateDecisionIds.has(decision.id),
  );
  state.inbox = state.inbox.filter(
    (message) => !message.decisionId || !duplicateDecisionIds.has(message.decisionId),
  );
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

  /**
   * Schema 2 to 3: one man, once.
   *
   * The pack used to carry a marquee player under two spellings - Vinicius Junior by
   * keyboard and Vinícius Júnior by encyclopedia - and the squad builder planted both,
   * so careers started before that was fixed have him twice on the team sheet. A new
   * career gets a clean squad; this is for the ones already being played.
   *
   * The better-rated of the two stays and the other is taken off the sheet. Anything
   * written down about him - a goal in a match report - already survives a player it
   * cannot find, so nothing else has to be rewritten.
   */
  2: (state) => {
    // Letters of any script, not just a-z: most of a squad is generated with Hebrew
    // names, and stripping to Latin turned every one of them into the same empty key -
    // which would have deleted a whole team rather than one twin.
    const fold = (word: string) =>
      word
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, '');

    for (const [clubId, ids] of Object.entries(state.world.squads)) {
      const best = new Map<string, string>();
      const dropped = new Set<string>();

      for (const id of ids) {
        const player = state.world.players[id];
        if (!player || player.isUser) continue;
        const key = `${fold(player.firstName)}|${fold(player.lastName)}`;
        const held = best.get(key);
        if (!held) {
          best.set(key, id);
          continue;
        }
        const other = state.world.players[held]!;
        const keep = overall(player.attributes, player.primaryPos, player.secondaryPos) >
          overall(other.attributes, other.primaryPos, other.secondaryPos)
          ? id
          : held;
        const drop = keep === id ? held : id;
        best.set(key, keep);
        dropped.add(drop);
      }

      if (dropped.size === 0) continue;
      state.world.squads[clubId] = ids.filter((id) => !dropped.has(id));
      for (const id of dropped) delete state.world.players[id];
    }

    return state;
  },
};


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
