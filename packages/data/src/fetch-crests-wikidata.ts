/**
 * The source of truth for club crests: Wikidata.
 *
 * The earlier passes took whatever lead image a Wikipedia article happened to have,
 * which for a lot of clubs is a stadium, a squad photo or the badge of the parent
 * multi-sport club. Wikidata models the badge explicitly (P154 "logo image") on an
 * item we can check really is an association football club, so this pass re-sources
 * every club from there and records where each file came from.
 *
 *   tsx src/fetch-crests-wikidata.ts          # only clubs without a verified crest
 *   tsx src/fetch-crests-wikidata.ts --all    # re-source every club
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DataPack } from '@fc/engine';
import { dominantColor } from './png-color.js';

const here = dirname(fileURLToPath(import.meta.url));
const packsDir = join(here, '..', 'packs');
const crestDir = join(packsDir, 'crests');
const assetsPath = join(packsDir, 'clubs-assets.json');

const UA = 'RoadToGloryGame/0.1 (private hobby project; contact via github)';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ALL = process.argv.includes('--all');

interface ClubAsset {
  clubId: string;
  title?: string;
  nameHe?: string;
  crest?: string;
  color?: string;
  tried?: boolean;
  retried?: boolean;
  /** Where the current file came from, so a bad source can be re-run later. */
  source?: string;
  qid?: string;
  crestFile?: string;
}

async function api(url: string): Promise<any | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (response.ok) return await response.json();
      if (response.status === 429 || response.status >= 500) {
        await sleep(900 * (attempt + 1));
        continue;
      }
    } catch {
      await sleep(700 * (attempt + 1));
    }
    return null;
  }
  return null;
}

