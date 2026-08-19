/**
 * Real squads - the whole squad, the current squad - from Wikipedia and Wikidata.
 *
 * TheSportsDB's free key hands back a slice of each club: ten names, sometimes the
 * women's team, sometimes a player who signed somewhere else two summers ago. Wikidata
 * on its own is no better for this one job, because a "member of sports team" statement
 * is opened when a player signs and almost never closed when he leaves - ask it who
 * plays for Liverpool and it says three hundred and fifty men, including a boy who was
 * on the books in 2012 and the actor who plays Robb Stark.
 *
 * The fact we actually want is maintained by hand, every transfer window, on the club's
 * own Wikipedia article: the squad template, with shirt numbers, nationalities and
 * positions. So that is the squad. Wikidata is then asked about those specific men, for
 * what an infobox does not carry - date of birth, the position in detail, whether he has
 * played for his country, and how many language editions have written him up.
 *
 * That last one is the rating. Nobody publishes an ability score for free, so the honest
 * proxy is fame: a player written up in fifty languages is a name the world knows and a
 * player in three is a squad number. Fame moves him inside the level his club plays at,
 * a senior international gets a nudge, and age does the rest.
 *
 *   tsx src/fetch-squads-wikidata.ts            # clubs not read yet
 *   tsx src/fetch-squads-wikidata.ts --all      # every club again
 *   tsx src/fetch-squads-wikidata.ts --club eng_liverpool_fc
 *
 * Never run this alongside another sourcing script: they write the same pack files.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Club, DataPack, Position } from '@fc/engine';

const here = dirname(fileURLToPath(import.meta.url));
const packsDir = join(here, '..', 'packs');
const assetsPath = join(packsDir, 'clubs-assets.json');
const squadsPath = join(packsDir, 'real-players.json');

const UA = 'RoadToGloryGame/0.1 (private hobby project)';
const SPARQL = 'https://query.wikidata.org/sparql';
const WD_API = 'https://www.wikidata.org/w/api.php';
const WP_API = 'https://en.wikipedia.org/w/api.php';

const ALL = process.argv.includes('--all');
const ONLY = (() => {
  const i = process.argv.indexOf('--club');
  return i >= 0 ? process.argv[i + 1] ?? null : null;
})();

/** How many clubs are read before the batch is written and its players looked up. */
const BATCH = 6;
/** A squad is a squad: past this the world builder throws the rest away anyway. */
const MAX_SQUAD = 24;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let nextSlot = 0;
async function throttle(gap: number): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + gap;
  if (wait > 0) await sleep(wait);
}

async function getJson(url: string, gap: number, timeout = 30_000): Promise<any | null> {
  await throttle(gap);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(timeout),
      });
      if (response.ok) return await response.json();
      // These endpoints are shared, and they say so with a 429; a query that ran out of
      // time says 500.
      if (response.status === 429 || response.status >= 500) {
        await sleep(4000 * (attempt + 1));
        continue;
      }
      return null;
    } catch {
      await sleep(2500 * (attempt + 1));
    }
  }
  return null;
}

async function sparql(query: string): Promise<any[] | null> {
  const body = await getJson(`${SPARQL}?format=json&query=${encodeURIComponent(query)}`, 1200, 90_000);
  return body?.results?.bindings ?? null;
}

/* ------------------------------------------------------------------ the squad */

interface SquadEntry {
  /** The article the squad template links to: what Wikidata is then asked about. */
  article: string;
  /** What the club calls him, which is the name on the shirt. */
  display: string;
  nat: string | null;
  coarse: 'GK' | 'DF' | 'MF' | 'FW' | null;
  number: number | null;
}

/**
 * The current squad, out of the club's article.
 *
 * The template is `{{fs player|no=1|nat=BRA|pos=GK|name=[[Alisson]]}}`, one line a man,
 * and every club uses it. Only the first block is the squad: what follows under its own
 * heading is players out on loan, who are somebody else's problem this season.
 */
