/**
 * One pass over every club that collects, in a single request each:
 *   - the crest image used on the club's Wikipedia article
 *   - the club's Hebrew name, from the article's Hebrew interwiki link
 *
 * Wikipedia rate-limits hard when hammered, so this runs two workers with a small
 * pause and backs off on 429. Results are cached in packs/clubs-assets.json, so a
 * re-run only picks up what is still missing.
 *
 * Crests are club trademarks, used here for a private, non-commercial build.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Club, DataPack } from '@fc/engine';
import { dominantColor } from './png-color.js';

const here = dirname(fileURLToPath(import.meta.url));
const packsDir = join(here, '..', 'packs');
const crestDir = join(packsDir, 'crests');
const assetsPath = join(packsDir, 'clubs-assets.json');

const UA = 'RoadToGloryGame/0.1 (private hobby project)';

export interface ClubAsset {
  clubId: string;
  title?: string;
  nameHe?: string;
  crest?: string;
  color?: string;
  tried?: boolean;
}

type AssetIndex = Record<string, ClubAsset>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function api(url: string): Promise<any | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (response.ok) return response.json();
    if (response.status === 429 || response.status >= 500) {
      await sleep(1200 * (attempt + 1));
      continue;
    }
    return null;
  }
  return null;
}

/** Article title and Hebrew name in one round trip. */
async function lookup(query: string): Promise<{ title: string; crest?: string; nameHe?: string } | null> {
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2' +
    '&generator=search&gsrnamespace=0&gsrlimit=1' +
    `&gsrsearch=${encodeURIComponent(query)}` +
    '&prop=pageimages%7Clanglinks&piprop=original%7Cthumbnail&pithumbsize=320&lllang=he&lllimit=1';

  const data = await api(url);
  const page = data?.query?.pages?.[0];
  if (!page || page.missing) return null;

  // PageImages leaves out non-free files, and club crests are almost always
  // non-free, so fall back to the article summary which does include them.
  let crest: string | undefined = page.thumbnail?.source ?? page.original?.source;
  if (!crest) crest = await summaryImage(page.title as string);

  const nameHe: string | undefined = page.langlinks?.[0]?.title;
  return { title: page.title as string, ...(crest ? { crest } : {}), ...(nameHe ? { nameHe } : {}) };
}

async function summaryImage(title: string): Promise<string | undefined> {
  const data = await api(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
  if (!data || data.type === 'disambiguation') return undefined;
  const source: string | undefined = data.thumbnail?.source ?? data.originalimage?.source;
  return source ? source.split('?')[0] : undefined;
}

function queryFor(club: Club, countryName: string): string {
  return `${club.name} football club ${countryName}`;
}

async function main(): Promise<void> {
  const pack = JSON.parse(await readFile(join(packsDir, 'pack.json'), 'utf8')) as DataPack;
  await mkdir(crestDir, { recursive: true });

  const index: AssetIndex = existsSync(assetsPath)
    ? (JSON.parse(await readFile(assetsPath, 'utf8')) as AssetIndex)
    : {};

  const countryName = (code: string) => pack.countries.find((c) => c.code === code)?.name ?? code;
  const todo = pack.clubs.filter((club) => {
    const record = index[club.id];
    if (!record) return true;
    if (record.crest && existsSync(join(crestDir, record.crest))) return false;
    return true;
  });

  console.log(`${pack.clubs.length} clubs, ${todo.length} to look up`);

  const queue = [...todo];
  let done = 0;

  async function worker(id: number): Promise<void> {
    await sleep(id * 300);
    for (;;) {
      const club = queue.shift();
      if (!club) return;
      const record: ClubAsset = index[club.id] ?? { clubId: club.id };
      record.tried = true;

      try {
        const found = await lookup(queryFor(club, countryName(club.country)));
        if (found) {
          record.title = found.title;
          if (found.nameHe) record.nameHe = found.nameHe;
          if (found.crest) {
            const image = await fetch(found.crest, { headers: { 'User-Agent': UA } });
            if (image.ok) {
              const bytes = Buffer.from(await image.arrayBuffer());
              const file = `${club.id}.png`;
              await writeFile(join(crestDir, file), bytes);
              record.crest = file;
              const color = dominantColor(bytes);
              if (color) record.color = color;
            }
          }
        }
      } catch (error) {
        console.error(`  fail ${club.id}: ${(error as Error).message}`);
      }

      index[club.id] = record;
      done++;
      if (done % 20 === 0) {
        const withCrest = Object.values(index).filter((r) => r.crest).length;
        const withHe = Object.values(index).filter((r) => r.nameHe).length;
        console.log(`  ${done}/${todo.length} (crests ${withCrest}, hebrew ${withHe})`);
        await writeFile(assetsPath, JSON.stringify(index, null, 2), 'utf8');
      }
      await sleep(120);
    }
  }

  await Promise.all([worker(0), worker(1)]);
  await writeFile(assetsPath, JSON.stringify(index, null, 2), 'utf8');

  const withCrest = Object.values(index).filter((r) => r.crest).length;
  const withHe = Object.values(index).filter((r) => r.nameHe).length;
  console.log(`\ndone: ${withCrest} crests, ${withHe} hebrew names, ${Object.values(index).filter((r) => r.color).length} colours`);
}

void main();
