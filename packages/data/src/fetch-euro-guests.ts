/**
 * The clubs from leagues we do not simulate week by week, but that Europe is full of.
 *
 * A Champions League without Dinamo Zagreb, Red Star, Slavia Prague, Copenhagen or
 * Young Boys is not a Champions League. This pulls the top clubs of a dozen more
 * countries from the football database - names, city, badge and colours - and writes
 * them into a data file that the pack builder plants as small top divisions, so they
 * have a table, a champion, and a route into Europe like everyone else.
 *
 *   tsx src/fetch-euro-guests.ts
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dominantColor } from './png-color.js';

const here = dirname(fileURLToPath(import.meta.url));
const packsDir = join(here, '..', 'packs');
const crestDir = join(packsDir, 'crests');
const outPath = join(packsDir, 'euro-guests.json');

const UA = 'RoadToGloryGame/0.1 (private hobby project)';
const SPORTSDB = 'https://www.thesportsdb.com/api/v1/json/3';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface GuestLeague {
  competitionId: string;
  country: string;
  /** The name the database files the league under. */
  league: string;
  /** Extra clubs to pull by name when the league listing misses them. */
  extra?: string[];
}

/** Twelve more countries, and the clubs that actually turn up in Europe. */
const LEAGUES: GuestLeague[] = [
  { competitionId: 'sui.1', country: 'SUI', league: 'Swiss Super League' },
  { competitionId: 'cro.1', country: 'CRO', league: 'Croatian 1. HNL', extra: ['Dinamo Zagreb', 'Hajduk Split', 'HNK Rijeka', 'Osijek', 'Lokomotiva Zagreb', 'Slaven Belupo', 'Varazdin', 'Istra 1961'] },
  { competitionId: 'srb.1', country: 'SRB', league: 'Serbian SuperLiga', extra: ['Red Star Belgrade', 'Partizan Belgrade', 'Vojvodina', 'Cukaricki', 'TSC Backa Topola', 'Radnicki Nis', 'Napredak', 'Spartak Subotica'] },
  { competitionId: 'cyp.1', country: 'CYP', league: 'Cypriot First Division' },
  { competitionId: 'ukr.1', country: 'UKR', league: 'Ukrainian Premier League' },
  { competitionId: 'rou.1', country: 'ROU', league: 'Romanian Liga I' },
  { competitionId: 'cze.1', country: 'CZE', league: 'Czech First League' },
  { competitionId: 'hun.1', country: 'HUN', league: 'Hungarian NB I' },
  { competitionId: 'den.1', country: 'DEN', league: 'Danish Superliga' },
  { competitionId: 'nor.1', country: 'NOR', league: 'Norwegian Eliteserien' },
  { competitionId: 'pol.1', country: 'POL', league: 'Polish Ekstraklasa' },
  { competitionId: 'swe.1', country: 'SWE', league: 'Swedish Allsvenskan' },
];

interface GuestClub {
  id: string;
  name: string;
  shortName: string;
  city?: string;
  country: string;
  competitionId: string;
  crest?: string;
  color?: string;
  sourceRef?: string;
}

let nextSlot = 0;
async function json(url: string): Promise<any | null> {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + 950;
  if (wait > 0) await sleep(wait);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) return await response.json();
      if (response.status === 429 || response.status >= 500) {
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

function slug(country: string, name: string): string {
  return `${country.toLowerCase()}_${name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')}`;
}

function shortNameOf(name: string): string {
  const words = name.split(/\s+/).filter((word) => !/^(fc|sk|nk|hnk|fk|bk|if|ac|sc)$/i.test(word));
  return (words[0] ?? name).slice(0, 12);
}

async function badge(club: GuestClub, url: string): Promise<void> {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) return;
    const bytes = Buffer.from(await response.arrayBuffer());
    const isPng = bytes.length > 8 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    if (!isPng) return;
    const file = `${club.id}.png`;
    await writeFile(join(crestDir, file), bytes);
    club.crest = file;
    const colour = dominantColor(bytes);
    if (colour) club.color = colour;
  } catch {
    // No badge: the app draws a monogram.
  }
}

async function main(): Promise<void> {
  await mkdir(crestDir, { recursive: true });
  const existing: GuestClub[] = existsSync(outPath) ? JSON.parse(await readFile(outPath, 'utf8')) : [];
  const byId = new Map(existing.map((club) => [club.id, club]));

  for (const league of LEAGUES) {
    const rows: any[] = [];
    const listed = await json(`${SPORTSDB}/search_all_teams.php?l=${encodeURIComponent(league.league)}`);
    rows.push(...(listed?.teams ?? []));

    for (const name of league.extra ?? []) {
      if (rows.some((team) => (team.strTeam ?? '').toLowerCase() === name.toLowerCase())) continue;
      const found = await json(`${SPORTSDB}/searchteams.php?t=${encodeURIComponent(name)}`);
      const team = (found?.teams ?? []).find((candidate: any) => candidate.strSport === 'Soccer');
      if (team) rows.push(team);
    }

    let added = 0;
    for (const team of rows) {
      if (team.strSport !== 'Soccer') continue;
      const name: string = team.strTeam ?? '';
      if (!name) continue;
      const club: GuestClub = {
        id: slug(league.country, name),
        name,
        shortName: shortNameOf(name),
        ...(team.strLocation || team.strStadiumLocation ? { city: (team.strLocation ?? team.strStadiumLocation).split(',')[0] } : {}),
        country: league.country,
        competitionId: league.competitionId,
        sourceRef: team.idTeam,
      };
      const badgeUrl: string | undefined = team.strBadge ?? team.strTeamBadge;
      const known = byId.get(club.id);
      if (known?.crest) {
        club.crest = known.crest;
        if (known.color) club.color = known.color;
      } else if (badgeUrl) {
        await badge(club, badgeUrl);
      }
      byId.set(club.id, club);
      added++;
    }
    console.log(`${league.competitionId}: ${added} clubs`);
  }

  const all = [...byId.values()];
  await writeFile(outPath, JSON.stringify(all, null, 2), 'utf8');
  console.log(`\n${all.length} guest clubs, ${all.filter((club) => club.crest).length} with a badge`);
}

void main();
