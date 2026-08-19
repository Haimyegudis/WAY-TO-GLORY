/**
 * Real players for real clubs.
 *
 * The pack ships a hand-written list of ~200 marquee names, which leaves most squads
 * filled with generated players. This pass pulls the actual players TheSportsDB holds
 * for each club we already matched while sourcing crests - we stored the team id then,
 * so there is no guessing here - and writes them as star seeds the world builder can
 * plant into squads.
 *
 * The free key returns a slice of each squad rather than all 25, so this does not
 * replace generated players; it means the names you recognise are the real ones.
 *
 *   tsx src/fetch-squads.ts           # clubs not fetched yet
 *   tsx src/fetch-squads.ts --all     # refresh everything
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DataPack, Position } from '@fc/engine';

const here = dirname(fileURLToPath(import.meta.url));
const packsDir = join(here, '..', 'packs');
const assetsPath = join(packsDir, 'clubs-assets.json');
const squadsPath = join(packsDir, 'real-players.json');

const UA = 'RoadToGloryGame/0.1 (private hobby project)';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ALL = process.argv.includes('--all');
const SPORTSDB = 'https://www.thesportsdb.com/api/v1/json/3';

let nextSlot = 0;
async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + 950;
  if (wait > 0) await sleep(wait);
}

async function json(url: string): Promise<any | null> {
  await throttle();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
      if (response.ok) return await response.json();
      if (response.status === 429 || response.status >= 500) {
        nextSlot = Date.now() + 4000;
        await sleep(4000);
        continue;
      }
    } catch {
      await sleep(900 * (attempt + 1));
    }
    return null;
  }
  return null;
}

/** The database writes positions in words; the engine thinks in slots. */
const POSITIONS: [RegExp, Position][] = [
  [/goalkeeper|keeper/i, 'GK'],
  [/right.?back|right full/i, 'RB'],
  [/left.?back|left full/i, 'LB'],
  [/right wing.?back/i, 'RWB'],
  [/left wing.?back/i, 'LWB'],
  [/centre.?back|center.?back|defender/i, 'CB'],
  [/defensive midfield/i, 'CDM'],
  [/attacking midfield/i, 'CAM'],
  [/right midfield/i, 'RM'],
  [/left midfield/i, 'LM'],
  [/central midfield|midfield/i, 'CM'],
  [/right wing/i, 'RW'],
  [/left wing/i, 'LW'],
  [/second striker|centre.?forward|center.?forward/i, 'CF'],
  [/striker|forward|attack/i, 'ST'],
];

/** Anyone whose "position" is a job on the touchline is not a player. */
const STAFF = /coach|manager|analyst|physio|director|scout|staff|president/i;

function toPosition(text: string | null | undefined): Position | null {
  if (!text || STAFF.test(text)) return null;
  for (const [pattern, pos] of POSITIONS) if (pattern.test(text)) return pos;
  return null;
}

const COUNTRIES: Record<string, string> = {
  England: 'ENG', Scotland: 'SCO', Wales: 'WAL', Ireland: 'IRL', 'Northern Ireland': 'NIR',
  Spain: 'ESP', Italy: 'ITA', Germany: 'GER', France: 'FRA', Portugal: 'POR',
  'The Netherlands': 'NED', Netherlands: 'NED', Belgium: 'BEL', Austria: 'AUT', Switzerland: 'SUI',
  Turkey: 'TUR', Greece: 'GRE', Israel: 'ISR', Denmark: 'DEN', Sweden: 'SWE', Norway: 'NOR',
  Poland: 'POL', 'Czech Republic': 'CZE', Czechia: 'CZE', Russia: 'RUS', Ukraine: 'UKR',
  Brazil: 'BRA', Argentina: 'ARG', Uruguay: 'URU', Colombia: 'COL', Chile: 'CHI',
  'United States': 'USA', Mexico: 'MEX', Japan: 'JPN', 'South Korea': 'KOR',
  Nigeria: 'NGA', Ghana: 'GHA', Senegal: 'SEN', Morocco: 'MAR', Algeria: 'ALG',
  Croatia: 'CRO', Serbia: 'SRB', Slovenia: 'SVN', Slovakia: 'SVK', Hungary: 'HUN',
  Romania: 'ROU', Bulgaria: 'BUL', Finland: 'FIN', Iceland: 'ISL', Australia: 'AUS',
};

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

/** Deterministic jitter from a name, so a rerun does not reshuffle every squad. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0]!, lastName: parts[0]! };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') };
}

async function main(): Promise<void> {
  const pack = JSON.parse(await readFile(join(packsDir, 'pack.json'), 'utf8')) as DataPack;
  const assets: Record<string, { sourceRef?: string; source?: string }> =
    JSON.parse(await readFile(assetsPath, 'utf8'));
  const existing: Record<string, StarSeed[]> = existsSync(squadsPath)
    ? JSON.parse(await readFile(squadsPath, 'utf8'))
    : {};

  const season = pack.season;
  const todo = pack.clubs.filter((club) => {
    const ref = assets[club.id]?.sourceRef;
    if (!ref) return false;
    return ALL || !existing[club.id];
  });
  console.log(`${todo.length} clubs with a database id to read squads for`);

  let done = 0;
  let players = 0;

  for (const club of todo) {
    const teamId = assets[club.id]!.sourceRef!;
    const data = await json(`${SPORTSDB}/lookup_all_players.php?id=${encodeURIComponent(teamId)}`);
    const rows: any[] = data?.player ?? [];
    const seeds: StarSeed[] = [];

    for (const row of rows) {
      const pos = toPosition(row.strPosition);
      if (!pos) continue;
      const name: string = row.strPlayer ?? '';
      if (!name) continue;
      const born: string | null = row.dateBorn || null;
      const birthYear = born ? Number(born.slice(0, 4)) : null;
      const age = birthYear && birthYear > 1950 ? season - birthYear : 25;
      if (age < 15 || age > 44) continue;

      // No rating in the source, so it comes from the level the club plays at, with a
      // stable nudge per player: recognisable names, believable spread.
      const base = club.strength ?? 55;
      const jitter = (hash(name) - 0.5) * 10;
      const peak = age < 21 ? -6 : age > 33 ? -4 : 0;
      const ovr = Math.max(40, Math.min(92, Math.round(base + jitter + peak)));

      seeds.push({
        ...splitName(name),
        clubId: club.id,
        pos,
        ovr,
        age,
        country: COUNTRIES[row.strNationality ?? ''] ?? club.country,
        source: 'thesportsdb',
      });
    }

    if (seeds.length > 0) {
      existing[club.id] = seeds;
      players += seeds.length;
    }
    done++;
    if (done % 10 === 0) {
      console.log(`  ${done}/${todo.length} (${players} players)`);
      await writeFile(squadsPath, JSON.stringify(existing, null, 2), 'utf8');
    }
  }

  await writeFile(squadsPath, JSON.stringify(existing, null, 2), 'utf8');
  const total = Object.values(existing).reduce((sum, list) => sum + list.length, 0);
  console.log(`\n${players} players read this run; ${total} real players across ${Object.keys(existing).length} clubs`);
}

void main();
