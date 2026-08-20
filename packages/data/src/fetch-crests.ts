/**
 * The crest pipeline, with a real source behind it.
 *
 * The first sweeps took whatever lead image a Wikipedia article happened to have,
 * which for a lot of clubs is a stadium, a squad photo or the badge of the parent
 * multi-sport club - and Wikidata's P154 is empty for most big clubs, because their
 * badges are non-free and never reach Commons.
 *
 * So the primary source here is TheSportsDB, a football database that keys a badge
 * to a team, a sport and a country: exactly the three things we need to be sure the
 * file belongs to this club and not to a basketball side with the same name. If it
 * has nothing, we fall back to the club's own Wikipedia article and take the file
 * that is actually named like a crest, not the article's lead photo.
 *
 *   tsx src/fetch-crests.ts          # only clubs without a verified badge
 *   tsx src/fetch-crests.ts --all    # re-source every club
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
const ALL = process.argv.includes('--all');
/** The free, documented test key. Fine for a few hundred lookups. */
const SPORTSDB = 'https://www.thesportsdb.com/api/v1/json/3';

/**
 * Our three-letter codes to the country names TheSportsDB uses. Some countries are
 * spelled more than one way in that database ("Netherlands" and "The Netherlands"),
 * and a country mismatch is what rejects an otherwise perfect match, so all the
 * spellings we have seen are listed.
 */
const COUNTRY_ALTS: Record<string, string[]> = {
  NED: ['Netherlands', 'The Netherlands', 'Holland'],
  ENG: ['England'],
  TUR: ['Turkey', 'Türkiye'],
  GRE: ['Greece'],
  GER: ['Germany'],
};

/** Clubs whose database name is nothing like ours; searching for it directly works. */
const SEARCH_ALIASES: Record<string, string> = {
  fra_stade_rennais_fc_1901: 'Rennes',
  fra_montpellier_hsc: 'Montpellier',
  ned_psv: 'PSV Eindhoven',
  ned_az: 'AZ Alkmaar',
  ned_sc_heerenveen: 'Heerenveen',
  eng_nottingham_forest_fc: 'Nottingham Forest',
  gre_ae_kifisias: 'Kifisia',
  isr_ironi_nesher: 'Hapoel Nesher',
  arg_estudiantes: 'Estudiantes de La Plata',
  arg_newells_old_boys: "Newell's Old Boys",
  usa_la_galaxy: 'LA Galaxy',
  arg_san_lorenzo: 'San Lorenzo de Almagro',
  bra_santos: 'Santos FC',
  bra_ceara: 'Ceara SC',
  bra_sport_recife: 'Sport Recife',
  bra_vitoria: 'EC Vitoria',
};

const COUNTRY: Record<string, string> = {
  ENG: 'England', SCO: 'Scotland', WAL: 'Wales', IRL: 'Ireland',
  ESP: 'Spain', ITA: 'Italy', GER: 'Germany', FRA: 'France', POR: 'Portugal',
  NED: 'Netherlands', BEL: 'Belgium', AUT: 'Austria', SUI: 'Switzerland',
  TUR: 'Turkey', GRE: 'Greece', ISR: 'Israel', DEN: 'Denmark', SWE: 'Sweden',
  NOR: 'Norway', POL: 'Poland', CZE: 'Czechia', RUS: 'Russia', UKR: 'Ukraine',
  USA: 'United States', BRA: 'Brazil', ARG: 'Argentina', MEX: 'Mexico',
};

interface ClubAsset {
  clubId: string;
  title?: string;
  nameHe?: string;
  crest?: string;
  color?: string;
  tried?: boolean;
  retried?: boolean;
  /** Where the file on disk came from, so a bad source can be re-run later. */
  source?: string;
  sourceRef?: string;
}

/**
 * The free database key is rate limited, and hitting the limit costs far more time
 * in backoff than pacing ourselves does. One request a second, steadily.
 */
let nextSlot = 0;
async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + 950;
  if (wait > 0) await sleep(wait);
}

async function json(url: string): Promise<any | null> {
  if (url.startsWith(SPORTSDB)) await throttle();
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
      if (response.ok) return await response.json();
      if (response.status === 429 || response.status >= 500) {
        // Give the window time to roll over rather than hammering it again.
        nextSlot = Date.now() + 4000;
        await sleep(4000);
        continue;
      }
    } catch {
      await sleep(800 * (attempt + 1));
    }
    return null;
  }
  return null;
}

