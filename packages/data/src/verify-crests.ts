/**
 * Checks that the badge on disk really belongs to the club it is filed under.
 *
 * Two things can go wrong when sourcing crests automatically: the file is not a badge
 * at all (a stadium, a squad photo, a banner), or it is a badge but of the wrong club
 * (a namesake in another country, the basketball side of the same sports society).
 *
 * So this pass asks the database what team each stored id actually is, compares that
 * name and country with ours, and separately reads the PNG header to make sure the
 * shape looks like a crest. Anything doubtful is printed and, with --clean, removed
 * so the next sweep tries it again from scratch.
 */
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DataPack } from '@fc/engine';

const here = dirname(fileURLToPath(import.meta.url));
const packsDir = join(here, '..', 'packs');
const crestDir = join(packsDir, 'crests');
const assetsPath = join(packsDir, 'clubs-assets.json');

const UA = 'RoadToGloryGame/0.1 (private hobby project)';
const SPORTSDB = 'https://www.thesportsdb.com/api/v1/json/3';
const CLEAN = process.argv.includes('--clean');
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const COUNTRY: Record<string, string> = {
  ENG: 'England', SCO: 'Scotland', WAL: 'Wales', IRL: 'Ireland',
  ESP: 'Spain', ITA: 'Italy', GER: 'Germany', FRA: 'France', POR: 'Portugal',
  NED: 'Netherlands', BEL: 'Belgium', AUT: 'Austria', SUI: 'Switzerland',
  TUR: 'Turkey', GRE: 'Greece', ISR: 'Israel',
};

let nextSlot = 0;
async function json(url: string): Promise<any | null> {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + 950;
  if (wait > 0) await sleep(wait);
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
      await sleep(900);
    }
    return null;
  }
  return null;
}

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

/** A badge is roughly square; a wide file is a photo or a banner. */
async function shapeOf(file: string): Promise<{ w: number; h: number } | null> {
  const bytes = await readFile(file);
  if (bytes.length < 24 || bytes.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20) };
}

async function main(): Promise<void> {
  const pack = JSON.parse(await readFile(join(packsDir, 'pack.json'), 'utf8')) as DataPack;
  const index: Record<string, any> = JSON.parse(await readFile(assetsPath, 'utf8'));

  const missing: string[] = [];
  const badShape: string[] = [];
  const wrongClub: string[] = [];
  let checked = 0;

  for (const club of pack.clubs) {
    const record = index[club.id];
    const file = record?.crest ? join(crestDir, record.crest) : null;
    if (!file || !existsSync(file)) {
      missing.push(`${club.id}  (${club.name})`);
      continue;
    }

    const shape = await shapeOf(file);
    if (!shape) {
      badShape.push(`${club.id}  unreadable`);
      continue;
    }
    const ratio = shape.w / shape.h;
    if (ratio > 1.8 || ratio < 0.5 || shape.w < 40) {
      badShape.push(`${club.id}  ${shape.w}x${shape.h}`);
      if (CLEAN) {
        await unlink(file);
        delete index[club.id].crest;
        delete index[club.id].color;
      }
      continue;
    }

    // Only files that came from the football database can be checked by identity.
    if (record.source !== 'thesportsdb' || !record.sourceRef) continue;
    const data = await json(`${SPORTSDB}/lookupteam.php?id=${encodeURIComponent(record.sourceRef)}`);
    const team = data?.teams?.[0];
    checked++;
    if (!team) continue;

    const nameScore = Math.max(
      similarity(team.strTeam ?? '', club.name),
      similarity(team.strTeamAlternate ?? '', club.name),
    );
    const wantedCountry = COUNTRY[club.country];
    const countryOk = !wantedCountry || !team.strCountry || team.strCountry === wantedCountry;
    const sportOk = !team.strSport || team.strSport === 'Soccer';

    if (nameScore < 0.5 || !countryOk || !sportOk) {
      wrongClub.push(
        `${club.id}  ours="${club.name}" (${club.country})  theirs="${team.strTeam}" (${team.strCountry}, ${team.strSport})  score=${nameScore.toFixed(2)}`,
      );
      if (CLEAN) {
        await unlink(file).catch(() => {});
        delete index[club.id].crest;
        delete index[club.id].color;
        delete index[club.id].source;
        delete index[club.id].sourceRef;
      }
    }
  }

  if (CLEAN) await writeFile(assetsPath, JSON.stringify(index, null, 2), 'utf8');

  console.log(`clubs ${pack.clubs.length}, identity-checked ${checked}`);
  console.log(`\nmissing a crest (${missing.length}):\n  ${missing.join('\n  ') || '-'}`);
  console.log(`\nnot badge-shaped (${badShape.length}):\n  ${badShape.join('\n  ') || '-'}`);
  console.log(`\nwrong club (${wrongClub.length}):\n  ${wrongClub.join('\n  ') || '-'}`);
}

void main();
