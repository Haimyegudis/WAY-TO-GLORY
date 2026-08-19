/**
 * The last few badges, by hand.
 *
 * A handful of clubs are not in the football database under any name we can guess
 * (Nottingham Forest is filed there as a netball team) or only exist on the Hebrew
 * Wikipedia. Rather than make the automatic sweep ever cleverer, their sources are
 * written down here once and fetched directly.
 *
 *   tsx src/fetch-crests-manual.ts
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dominantColor } from './png-color.js';

const here = dirname(fileURLToPath(import.meta.url));
const packsDir = join(here, '..', 'packs');
const crestDir = join(packsDir, 'crests');
const assetsPath = join(packsDir, 'clubs-assets.json');
const UA = 'RoadToGloryGame/0.1 (private hobby project)';

/** Club id to a direct image URL, or to a Wikipedia article whose lead image is the badge. */
const MANUAL: Record<string, { url?: string; wiki?: { lang: string; title: string } }> = {
  eng_nottingham_forest_fc: { wiki: { lang: 'en', title: 'Nottingham Forest F.C.' } },
  gre_aris_saloniki: { wiki: { lang: 'en', title: 'Aris Thessaloniki F.C.' } },
  isr_maccabi_bnei_raina: { wiki: { lang: 'he', title: 'מכבי בני ריינה' } },
  isr_beitar_kfar_saba: { wiki: { lang: 'he', title: 'בית"ר כפר סבא' } },
  isr_hapoel_herzliya: { wiki: { lang: 'he', title: 'הפועל הרצליה' } },
  isr_maccabi_ironi_amishav: { wiki: { lang: 'he', title: 'מכבי עירוני עמישב' } },
  isr_hapoel_ironi_arad: { wiki: { lang: 'he', title: 'הפועל עירוני ערד' } },
};

/** Files listed on the article, when the summary has no usable lead image. */
async function namedImage(lang: string, title: string): Promise<string | null> {
  const listUrl =
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2` +
    `&prop=images&imlimit=60&redirects=1&titles=${encodeURIComponent(title)}`;
  const response = await fetch(listUrl, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return null;
  const data: any = await response.json();
  const page = data?.query?.pages?.[0];
  if (!page || page.missing) return null;

  const candidates: { title: string }[] = page.images ?? [];
  const badge = candidates.find((image) =>
    /(logo|crest|badge|emblem|סמל|לוגו)/i.test(image.title) && !/commons-logo/i.test(image.title),
  );
  if (!badge) return null;

  const infoUrl =
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2` +
    `&prop=imageinfo&iiprop=url&iiurlwidth=256&titles=${encodeURIComponent(badge.title)}`;
  const info = await fetch(infoUrl, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!info.ok) return null;
  const infoData: any = await info.json();
  const image = infoData?.query?.pages?.[0]?.imageinfo?.[0];
  return image?.thumburl ?? image?.url ?? null;
}

async function leadImage(lang: string, title: string): Promise<string | null> {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return null;
  const data: any = await response.json();
  if (data.type === 'disambiguation') return null;
  const source: string | undefined = data.originalimage?.source ?? data.thumbnail?.source;
  if (!source) return null;
  const clean = source.split('?')[0]!;
  const file = decodeURIComponent(clean.split('/').pop() ?? '');
  // Same rule as the sweep: the file has to be named like a badge, not a stadium.
  if (!/(logo|crest|badge|emblem|סמל|לוגו)/i.test(file)) return null;
  return clean;
}

async function main(): Promise<void> {
  const index: Record<string, any> = JSON.parse(await readFile(assetsPath, 'utf8'));
  let saved = 0;

  for (const [clubId, entry] of Object.entries(MANUAL)) {
    const url =
      entry.url ??
      (entry.wiki
        ? (await namedImage(entry.wiki.lang, entry.wiki.title)) ?? (await leadImage(entry.wiki.lang, entry.wiki.title))
        : null);
    if (!url) {
      console.log(`  ${clubId}: nothing found`);
      continue;
    }
    try {
      const image = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
      if (!image.ok) {
        console.log(`  ${clubId}: ${image.status}`);
        continue;
      }
      const bytes = Buffer.from(await image.arrayBuffer());
      const isPng = bytes.length > 8 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
      if (!isPng) {
        console.log(`  ${clubId}: not a png`);
        continue;
      }
      const file = `${clubId}.png`;
      await writeFile(join(crestDir, file), bytes);
      const record = index[clubId] ?? { clubId };
      record.crest = file;
      record.source = 'manual';
      record.sourceRef = url;
      const colour = dominantColor(bytes);
      if (colour) record.color = colour;
      index[clubId] = record;
      saved++;
      console.log(`  ${clubId}: ok`);
    } catch (error) {
      console.log(`  ${clubId}: ${(error as Error).message}`);
    }
  }

  await writeFile(assetsPath, JSON.stringify(index, null, 2), 'utf8');
  console.log(`\n${saved} badges written by hand`);
}

void main();