/** Strip the noise clubs carry in their names so two spellings can be compared. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(fc|afc|cf|sc|ac|as|ss|us|ud|cd|sv|tsv|vfl|vfb|fk|bk|if|sk|rc|club|de|futbol|football|calcio|kv|kaa|kfc|ssc|acf|asd|nk|hk)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarity(a: string, b: string): number {
  const left = new Set(normalise(a).split(' ').filter(Boolean));
  const right = new Set(normalise(b).split(' ').filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared++;
  return shared / Math.max(left.size, right.size);
}

interface Found { url: string; source: string; ref: string }

/** Primary source: a football database that knows the sport and the country. */
async function fromSportsDb(club: { id?: string; name: string; shortName?: string; country: string }): Promise<Found | null> {
  const wanted = COUNTRY[club.country];
  const accepted = new Set([...(COUNTRY_ALTS[club.country] ?? []), ...(wanted ? [wanted] : [])]);
  const alias = club.id ? SEARCH_ALIASES[club.id] : undefined;
  const queries = [alias, club.name, club.shortName].filter((q): q is string => Boolean(q));

  for (const query of queries) {
    const data = await json(`${SPORTSDB}/searchteams.php?t=${encodeURIComponent(query)}`);
    const teams: any[] = data?.teams ?? [];
    let best: { badge: string; id: string; score: number } | null = null;

    for (const team of teams) {
      if (team.strSport !== 'Soccer') continue;
      const badge: string | undefined = team.strBadge ?? team.strTeamBadge;
      if (!badge) continue;
      const name = similarity(team.strTeam ?? '', club.name);
      const alt = Math.max(
        name,
        similarity(team.strTeamAlternate ?? '', club.name),
        similarity(team.strTeamShort ?? '', club.shortName ?? club.name),
      );
      // A country match is what stops "Boavista" landing on the Brazilian side.
      const countryOk = accepted.size === 0 || accepted.has(team.strCountry);
      const countryScore = countryOk ? 1 : -0.6;
      // An alias is a deliberate hand-match, so the name does not have to look alike.
      const nameScore = alias && query === alias ? Math.max(alt, 0.8) : alt;
      const score = nameScore + countryScore;
      if (nameScore < 0.5) continue;
      if (!best || score > best.score) best = { badge, id: team.idTeam, score };
    }

    if (best && best.score >= 0.6) {
      return { url: best.badge, source: 'thesportsdb', ref: best.id };
    }
  }
  return null;
}

/**
 * Fallback: the club's own Wikipedia article, but only files that are named like a
 * badge. The lead image is deliberately not used - that is what produced stadiums.
 */
async function fromWikipedia(club: { name: string; nameHe?: string }): Promise<Found | null> {
  const attempts: { lang: string; title: string }[] = [
    { lang: 'en', title: `${club.name} F.C.` },
    { lang: 'en', title: club.name },
  ];
  if (club.nameHe) {
    attempts.unshift({ lang: 'he', title: `${club.nameHe} (כדורגל)` });
    attempts.push({ lang: 'he', title: club.nameHe });
  }

  for (const attempt of attempts) {
    const listUrl =
      `https://${attempt.lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2` +
      `&prop=images&imlimit=60&redirects=1&titles=${encodeURIComponent(attempt.title)}`;
    const data = await json(listUrl);
    const page = data?.query?.pages?.[0];
    if (!page || page.missing) continue;
    const images: { title: string }[] = page.images ?? [];

    const scored = images
      .filter((img) => /\.(png|svg|jpg|jpeg)$/i.test(img.title))
      // "wikt" is not "wiki": Wiktionary's own logo walked straight through this filter
      // and ended up on three clubs' shirts.
      .filter((img) => !/commons-logo|wik(i|t|imedia|idata)|icon|flag|edit-|question|padlock|ambox|sound/i.test(img.title))
      .map((img) => {
        const name = img.title.replace(/^File:/i, '');
        const badgeWord = /(crest|logo|badge|emblem|sigla|escudo|stemma|wappen|סמל)/i.test(name) ? 1 : 0;
        return { name, score: badgeWord + similarity(name, club.name) };
      })
      .filter((img) => img.score >= 0.6)
      .sort((a, b) => b.score - a.score);

    for (const candidate of scored.slice(0, 2)) {
      const infoUrl =
        `https://${attempt.lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2` +
        `&prop=imageinfo&iiprop=url&iiurlwidth=256&titles=${encodeURIComponent('File:' + candidate.name)}`;
      const info = await json(infoUrl);
      const image = info?.query?.pages?.[0]?.imageinfo?.[0];
      const url: string | undefined = image?.thumburl ?? image?.url;
      if (url) return { url, source: `wikipedia:${attempt.lang}`, ref: candidate.name };
    }
  }
  // Last resort: the article's lead image, but only when the file is *named* like a
  // badge. Nottingham Forest's crest lives there and nowhere else we can reach, while
  // a stadium photo is called something else entirely, so the name is the filter.
  for (const attempt of attempts) {
    const data = await json(
      `https://${attempt.lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(attempt.title)}`,
    );
    if (!data || data.type === 'disambiguation') continue;
    const source: string | undefined = data.originalimage?.source ?? data.thumbnail?.source;
    if (!source) continue;
    const file = decodeURIComponent(source.split('?')[0]!.split('/').pop() ?? '');
    // "Wiktionary-logo-en-v2.svg" contains the word logo and is not anybody's crest:
    // three clubs ended up wearing it before this line existed.
    if (/(wiktionary|wikipedia|wikimedia|wikidata|commons)/i.test(file)) continue;
    if (!/(logo|crest|badge|emblem|escudo|stemma|wappen)/i.test(file)) continue;
    // Ask for a bigger render than the 330px thumbnail the summary hands back.
    return { url: source.split('?')[0]!.replace(/\/\d+px-/, '/256px-'), source: `wikipedia:${attempt.lang}`, ref: file };
  }

  return null;
}