function parseSquad(wikitext: string): SquadEntry[] {
  const start = wikitext.search(/\{\{\s*[Ff]s start/);
  if (start < 0) return [];
  const end = wikitext.search(/\{\{\s*[Ff]s end\s*\}\}/);
  const block = wikitext.slice(start, end > start ? end : start + 12_000);

  const out: SquadEntry[] = [];
  const seen = new Set<string>();
  const pattern = /\{\{\s*[Ff]s player\s*\|([^{}]*(?:\{\{[^{}]*\}\}[^{}]*)*)\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(block)) !== null) {
    const fields: Record<string, string> = {};
    for (const part of match[1]!.split('|')) {
      const eq = part.indexOf('=');
      if (eq < 0) continue;
      fields[part.slice(0, eq).trim().toLowerCase()] = part.slice(eq + 1).trim();
    }
    const raw = fields['name'] ?? '';
    if (!raw) continue;

    // [[Alisson Becker|Alisson]] is one man written twice: the article to look him up
    // by, and the short form that goes on the shirt.
    const link = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/.exec(raw);
    const article = (link?.[1] ?? raw).replace(/''/g, '').trim();
    const display = (link?.[2] ?? link?.[1] ?? raw)
      .replace(/''|\[\[|\]\]/g, '')
      .replace(/\s*\(.*?\)\s*$/, '')
      .trim();
    if (!article || !display || seen.has(article)) continue;
    seen.add(article);

    const pos = (fields['pos'] ?? '').toUpperCase();
    out.push({
      article,
      display,
      nat: (fields['nat'] ?? '').toUpperCase().slice(0, 3) || null,
      coarse: pos === 'GK' || pos === 'DF' || pos === 'MF' || pos === 'FW' ? pos : null,
      number: Number(fields['no']) || null,
    });
  }
  return out;
}

async function squadFromWikipedia(title: string): Promise<SquadEntry[]> {
  const url =
    `${WP_API}?action=parse&page=${encodeURIComponent(title)}` +
    `&prop=wikitext&formatversion=2&format=json&redirects=1&origin=*`;
  const body = await getJson(url, 350);
  const wikitext: string | undefined = body?.parse?.wikitext;
  if (!wikitext || !/\{\{\s*Infobox football club/i.test(wikitext)) return [];
  return parseSquad(wikitext);
}

/* ------------------------------------------------------------------ the players */

/**
 * Wikidata writes a position as an item - "goalkeeper", "centre-back", "winger" - and the
 * engine thinks in slots. Read most exact first: "left-back" has to be caught before the
 * word "back" sends it to centre-back.
 */
const POSITIONS: [RegExp, Position][] = [
  [/goalkeeper|keeper/i, 'GK'],
  [/right wing.?back/i, 'RWB'],
  [/left wing.?back/i, 'LWB'],
  [/right.?back/i, 'RB'],
  [/left.?back/i, 'LB'],
  [/sweeper|centre.?back|center.?back|central defender/i, 'CB'],
  [/defensive midfield/i, 'CDM'],
  [/attacking midfield|playmaker/i, 'CAM'],
  [/right midfield/i, 'RM'],
  [/left midfield/i, 'LM'],
  [/central midfield|wing half|midfield/i, 'CM'],
  [/right wing/i, 'RW'],
  [/left wing/i, 'LW'],
  [/second striker|centre.?forward|center.?forward/i, 'CF'],
  [/striker|forward|attacker/i, 'ST'],
  // The vague ones last, so "defender" only becomes a centre-back when nothing more
  // exact was written down. A full-back with no side named goes to the right.
  [/full.?back/i, 'RB'],
  [/winger/i, 'RW'],
  [/defender/i, 'CB'],
];

const STAFF = /coach|manager|referee|analyst|physio|director|scout|president|chairman/i;

function toPosition(text: string | null | undefined): Position | null {
  if (!text || STAFF.test(text)) return null;
  for (const [pattern, pos] of POSITIONS) if (pattern.test(text)) return pos;
  return null;
}

/** Which slots belong to which line of the pitch, so the two sources can be reconciled. */
const LINE: Record<'GK' | 'DF' | 'MF' | 'FW', Position[]> = {
  GK: ['GK'],
  DF: ['CB', 'RB', 'LB', 'RWB', 'LWB'],
  MF: ['CDM', 'CM', 'CAM', 'RM', 'LM'],
  FW: ['RW', 'LW', 'CF', 'ST'],
};
const DEFAULT_SLOT: Record<'GK' | 'DF' | 'MF' | 'FW', Position> = {
  GK: 'GK', DF: 'CB', MF: 'CM', FW: 'ST',
};

/**
 * The squad template says which line he plays in, Wikidata says where in it. They agree
 * most of the time; when they do not, the club's own article wins on the line and
 * Wikidata is only allowed to make it more exact.
 */
function reconcile(coarse: SquadEntry['coarse'], detailed: Position | null): Position | null {
  if (!coarse) return detailed;
  if (detailed && LINE[coarse].includes(detailed)) return detailed;
  return DEFAULT_SLOT[coarse];
}

/**
 * Nationality. The squad template already writes three letters, which is what the game
 * uses; these are the ones written differently, plus the names Wikidata falls back to.
 */
const CODE_FIXES: Record<string, string> = {
  GBR: 'ENG', HOL: 'NED', SPA: 'ESP', IRI: 'IRN', GRC: 'GRE', DEU: 'GER', NLD: 'NED',
};
const COUNTRY_NAMES: Record<string, string> = {
  England: 'ENG', Scotland: 'SCO', Wales: 'WAL', 'Republic of Ireland': 'IRL', Ireland: 'IRL',
  'Northern Ireland': 'NIR', 'United Kingdom': 'ENG', Spain: 'ESP', Italy: 'ITA', Germany: 'GER',
  France: 'FRA', Portugal: 'POR', Netherlands: 'NED', 'Kingdom of the Netherlands': 'NED',
  Belgium: 'BEL', Austria: 'AUT', Switzerland: 'SUI', Turkey: 'TUR', 'Türkiye': 'TUR',
  Greece: 'GRE', Israel: 'ISR', Denmark: 'DEN', Sweden: 'SWE', Norway: 'NOR', Poland: 'POL',
  Czechia: 'CZE', 'Czech Republic': 'CZE', Russia: 'RUS', Ukraine: 'UKR', Brazil: 'BRA',
  Argentina: 'ARG', Uruguay: 'URU', Colombia: 'COL', Chile: 'CHI',
  'United States of America': 'USA', 'United States': 'USA', Mexico: 'MEX', Japan: 'JPN',
  'South Korea': 'KOR', Nigeria: 'NGA', Ghana: 'GHA', Senegal: 'SEN', Morocco: 'MAR',
  Algeria: 'ALG', Croatia: 'CRO', Serbia: 'SRB', Slovenia: 'SVN', Slovakia: 'SVK',
  Hungary: 'HUN', Romania: 'ROU', Bulgaria: 'BUL', Finland: 'FIN', Iceland: 'ISL',
  Australia: 'AUS', 'Ivory Coast': 'CIV', "Côte d'Ivoire": 'CIV', Cyprus: 'CYP',
};

interface Detail {
  born: number | null;
  position: Position | null;
  sitelinks: number;
  national: boolean;
  country: string | null;
}

/**
 * What Wikidata knows about the men the club article named: born when, plays where,
 * capped or not, and written up in how many languages.
 */
async function detailsFor(articles: string[]): Promise<Map<string, Detail>> {
  const out = new Map<string, Detail>();
  if (articles.length === 0) return out;

  // Asked by article title rather than by id: the squad template links to Wikipedia, and
  // every Wikipedia article carries its Wikidata item.
  const values = articles.map((a) => `"${a.replace(/["\\]/g, '')}"@en`).join(' ');
  const bindings = await sparql(`
SELECT ?title ?dob ?posLabel ?sitelinks ?nat ?sportLabel ?citLabel WHERE {
  VALUES ?title { ${values} }
  ?article schema:about ?p ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title .
  ?p wikibase:sitelinks ?sitelinks .
  OPTIONAL { ?p wdt:P569 ?dob }
  OPTIONAL { ?p wdt:P413 ?pos }
  OPTIONAL { ?p wdt:P1532 ?sport }
  OPTIONAL { ?p wdt:P27 ?cit }
  OPTIONAL { ?p wdt:P54 ?nat . ?nat wdt:P31 wd:Q6979593 }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`);
  if (!bindings) return out;

  for (const b of bindings) {
    const title = String(b.title?.value ?? '');
    if (!title) continue;
    const held = out.get(title) ?? {
      born: null, position: null, sitelinks: 0, national: false, country: null,
    };
    if (b.dob?.value && held.born === null) {
      const year = Number(String(b.dob.value).slice(0, 4));
      if (year > 1940) held.born = year;
    }
    if (b.posLabel?.value && !held.position) held.position = toPosition(String(b.posLabel.value));
    if (b.sitelinks?.value) held.sitelinks = Math.max(held.sitelinks, Number(b.sitelinks.value));
    if (b.nat?.value) held.national = true;
    // Who he plays for beats what his passport says: Bale is Welsh and Rice is English,
    // and both hold the same passport.
    const sport = b.sportLabel?.value ? COUNTRY_NAMES[String(b.sportLabel.value)] : null;
    const cit = b.citLabel?.value ? COUNTRY_NAMES[String(b.citLabel.value)] : null;
    if (!held.country) held.country = sport ?? cit ?? null;
    out.set(title, held);
  }
  return out;
}

/* ------------------------------------------------------------------ the seeds */

interface StarSeed {
  clubId: string;
  firstName: string;
  lastName: string;
  pos: Position;
  ovr: number;
  age: number;
  country: string;
  source?: string;
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0]!, lastName: parts[0]! };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') };
}

/**
 * How good he is, as far as anything free will say.
 *
 * The club sets the level - a squad player at Madrid is better than a starter in the
 * Israeli second tier - and fame moves him inside it. Sitelinks are the honest proxy:
 * six language editions is "has a page at home and where he plays", sixty is Haaland,
 * and everything interesting happens in between. Fame is worth more at a small club than
 * a big one, because at Madrid the badge has already said everybody is famous.
 */
function rate(club: Club, detail: Detail | undefined, age: number, number: number | null): number {
  // The same scale the engine builds a squad on - clubBaseOvr - rather than the club's
  // strength, which is a different number entirely: strength 86 is a squad of 83s, and
  // reading it as an ability rating put half of Liverpool in the nineties.
  const base = 30 + (club.strength ?? 55) * 0.62;
  const fame = Math.max(0, Math.min(1, ((detail?.sitelinks ?? 4) - 6) / 54));
  const spread = base > 78 ? 11 : 15;
  const curve = age < 19 ? -9 : age < 21 ? -5.5 : age < 23 ? -2 : age <= 30 ? 1 : age <= 33 ? -1.5 : -6;
  // A first-team shirt number is not nothing: clubs hand 1 to 11 to the men who play and
  // the thirties and forties to the boys who train with them.
  const shirt = number === null ? 0 : number <= 11 ? 1.5 : number >= 30 ? -2.5 : 0;
  const ovr = base - spread * 0.5 + fame * spread + (detail?.national ? 2.5 : 0) + curve + shirt;
  return Math.max(38, Math.min(94, Math.round(ovr)));
}

function seedFor(
  club: Club,
  entry: SquadEntry,
  detail: Detail | undefined,
  season: number,
): StarSeed | null {
  const pos = reconcile(entry.coarse, detail?.position ?? null);
  if (!pos) return null;

  // Wikipedia does not print an age in the squad box, so a man Wikidata has never heard
  // of is taken for a squad player in his middle twenties.
  const age = detail?.born ? season - detail.born : 24;
  if (age < 15 || age > 42) return null;

  const nat = entry.nat ? CODE_FIXES[entry.nat] ?? entry.nat : null;
  const country = nat ?? detail?.country ?? club.country;

  return {
    ...splitName(entry.display),
    clubId: club.id,
    pos,
    ovr: rate(club, detail, age, entry.number),
    age,
    country,
    source: 'wikidata',
  };
}

/**
 * A squad the world builder can plant: no fourth goalkeeper, no eleven centre-backs.
 *
 * Read best first, because the squad template is in shirt-number order and cutting by
 * that would throw away a thirty-eight in favour of a sixteen.
 */
function trim(seeds: StarSeed[]): StarSeed[] {
  const CAP: Partial<Record<Position, number>> = { GK: 3, CB: 5, CM: 5, ST: 4 };
  const count: Partial<Record<Position, number>> = {};
  const out: StarSeed[] = [];
  for (const seed of [...seeds].sort((a, b) => b.ovr - a.ovr)) {
    const used = count[seed.pos] ?? 0;
    if (used >= (CAP[seed.pos] ?? 3)) continue;
    count[seed.pos] = used + 1;
    out.push(seed);
    if (out.length >= MAX_SQUAD) break;
  }
  return out;
}

/* ------------------------------------------------------------------ the run */

/** The English Wikipedia article behind a club, for the ones we only stored an id for. */
async function titleFromQid(qid: string): Promise<string | null> {
  const body = await getJson(
    `${WD_API}?action=wbgetentities&ids=${qid}&props=sitelinks&format=json&origin=*`,
    350,
  );
  return body?.entities?.[qid]?.sitelinks?.enwiki?.title ?? null;
}

/** Words that say nothing about which club this is. */
const NOISE = /^(fc|afc|sc|ac|cf|sk|fk|nk|bk|if|sv|vf[bl]|ss|us|club|de|do|the|f\.c\.|a\.c\.)$/i;

function tokens(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word.length > 2 && !NOISE.test(word))
    .map((word) => word.toLowerCase());
}

/**
 * The article behind a club we have no id for at all.
 *
 * Search is a guess, so it has to be checked: the title has to carry the distinctive
 * word in the club's name - "Haifa", "Grasshopper", "Slavia" - and not be a season, a
 * stadium or the women's side, which are the three things that come back instead.
 */
async function titleFromSearch(club: Club): Promise<string | null> {
  const wanted = tokens(club.name);
  if (wanted.length === 0) return null;
  const body = await getJson(
    `${WP_API}?action=query&list=search&srsearch=${encodeURIComponent(`${club.name} football club`)}` +
      `&srlimit=5&format=json&origin=*`,
    350,
  );
  const hits: { title: string }[] = body?.query?.search ?? [];
  for (const hit of hits) {
    const title = hit.title;
    if (/(19|20)\d{2}|season|stadium|women|w\.f\.c|reserves|academy|list of/i.test(title)) continue;
    const found = tokens(title);
    if (wanted.every((word) => found.includes(word))) return title;
  }
  return null;
}

async function main(): Promise<void> {
  const pack = JSON.parse(await readFile(join(packsDir, 'pack.json'), 'utf8')) as DataPack;
  const assets: Record<string, { qid?: string; title?: string }> = JSON.parse(
    await readFile(assetsPath, 'utf8'),
  );
  const existing: Record<string, StarSeed[]> = existsSync(squadsPath)
    ? JSON.parse(await readFile(squadsPath, 'utf8'))
    : {};

  const season = pack.season;
  const wanted = pack.clubs.filter((club) => {
    if (ONLY) return club.id === ONLY;
    if (ALL) return true;
    // A club already read from the encyclopedia is done; one still holding the ten names
    // the free database gave us is not.
    return existing[club.id]?.[0]?.source !== 'wikidata';
  });

  // The article to read. Most were stored while sourcing crests; the rest are looked up
  // once and written back, so the next run starts with all of them.
  const untitled = wanted.filter((club) => !assets[club.id]?.title);
  if (untitled.length > 0) {
    console.log(`resolving ${untitled.length} club articles`);
    let found = 0;
    for (const club of untitled) {
      const qid = assets[club.id]?.qid;
      const title = (qid ? await titleFromQid(qid) : null) ?? (await titleFromSearch(club));
      if (title) {
        assets[club.id] = { ...(assets[club.id] ?? {}), title };
        found++;
      }
    }
    await writeFile(assetsPath, JSON.stringify(assets, null, 2), 'utf8');
    console.log(`  ${found} resolved of ${untitled.length}`);
  }

  const todo = wanted.filter((club) => assets[club.id]?.title);
  console.log(`${todo.length} clubs to read squads for (of ${wanted.length} wanted)`);

  let players = 0;
  let clubsDone = 0;
  const thin: string[] = [];

  for (let i = 0; i < todo.length; i += BATCH) {
    const slice = todo.slice(i, i + BATCH);

    // The squads first, then one question to Wikidata about everybody in them.
    const squads = new Map<string, SquadEntry[]>();
    for (const club of slice) {
      const entries = await squadFromWikipedia(assets[club.id]!.title!);
      if (entries.length > 0) squads.set(club.id, entries);
    }
    const articles = [...new Set([...squads.values()].flat().map((entry) => entry.article))];
    const details = await detailsFor(articles);

    for (const club of slice) {
      const entries = squads.get(club.id) ?? [];
      const seeds: StarSeed[] = [];
      for (const entry of entries) {
        const seed = seedFor(club, entry, details.get(entry.article), season);
        if (seed) seeds.push(seed);
      }
      const squad = trim(seeds);
      // A handful of names is what we already had; only a real squad is worth replacing
      // what is there with.
      if (squad.length >= 11) {
        existing[club.id] = squad;
        players += squad.length;
        clubsDone++;
      } else if (entries.length > 0) {
        thin.push(`${club.id} (${squad.length})`);
      }
    }

    console.log(`  ${Math.min(i + BATCH, todo.length)}/${todo.length} clubs read (${players} players)`);
    await writeFile(squadsPath, JSON.stringify(existing, null, 2), 'utf8');
  }

  await writeFile(squadsPath, JSON.stringify(existing, null, 2), 'utf8');
  const total = Object.values(existing).reduce((sum, list) => sum + list.length, 0);
  const full = Object.values(existing).filter((list) => list[0]?.source === 'wikidata').length;
  if (thin.length > 0) console.log(`\nleft as they were, too few players: ${thin.join(', ')}`);
  console.log(
    `\n${clubsDone} squads written this run (${players} players); ` +
      `${total} real players across ${Object.keys(existing).length} clubs, ${full} of them full squads`,
  );
}

void main();
