/**
 * Pulls a small set of freely licensed football photographs from Wikimedia Commons
 * to use as screen backgrounds, so the game looks like a stadium at night rather
 * than a settings page. Everything downloaded is CC or public domain; the licence
 * for each file is written next to it in credits.json.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', '..', 'app', 'public', 'bg');

const UA = 'FootballCareerGame/0.1 (private hobby project; contact: local)';

interface Slot {
  id: string;
  query: string;
  /** Prefer files whose title contains one of these words. */
  prefer?: string[];
}

const SLOTS: Slot[] = [
  { id: 'stadium-night', query: 'football stadium night floodlights', prefer: ['night', 'floodlight'] },
  { id: 'pitch', query: 'football pitch grass close up', prefer: ['grass', 'pitch', 'turf'] },
  { id: 'crowd', query: 'football supporters stand crowd', prefer: ['fans', 'supporters', 'crowd', 'tifo'] },
  { id: 'trophy', query: 'football trophy celebration', prefer: ['trophy', 'cup', 'celebration'] },
  { id: 'training', query: 'football training session cones', prefer: ['training', 'practice'] },
  { id: 'tunnel', query: 'football stadium tunnel players', prefer: ['tunnel', 'entrance'] },
  { id: 'youth', query: 'youth football academy training pitch', prefer: ['youth', 'academy', 'junior'] },
];

interface CommonsImage {
  title: string;
  url: string;
  license: string;
  artist: string;
  descriptionUrl: string;
  width: number;
}

function stripHtml(value: string | undefined): string {
  if (!value) return '';
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

async function searchCommons(query: string): Promise<CommonsImage[]> {
  const url =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
    '&generator=search&gsrnamespace=6&gsrlimit=25' +
    `&gsrsearch=${encodeURIComponent(query)}` +
    '&prop=imageinfo&iiprop=url%7Cextmetadata%7Cdimensions&iiurlwidth=1400';

  const response = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!response.ok) {
    console.log('    api http ' + response.status);
    return [];
  }
  const data = (await response.json()) as {
    query?: {
      pages?: Record<string, {
        title: string;
        imageinfo?: {
          thumburl?: string;
          url: string;
          descriptionurl: string;
          width: number;
          extmetadata?: Record<string, { value: string }>;
        }[];
      }>;
    };
  };

  const problem = (data as { error?: { info?: string } }).error;
  if (problem) console.log('    api error: ' + problem.info);
  const pages = Object.values(data.query?.pages ?? {});
  if (pages.length === 0) console.log('    no pages for: ' + query);
  const out: CommonsImage[] = [];
  const rejected: string[] = [];
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const meta = info.extmetadata ?? {};
    const license = stripHtml(meta['LicenseShortName']?.value) || 'unknown';
    // Only take licences that allow reuse.
    if (!/^(cc|public domain|pd|no restrictions|attribution)/i.test(license)) {
      rejected.push(license);
      continue;
    }
    out.push({
      title: page.title,
      url: info.thumburl ?? info.url,
      license,
      artist: stripHtml(meta['Artist']?.value),
      descriptionUrl: info.descriptionurl,
      width: info.width,
    });
  }
  if (out.length === 0 && rejected.length > 0) {
    console.log('    all candidates rejected by licence: ' + [...new Set(rejected)].slice(0, 4).join(', '));
  }
  return out;
}

async function main(): Promise<void> {
  await mkdir(outDir, { recursive: true });
  const credits: Record<string, { title: string; license: string; artist: string; source: string }> = {};

  for (const slot of SLOTS) {
    const results = await searchCommons(slot.query);
    if (results.length === 0) {
      console.log(`  ${slot.id}: nothing usable found`);
      continue;
    }

    // Prefer landscape files whose name matches the mood we asked for.
    const scored = results
      .map((image) => {
        const lower = image.title.toLowerCase();
        const hint = (slot.prefer ?? []).some((word) => lower.includes(word)) ? 2 : 0;
        const size = image.width >= 1400 ? 1 : 0;
        return { image, score: hint + size };
      })
      .sort((a, b) => b.score - a.score);

    const chosen = scored[0]!.image;
    const response = await fetch(chosen.url, { headers: { 'User-Agent': UA } });
    if (!response.ok) {
      console.log(`  ${slot.id}: download failed (${response.status})`);
      continue;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const ext = chosen.url.toLowerCase().includes('.png') ? 'png' : 'jpg';
    await writeFile(join(outDir, `${slot.id}.${ext}`), bytes);
    credits[slot.id] = {
      title: chosen.title,
      license: chosen.license,
      artist: chosen.artist,
      source: chosen.descriptionUrl,
    };
    console.log(`  ${slot.id}: ${chosen.title} (${chosen.license}) ${(bytes.length / 1024).toFixed(0)}KB`);
  }

  await writeFile(join(outDir, 'credits.json'), JSON.stringify(credits, null, 2), 'utf8');
  console.log(`\n${Object.keys(credits).length} backgrounds -> ${outDir}`);
}

void main();
