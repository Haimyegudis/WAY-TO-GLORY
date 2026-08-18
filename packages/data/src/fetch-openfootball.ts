/**
 * Downloads the upstream openfootball files into packs/raw/.
 * Run with: npm run fetch -w @fc/data
 *
 * The build step reads only from packs/raw/, so the pack can be rebuilt offline
 * and the downloaded files can be committed for reproducibility.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES } from './sources.js';

const here = dirname(fileURLToPath(import.meta.url));
const rawDir = join(here, '..', 'packs', 'raw');

async function main(): Promise<void> {
  await mkdir(rawDir, { recursive: true });
  let ok = 0;
  let failed = 0;

  for (const source of SOURCES) {
    try {
      const response = await fetch(source.url);
      if (!response.ok) {
        console.error(`  MISS ${source.competitionId} (${response.status}) ${source.url}`);
        failed++;
        continue;
      }
      const body = await response.text();
      await writeFile(join(rawDir, source.file), body, 'utf8');
      console.log(`  ok   ${source.competitionId.padEnd(6)} ${(body.length / 1024).toFixed(0)}KB`);
      ok++;
    } catch (error) {
      console.error(`  FAIL ${source.competitionId}: ${(error as Error).message}`);
      failed++;
    }
  }

  console.log(`\nfetched ${ok} sources, ${failed} failures -> ${rawDir}`);
  if (ok === 0) process.exitCode = 1;
}

void main();
