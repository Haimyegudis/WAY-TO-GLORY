/**
 * Rebuilds the crest index from what is actually on disk.
 *
 * The index and the files can drift apart - a fetch that was interrupted, or two
 * sweeps running at once and the slower one writing last. The files are the truth:
 * every packs/crests/<clubId>.png belongs to that club, so this walks the pack and
 * re-attaches any file the index has forgotten, recomputing the club colour with it.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DataPack } from '@fc/engine';
import { dominantColor } from './png-color.js';

const here = dirname(fileURLToPath(import.meta.url));
const packsDir = join(here, '..', 'packs');
const crestDir = join(packsDir, 'crests');
const assetsPath = join(packsDir, 'clubs-assets.json');

async function main(): Promise<void> {
  const pack = JSON.parse(await readFile(join(packsDir, 'pack.json'), 'utf8')) as DataPack;
  const index: Record<string, any> = JSON.parse(await readFile(assetsPath, 'utf8'));

  let restored = 0;
  let dropped = 0;

  for (const club of pack.clubs) {
    const record = index[club.id] ?? { clubId: club.id };
    const file = `${club.id}.png`;
    const onDisk = existsSync(join(crestDir, file));

    if (onDisk && record.crest !== file) {
      record.crest = file;
      const colour = dominantColor(await readFile(join(crestDir, file)));
      if (colour) record.color = colour;
      restored++;
    }

    if (!onDisk && record.crest) {
      delete record.crest;
      delete record.color;
      dropped++;
    }

    index[club.id] = record;
  }

  await writeFile(assetsPath, JSON.stringify(index, null, 2), 'utf8');
  const total = Object.values(index).filter((r: any) => r.crest).length;
  console.log(`restored ${restored}, dropped ${dropped}, ${total} clubs now point at a crest`);
}

void main();
