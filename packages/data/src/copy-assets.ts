/**
 * Copies the downloaded crests into the app's public folder so they ship with the
 * build and are available offline. Run after fetch-club-assets and build-pack.
 */
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const crestDir = join(here, '..', 'packs', 'crests');
const publicDir = join(here, '..', '..', 'app', 'public', 'crests');

async function main(): Promise<void> {
  if (!existsSync(crestDir)) {
    console.log('no crests to copy');
    return;
  }
  await rm(publicDir, { recursive: true, force: true });
  await mkdir(publicDir, { recursive: true });

  const files = (await readdir(crestDir)).filter((name) => name.endsWith('.png'));
  for (const file of files) {
    await copyFile(join(crestDir, file), join(publicDir, file));
  }
  console.log(`${files.length} crests -> ${publicDir}`);
}

void main();