/** The Wikidata item behind a Wikipedia article, which is the most reliable link. */
async function itemFromWikipedia(lang: string, title: string): Promise<string | null> {
  const url =
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2` +
    `&prop=pageprops&ppprop=wikibase_item&redirects=1&titles=${encodeURIComponent(title)}`;
  const data = await api(url);
  const page = data?.query?.pages?.[0];
  if (!page || page.missing) return null;
  return page.pageprops?.wikibase_item ?? null;
}

async function searchItems(query: string, lang: string): Promise<string[]> {
  const url =
    'https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&formatversion=2' +
    `&type=item&limit=7&language=${lang}&uselang=${lang}&search=${encodeURIComponent(query)}`;
  const data = await api(url);
  const hits: { id: string }[] = data?.search ?? [];
  return hits.map((hit) => hit.id);
}

async function entities(ids: string[]): Promise<Record<string, any>> {
  if (ids.length === 0) return {};
  const url =
    'https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&formatversion=2' +
    `&props=claims|labels|descriptions&languages=en|he&ids=${ids.slice(0, 7).join('|')}`;
  const data = await api(url);
  return data?.entities ?? {};
}

function claimIds(entity: any, prop: string): string[] {
  const claims: any[] = entity?.claims?.[prop] ?? [];
  return claims
    .map((claim) => claim?.mainsnak?.datavalue?.value?.id)
    .filter((id): id is string => typeof id === 'string');
}

const CLUB_TYPES = new Set([
  'Q476028', // association football club
  'Q15944511', // association football team
  'Q14752149', // football club
  'Q17505285', // women's association football club
]);

/**
 * Only accept an item we can prove is a football club, otherwise we end up with the
 * badge of a basketball side or a whole sports society.
 */
function isFootballClub(entity: any): boolean {
  if (claimIds(entity, 'P641').includes('Q2736')) return true;
  if (claimIds(entity, 'P31').some((id) => CLUB_TYPES.has(id))) return true;
  const description: string = entity?.descriptions?.en?.value ?? '';
  return /association football|football club|soccer club/i.test(description);
}

/** The badge file, and nothing else: no P18 fallback, that is what gave us photos. */
function logoFile(entity: any): string | null {
  const value = entity?.claims?.P154?.[0]?.mainsnak?.datavalue?.value;
  return typeof value === 'string' ? value : null;
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b(fc|afc|cf|sc|ac|as|ss|us|cd|ud|sv|vfl|vfb|fk|bk|if|club|de|futbol|football|calcio)\b/g, ' ')
    .replace(/[^a-z֐-׿ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cheap token overlap so "Real Sociedad B" does not match "Real Sociedad". */
function similarity(a: string, b: string): number {
  const left = new Set(normalise(a).split(' ').filter(Boolean));
  const right = new Set(normalise(b).split(' ').filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared++;
  return shared / Math.max(left.size, right.size);
}

async function bestItem(club: { name: string; nameHe?: string }): Promise<{ qid: string; file: string } | null> {
  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const title of [`${club.name} F.C.`, club.name]) {
    const qid = await itemFromWikipedia('en', title);
    if (qid && !seen.has(qid)) { seen.add(qid); candidates.push(qid); }
  }
  if (club.nameHe) {
    for (const title of [`${club.nameHe} (כדורגל)`, club.nameHe]) {
      const qid = await itemFromWikipedia('he', title);
      if (qid && !seen.has(qid)) { seen.add(qid); candidates.push(qid); }
    }
  }
  for (const query of [club.name, `${club.name} football club`]) {
    for (const qid of await searchItems(query, 'en')) {
      if (!seen.has(qid)) { seen.add(qid); candidates.push(qid); }
    }
    if (candidates.length >= 6) break;
  }

  const items = await entities(candidates);
  let best: { qid: string; file: string; score: number } | null = null;
  for (const qid of candidates) {
    const entity = items[qid];
    if (!entity) continue;
    const file = logoFile(entity);
    if (!file) continue;
    const label: string = entity?.labels?.en?.value ?? entity?.labels?.he?.value ?? '';
    const score =
      (isFootballClub(entity) ? 1 : 0) +
      similarity(label || club.name, club.name) +
      (club.nameHe && entity?.labels?.he?.value ? similarity(entity.labels.he.value, club.nameHe) : 0);
    if (score < 0.6) continue;
    if (!best || score > best.score) best = { qid, file, score };
  }
  return best ? { qid: best.qid, file: best.file } : null;
}

async function main(): Promise<void> {
  const pack = JSON.parse(await readFile(join(packsDir, 'pack.json'), 'utf8')) as DataPack;
  await mkdir(crestDir, { recursive: true });
  const index: Record<string, ClubAsset> = JSON.parse(await readFile(assetsPath, 'utf8'));

  const todo = pack.clubs.filter((club) => {
    const record = index[club.id];
    if (ALL) return true;
    if (record?.source === 'wikidata:P154' && record.crest && existsSync(join(crestDir, record.crest))) return false;
    return true;
  });
  console.log(`${todo.length} clubs to source from Wikidata`);

  let found = 0;
  let done = 0;

  for (const club of todo) {
    const record: ClubAsset = index[club.id] ?? { clubId: club.id };
    const hit = await bestItem({ name: club.name, nameHe: club.nameHe ?? record.nameHe });

    if (hit) {
      const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(hit.file)}?width=256`;
      try {
        const image = await fetch(url, { headers: { 'User-Agent': UA } });
        if (image.ok) {
          const bytes = Buffer.from(await image.arrayBuffer());
          // Special:FilePath renders SVG to PNG at the requested width. Anything that
          // is not a PNG would break the colour reader and the app's <img>.
          const isPng = bytes.length > 8 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
          if (isPng) {
            const name = `${club.id}.png`;
            await writeFile(join(crestDir, name), bytes);
            record.crest = name;
            record.source = 'wikidata:P154';
            record.qid = hit.qid;
            record.crestFile = hit.file;
            const color = dominantColor(bytes);
            if (color) record.color = color;
            found++;
          }
        }
      } catch {
        // Leave whatever was there; the app draws a monogram if there is nothing.
      }
    }

    index[club.id] = record;
    done++;
    if (done % 10 === 0) {
      console.log(`  ${done}/${todo.length} (verified ${found})`);
      await writeFile(assetsPath, JSON.stringify(index, null, 2), 'utf8');
    }
    await sleep(90);
  }

  await writeFile(assetsPath, JSON.stringify(index, null, 2), 'utf8');
  const verified = Object.values(index).filter((r) => r.source === 'wikidata:P154').length;
  const total = Object.values(index).filter((r) => r.crest).length;
  console.log(`\nwikidata pass verified ${found} this run; ${verified} verified badges, ${total} clubs with any crest`);
}

void main();