/** Badges are square-ish; a wide file is a photo or a banner, not a crest. */
function looksLikeCrest(bytes: Buffer): boolean {
  if (bytes.length < 24 || bytes.readUInt32BE(0) !== 0x89504e47) return false;
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width < 40 || height < 40) return false;
  const ratio = width / height;
  // Most badges are square-ish, but plenty of clubs use a wordmark that is wider than
  // it is tall. A photograph is wider still, so the line sits at 2.2.
  return ratio > 0.45 && ratio < 2.2;
}

async function main(): Promise<void> {
  const pack = JSON.parse(await readFile(join(packsDir, 'pack.json'), 'utf8')) as DataPack;
  await mkdir(crestDir, { recursive: true });
  const index: Record<string, ClubAsset> = JSON.parse(await readFile(assetsPath, 'utf8'));

  const todo = pack.clubs.filter((club) => {
    const record = index[club.id];
    if (ALL) return true;
    const verified = record?.source === 'thesportsdb' || record?.source?.startsWith('wikipedia:');
    return !(verified && record?.crest && existsSync(join(crestDir, record.crest)));
  });
  console.log(`${todo.length} clubs to source`);

  let found = 0;
  let done = 0;
  const misses: string[] = [];

  for (const club of todo) {
    const record: ClubAsset = index[club.id] ?? { clubId: club.id };
    const hit =
      (await fromSportsDb({ id: club.id, name: club.name, shortName: club.shortName, country: club.country })) ??
      (await fromWikipedia({ name: club.name, nameHe: club.nameHe ?? record.nameHe }));

    if (hit) {
      try {
        const image = await fetch(hit.url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
        if (image.ok) {
          const bytes = Buffer.from(await image.arrayBuffer());
          if (looksLikeCrest(bytes)) {
            const name = `${club.id}.png`;
            await writeFile(join(crestDir, name), bytes);
            record.crest = name;
            record.source = hit.source;
            record.sourceRef = hit.ref;
            const color = dominantColor(bytes);
            if (color) record.color = color;
            found++;
          } else {
            misses.push(`${club.id} (rejected shape from ${hit.source})`);
          }
        }
      } catch {
        misses.push(`${club.id} (download failed)`);
      }
    } else {
      misses.push(club.id);
    }

    index[club.id] = record;
    done++;
    if (done % 10 === 0) {
      console.log(`  ${done}/${todo.length} (sourced ${found})`);
      await writeFile(assetsPath, JSON.stringify(index, null, 2), 'utf8');
    }
  }

  await writeFile(assetsPath, JSON.stringify(index, null, 2), 'utf8');
  const verified = Object.values(index).filter((r) => r.source === 'thesportsdb' || r.source?.startsWith('wikipedia:')).length;
  const total = Object.values(index).filter((r) => r.crest).length;
  console.log(`\nsourced ${found} this run; ${verified} verified badges, ${total} clubs with any crest`);
  if (misses.length) console.log(`still missing (${misses.length}):\n  ${misses.join('\n  ')}`);
}

void main();
