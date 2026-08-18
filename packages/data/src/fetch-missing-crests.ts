/**
 * Second pass for clubs the first sweep could not find a crest for.
 *
 * The generic search often lands on a basketball team, a multi-sport club page or a
 * disambiguation page - none of which carry a football crest. This pass tries the
 * exact "F.C." title, then the club's Hebrew article, which for Israeli clubs is the
 * one that actually has the badge on it.
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

const UA = 'RoadToGloryGame/0.1 (private hobby project)';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface ClubAsset {
  clubId: string;
  title?: string;
  nameHe?: string;
  crest?: string;
  color?: string;
  tried?: boolean;
  retried?: boolean;
}

async function api(url: string): Promise<any | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (response.ok) return response.json();
    if (response.status === 429 || response.status >= 500) {
      await sleep(900 * (attempt + 1));
      continue;
    }
    return null;
  }
  return null;
}

async function summaryImage(lang: string, title: string): Promise<string | null> {
  const data = await api(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
  if (!data || data.type === 'disambiguation' || data.title === 'Not found.') return null;
  const source: string | undefined = data.thumbnail?.source ?? data.originalimage?.source;
  return source ? source.split('?')[0]! : null;
}

/** Search, but only accept titles that look like a football club article. */
async function footballTitle(lang: string, query: string): Promise<string | null> {
  const url =
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2` +
    `&list=search&srlimit=5&srsearch=${encodeURIComponent(query)}`;
  const data = await api(url);
  const hits: { title: string }[] = data?.query?.search ?? [];
  const football = hits.find((hit) => /F\.?C\.?|FC|football|כדורגל/i.test(hit.title));
  return (football ?? hits[0])?.title ?? null;
}

async function main(): Promise<void> {
  const pack = JSON.parse(await readFile(join(packsDir, 'pack.json'), 'utf8')) as DataPack;
  await mkdir(crestDir, { recursive: true });
  const index: Record<string, ClubAsset> = JSON.parse(await readFile(assetsPath, 'utf8'));

  const todo = pack.clubs.filter((club) => {
    const record = index[club.id];
    return !record?.crest || !existsSync(join(crestDir, record.crest));
  });
  console.log(`${todo.length} clubs still without a crest`);

  let found = 0;
  let done = 0;

  for (const club of todo) {
    const record: ClubAsset = index[club.id] ?? { clubId: club.id };
    record.retried = true;
    const hebrew = record.nameHe ?? club.nameHe;

    const attempts: { lang: string; title: string }[] = [
      { lang: 'en', title: `${club.name} F.C.` },
      { lang: 'en', title: club.name },
    ];
    if (hebrew) {
      // Hebrew Wikipedia disambiguates the football club from the sports club with
      // a "(כדורגל)" suffix, and it is the football article that carries the badge.
      attempts.unshift({ lang: 'he', title: hebrew });
      attempts.unshift({ lang: 'he', title: `${hebrew} (כדורגל)` });
    }

    let url: string | null = null;
    for (const attempt of attempts) {
      url = await summaryImage(attempt.lang, attempt.title);
      if (url) break;
    }

    if (!url) {
      // Last resort: search each wiki for something that looks like a club article.
      for (const lang of ['he', 'en']) {
        const title = await footballTitle(lang, `${lang === 'he' && hebrew ? hebrew : club.name} כדורגל`);
        if (!title) continue;
        url = await summaryImage(lang, title);
        if (url) break;
      }
    }

    if (url) {
      try {
        const image = await fetch(url, { headers: { 'User-Agent': UA } });
        if (image.ok) {
          const bytes = Buffer.from(await image.arrayBuffer());
          const file = `${club.id}.png`;
          await writeFile(join(crestDir, file), bytes);
          record.crest = file;
          const color = dominantColor(bytes);
          if (color) record.color = color;
          found++;
        }
      } catch {
        // Leave it without a crest; the app draws a monogram instead.
      }
    }

    index[club.id] = record;
    done++;
    if (done % 15 === 0) {
      console.log(`  ${done}/${todo.length} (found ${found})`);
      await writeFile(assetsPath, JSON.stringify(index, null, 2), 'utf8');
    }
    await sleep(140);
  }

  await writeFile(assetsPath, JSON.stringify(index, null, 2), 'utf8');
  const total = Object.values(index).filter((r) => r.crest).length;
  console.log(`\nsecond pass found ${found} more, ${total} clubs now have a crest`);
}

void main();
