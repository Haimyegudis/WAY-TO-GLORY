import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { deserialize, serialize, type CareerState } from '@fc/engine';

/**
 * Save slots.
 *
 * One device, several careers: a slot per player, each with its own save blob and a
 * small summary so the title screen can list them without loading a megabyte of world
 * state per row. The old single-save key is migrated into a slot the first time the
 * game runs, so nobody loses the career they were in the middle of.
 */

const INDEX_KEY = 'fc.saves.v1';
const SLOT_PREFIX = 'fc.save.';
const LEGACY_KEY = 'fc.career.v1';

export interface SaveSummary {
  id: string;
  playerName: string;
  clubName: string;
  season: number;
  week: number;
  age: number;
  ovr: number;
  retired: boolean;
  /** Wall-clock of the last write, for "last played" ordering. */
  updatedAt: number;
}

function slotKey(id: string): string {
  return `${SLOT_PREFIX}${id}`;
}

export async function listSaves(): Promise<SaveSummary[]> {
  const index = (await idbGet<SaveSummary[]>(INDEX_KEY)) ?? [];
  return [...index].sort((a, b) => b.updatedAt - a.updatedAt);
}

async function writeIndex(saves: SaveSummary[]): Promise<void> {
  await idbSet(INDEX_KEY, saves);
}

export async function writeSave(id: string, state: CareerState, summary: Omit<SaveSummary, 'id' | 'updatedAt'>): Promise<SaveSummary[]> {
  await idbSet(slotKey(id), serialize(state));
  const index = (await idbGet<SaveSummary[]>(INDEX_KEY)) ?? [];
  const entry: SaveSummary = { ...summary, id, updatedAt: Date.now() };
  const next = [entry, ...index.filter((save) => save.id !== id)];
  await writeIndex(next);
  return next.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function readSave(id: string): Promise<CareerState | null> {
  const raw = await idbGet<string>(slotKey(id));
  if (typeof raw !== 'string') return null;
  try {
    return deserialize(raw);
  } catch {
    return null;
  }
}

export async function deleteSave(id: string): Promise<SaveSummary[]> {
  await idbDel(slotKey(id));
  const index = (await idbGet<SaveSummary[]>(INDEX_KEY)) ?? [];
  const next = index.filter((save) => save.id !== id);
  await writeIndex(next);
  return next;
}

/**
 * Moves a pre-slots save into a slot of its own. Runs once: after it, the legacy key
 * is gone and the career lives in the list like any other.
 */
export async function migrateLegacySave(): Promise<SaveSummary[]> {
  const index = (await idbGet<SaveSummary[]>(INDEX_KEY)) ?? [];
  const raw = await idbGet<string>(LEGACY_KEY);
  if (typeof raw !== 'string') return index;

  try {
    const state = deserialize(raw);
    const id = `career-${state.careerSeed}`;
    if (!index.some((save) => save.id === id)) {
      await idbSet(slotKey(id), raw);
      const club = state.player.clubId ? state.world.clubs[state.player.clubId] : null;
      const entry: SaveSummary = {
        id,
        playerName: `${state.player.firstName} ${state.player.lastName}`,
        clubName: club?.name ?? '',
        season: state.world.season,
        week: state.world.week,
        age: state.world.season - state.player.birthYear,
        ovr: 0,
        retired: Boolean(state.retired),
        updatedAt: Date.now(),
      };
      const next = [entry, ...index];
      await writeIndex(next);
      await idbDel(LEGACY_KEY);
      return next;
    }
    await idbDel(LEGACY_KEY);
  } catch {
    // A save we cannot read is not worth keeping in the way.
  }
  return index;
}

export function newSaveId(): string {
  return `career-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}
