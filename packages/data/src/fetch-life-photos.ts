/**
 * Photographs for the things a footballer buys.
 *
 * Same rules as the backgrounds: freely licensed files from Wikimedia Commons, nothing
 * else, and the licence for every file written next to it in credits.json. A car and a
 * house are the two things in this game a player will actually recognise, so they are
 * photographs rather than drawings - but only ones we are allowed to ship.
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', '..', 'app', 'public', 'life');

const UA = 'FootballCareerGame/0.1 (private hobby project; contact: local)';

interface Slot {
  /** The life item this photograph belongs to. */
  id: string;
  query: string;
  prefer?: string[];
}

/**
 * One query per item. They are deliberately generic - a category of car rather than a
 * make - because the point is what he bought, not whose logo is on it.
 */
const SLOTS: Slot[] = [
  { id: 'firstCar', query: 'small hatchback car parked street', prefer: ['hatchback', 'compact'] },
  { id: 'familyEstate', query: 'estate car station wagon', prefer: ['estate', 'wagon', 'kombi'] },
  { id: 'germanSaloon', query: 'Mercedes-Benz E-Class sedan car', prefer: ['sedan', 'saloon', 'mercedes', 'bmw', 'audi'] },
  { id: 'electricGT', query: 'Tesla Model S car', prefer: ['tesla', 'taycan', 'electric'] },
  { id: 'supercar', query: 'supercar sports car red', prefer: ['supercar', 'sports'] },
  { id: 'grandTourer', query: 'Aston Martin coupe car', prefer: ['aston', 'bentley', 'maserati', 'coupe'] },

  { id: 'flat', query: 'modern apartment building city', prefer: ['apartment', 'flat'] },
  { id: 'townhouse', query: 'townhouse row houses street', prefer: ['townhouse', 'terrace'] },
  { id: 'quietHouse', query: 'countryside house garden trees', prefer: ['countryside', 'rural', 'garden'] },
  { id: 'poolVilla', query: 'villa house swimming pool garden', prefer: ['villa'] },
  { id: 'penthouse', query: 'penthouse apartment terrace', prefer: ['penthouse'] },
  { id: 'seafrontMansion', query: 'mansion house estate', prefer: ['mansion'] },

  { id: 'sailingYacht', query: 'sailing yacht moored marina', prefer: ['sailing yacht', 'sailboat', 'yacht'] },
  { id: 'motorYacht', query: 'superyacht harbour', prefer: ['superyacht', 'motor yacht'] },
  { id: 'lightJet', query: 'Cessna Citation business jet', prefer: ['citation', 'learjet', 'business jet'] },
  { id: 'longRangeJet', query: 'Gulfstream business jet aircraft', prefer: ['gulfstream', 'bombardier global', 'falcon'] },

  { id: 'homeGym', query: 'weight training gym interior', prefer: ['gym', 'weight', 'fitness', 'training'] },
  { id: 'charity', query: 'children playing football', prefer: ['children', 'kids', 'boys', 'playing'] },
  { id: 'watchCollection', query: 'luxury wristwatch collection', prefer: ['watch', 'chronograph'] },
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

/** Commons asks for one request at a time and means it. */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

async function politeFetch(url: string): Promise<Response | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url, { headers: { 'User-Agent': UA } });
    if (response.status !== 429) return response;
    const backoff = 5_000 * (attempt + 1);
    console.log(`    rate limited, waiting ${backoff / 1000}s`);
    await wait(backoff);
  }
  return null;
}

async function searchCommons(query: string): Promise<CommonsImage[]> {
  const url =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
    '&generator=search&gsrnamespace=6&gsrlimit=25' +
    `&gsrsearch=${encodeURIComponent(query)}` +
    '&prop=imageinfo&iiprop=url%7Cextmetadata%7Cdimensions&iiurlwidth=900';

  const response = await politeFetch(url);
  if (!response || !response.ok) {
    console.log('    api http ' + (response?.status ?? 'no response'));
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

  const out: CommonsImage[] = [];
  const rejected: string[] = [];
  for (const page of Object.values(data.query?.pages ?? {})) {
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const meta = info.extmetadata ?? {};
    if (!/\.(jpe?g|png)$/i.test(page.title)) continue;
    const license = stripHtml(meta['LicenseShortName']?.value) || 'unknown';
    // Only licences that allow reuse, exactly as the backgrounds do.
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

type Credit = { title: string; license: string; artist: string; source: string };

async function main(): Promise<void> {
  await mkdir(outDir, { recursive: true });
  // Attribution for a file we already have must survive a run that only fills gaps.
  // Rewriting the credits from scratch each time stripped the licence off every
  // photograph the run happened to skip, which is the one thing we may not do.
  const credits: Record<string, Credit> = await readFile(join(outDir, 'credits.json'), 'utf8')
    .then((raw) => JSON.parse(raw) as Record<string, Credit>)
    .catch(() => ({}));

  // A re-run fills the gaps rather than starting again: Commons throttles hard, and
  // what has already been downloaded is already good.
  const existing = new Set(
    (await readdir(outDir).catch(() => [] as string[])).map((file) => file.replace(/\.(jpe?g|png)$/i, '')),
  );

  for (const slot of SLOTS) {
    if (existing.has(slot.id)) {
      console.log(`  ${slot.id}: already have one`);
      continue;
    }
    await wait(2_500);
    const results = await searchCommons(slot.query);
    if (results.length === 0) {
      console.log(`  ${slot.id}: nothing usable found`);
      continue;
    }

    /*
     * What the file is actually of.
     *
     * A search for "villa with swimming pool" will happily return a municipal pool in
     * Hong Kong, which is not what he just spent four hundred thousand on. A file has
     * to look like the thing on its own title before it is taken, and only when nothing
     * matches at all do we fall back to the best of the rest.
     */
    const scored = results
      .map((image) => {
        const lower = image.title.toLowerCase();
        const hits = (slot.prefer ?? []).filter((word) => lower.includes(word)).length;
        const size = image.width >= 900 ? 1 : 0;
        return { image, score: hits * 3 + size, hits };
      })
      .sort((a, b) => b.score - a.score);

    const matching = scored.filter((entry) => entry.hits > 0);
    if (matching.length === 0) {
      // Better an item with no photograph than an item with the wrong one.
      console.log(`  ${slot.id}: nothing on Commons matched by name, left without a photograph`);
      continue;
    }
    const chosen = matching[0]!.image;
    await wait(900);
    const response = await politeFetch(chosen.url);
    if (!response || !response.ok) {
      console.log(`  ${slot.id}: download failed (${response?.status ?? 'no response'})`);
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
  console.log(`\n${Object.keys(credits).length} photographs -> ${outDir}`);
}

void main();
