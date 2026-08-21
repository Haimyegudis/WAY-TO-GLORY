/**
 * Builds packs/pack.json from the downloaded openfootball files plus the
 * hand-authored leagues, stars and events.
 *
 * Club strength is derived from the latest completed upstream season, 2025/26 (points
 * per game), while a new career begins in the 2026/27 season. Upstream does not yet
 * publish a 2026/27 set; the source snapshot is kept honest rather than relabelled.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Rng, hashString, clamp, validatePack,
  type Club, type Competition, type Country, type DataPack, type StarPlayerSeed,
} from '@fc/engine';
import { SOURCES } from './sources.js';
import { COMPETITIONS, COUNTRIES, REPUTATION_OVERRIDES, type CompetitionSeed } from './competitions.js';
import { MANUAL_CLUBS } from './manual-clubs.js';
import { EURO_GUESTS } from './euro-guests.js';
import { NAME_POOLS } from './names.js';
import { STARS } from './stars.js';
import { EVENTS } from './events.js';
import { EVENTS_EXTRA } from './events-extra.js';
import { EVENTS_LIFESTYLE } from './events-lifestyle.js';
import { EVENTS_DILEMMAS } from './events-dilemmas.js';
import { HEBREW_CLUB_NAMES } from './hebrew-clubs.js';
import { CLUB_COLORS } from './club-colors.js';
import { RIVALRIES } from './rivalries.js';
import { REAL_PLAYERS } from './real-players.js';

interface ClubAsset {
  clubId: string;
  nameHe?: string;
  crest?: string;
  color?: string;
}

const here = dirname(fileURLToPath(import.meta.url));
const rawDir = join(here, '..', 'packs', 'raw');
const outDir = join(here, '..', 'packs');
const packsDir = outDir;

const SEASON = 2026;

const SPRING_COUNTRIES = new Set(['NOR', 'SWE', 'USA']);
const SOUTH_AMERICA = new Set(['ARG', 'BRA']);
const WINTER_BREAK = new Set(['GER', 'AUT', 'DEN', 'NED', 'BEL', 'SUI', 'POL', 'CZE', 'UKR']);
const HEAD_TO_HEAD = new Set(['ESP', 'ITA', 'FRA', 'POR', 'GRE', 'TUR']);
const WINS_FIRST = new Set(['BRA', 'USA']);

function calendarFor(country: string): NonNullable<Competition['calendar']> {
  if (SPRING_COUNTRIES.has(country)) return { firstWeek: 9, lastWeek: 47 };
  if (SOUTH_AMERICA.has(country)) return { firstWeek: country === 'ARG' ? 5 : 7, lastWeek: 49 };
  return {
    firstWeek: 7,
    lastWeek: 49,
    ...(WINTER_BREAK.has(country) ? { breakWeeks: [25, 26] } : {}),
  };
}

function tieBreakersFor(country: string): NonNullable<Competition['leagueRules']>['tieBreakers'] {
  if (HEAD_TO_HEAD.has(country)) return ['headToHead', 'goalDifference', 'goalsFor', 'wins', 'id'];
  if (WINS_FIRST.has(country)) return ['wins', 'goalDifference', 'goalsFor', 'id'];
  return ['goalDifference', 'goalsFor', 'wins', 'id'];
}

function seasonStartMonthFor(country: string): number {
  if (SPRING_COUNTRIES.has(country)) return 3;
  if (country === 'ARG') return 1;
  if (country === 'BRA') return 4;
  return 8;
}

interface TeamRecord {
  name: string;
  played: number;
  points: number;
}

interface OpenFootballMatch {
  team1: string;
  team2: string;
  score?: { ft?: [number, number] } | [number, number];
}

function scoreOf(match: OpenFootballMatch): [number, number] | null {
  const raw = match.score;
  if (!raw) return null;
  if (Array.isArray(raw)) return raw.length === 2 ? [raw[0]!, raw[1]!] : null;
  if (raw.ft && raw.ft.length === 2) return [raw.ft[0]!, raw.ft[1]!];
  return null;
}

function tally(records: Map<string, TeamRecord>, name: string): TeamRecord {
  let record = records.get(name);
  if (!record) {
    record = { name, played: 0, points: 0 };
    records.set(name, record);
  }
  return record;
}

function parseJsonLeague(text: string): TeamRecord[] {
  const data = JSON.parse(text) as { matches: OpenFootballMatch[] };
  const records = new Map<string, TeamRecord>();
  for (const match of data.matches ?? []) {
    const home = tally(records, match.team1);
    const away = tally(records, match.team2);
    const score = scoreOf(match);
    if (!score) continue;
    home.played++;
    away.played++;
    if (score[0] > score[1]) home.points += 3;
    else if (score[0] < score[1]) away.points += 3;
    else {
      home.points++;
      away.points++;
    }
  }
  return [...records.values()];
}

/** openfootball's plain-text format: "  15:30  Home Team  v  Away Team  2-1 (1-0)" */
function parseTxtLeague(text: string): TeamRecord[] {
  const records = new Map<string, TeamRecord>();
  const line = /^\s*(?:\d{1,2}:\d{2}\s+)?(.+?)\s+v\s+(.+?)(?:\s{2,}(\d+)-(\d+).*)?$/;

  for (const raw of text.split(/\r?\n/)) {
    if (!raw.includes(' v ')) continue;
    const match = line.exec(raw.replace(/\s+$/, ''));
    if (!match) continue;
    const homeName = match[1]!.trim();
    const awayName = match[2]!.trim();
    if (!homeName || !awayName || homeName.startsWith('#') || homeName.startsWith('=')) continue;

    const home = tally(records, homeName);
    const away = tally(records, awayName);
    if (match[3] === undefined || match[4] === undefined) continue;
    const hg = Number(match[3]);
    const ag = Number(match[4]);
    home.played++;
    away.played++;
    if (hg > ag) home.points += 3;
    else if (hg < ag) away.points += 3;
    else {
      home.points++;
      away.points++;
    }
  }
  return [...records.values()];
}

/** Wikipedia titles carry disambiguation suffixes the game does not want. */
function cleanHebrewTitle(title: string): string {
  return title
    .replace(/\s*\((?:כדורגל|מועדון כדורגל|קבוצת כדורגל|אנגליה|ספרד|איטליה|גרמניה|ישראל)\)\s*/g, ' ')
    .replace(/^מועדון הכדורגל\s+/, '')
    .replace(/^מועדון כדורגל\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function shortName(name: string): string {
  return name
    .replace(/\b(FC|AFC|CF|SC|AC|SS|SSC|US|AS|SV|VfB|VfL|TSV|BSC|CD|UD|RC|SD|AD|SK|BK|FK)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim() || name;
}

function clubStrength(seed: CompetitionSeed, ppg: number, minPpg: number, maxPpg: number): number {
  const lo = seed.reputation * 0.78;
  const hi = seed.reputation * 0.98;
  if (maxPpg - minPpg < 0.05) return (lo + hi) / 2;
  const t = (ppg - minPpg) / (maxPpg - minPpg);
  return lo + t * (hi - lo);
}

function buildClub(seed: CompetitionSeed, name: string, strength: number, city?: string, manual = false): Club {
  const rng = new Rng(hashString(`${seed.id}:${name}`));
  const override = REPUTATION_OVERRIDES[`${seed.id}:${name}`];
  const reputation = clamp(override ?? strength * 0.96 + rng.range(-3, 3), 5, 99);

  return {
    id: `${seed.country.toLowerCase()}_${slug(name)}`,
    name,
    shortName: shortName(name),
    country: seed.country,
    competitionId: seed.id,
    tier: seed.tier,
    ...(city ? { city } : {}),
    reputation: Math.round(reputation),
    academy: Math.round(clamp(reputation * 0.82 + rng.range(-8, 12), 10, 99)),
    training: Math.round(clamp(reputation * 0.88 + rng.range(-6, 10), 10, 99)),
    finances: Math.round(clamp(reputation * 0.95 + rng.range(-6, 6), 5, 99)),
    strength: Math.round(clamp(strength, 5, 99)),
    source: manual ? 'manual' : 'openfootball',
  };
}

/**
 * The hand-written marquee names win where they exist - they carry real ratings - and
 * everything TheSportsDB gave us fills in behind them, so a squad list reads like the
 * real squad rather than a page of invented names.
 */
/**
 * One man, one name.
 *
 * The hand-written list spells him the way a keyboard does - Mbappe, Gyokeres, Rubens
 * Dias - and the encyclopedia spells him properly, so comparing the two strings put both
 * of them in the squad and the same player turned up twice. The comparison is now made
 * on the letters underneath the accents.
 */
function sameManKey(clubId: string, firstName: string, lastName: string): string {
  const fold = (word: string) =>
    word
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, '');
  return `${clubId}|${fold(firstName)}|${fold(lastName)}`;
}

function mergeStars(clubs: Club[]): StarPlayerSeed[] {
  const clubIds = new Set(clubs.map((c) => c.id));
  const manual = STARS.filter((s) => clubIds.has(s.clubId));
  const byMan = new Map<string, StarPlayerSeed>();
  const out: StarPlayerSeed[] = [];

  for (const star of manual) {
    const key = sameManKey(star.clubId, star.firstName, star.lastName);
    if (byMan.has(key)) continue;
    byMan.set(key, star);
    out.push(star);
  }

  for (const [clubId, seeds] of Object.entries(REAL_PLAYERS)) {
    if (!clubIds.has(clubId)) continue;
    for (const seed of seeds) {
      const key = sameManKey(clubId, seed.firstName, seed.lastName);
      const held = byMan.get(key);
      if (held) {
        // The hand-written rating stays - it was chosen - but the spelling with the
        // accents on it is the man's actual name, so that is the one he plays under.
        held.firstName = seed.firstName;
        held.lastName = seed.lastName;
        continue;
      }
      byMan.set(key, seed);
      out.push(seed);
    }
  }
  return out;
}

async function main(): Promise<void> {
  // Crests, Hebrew names and club colours are collected by fetch-club-assets.
  const assetsFile = join(packsDir, 'clubs-assets.json');
  const assets: Record<string, ClubAsset> = existsSync(assetsFile)
    ? (JSON.parse(await readFile(assetsFile, 'utf8')) as Record<string, ClubAsset>)
    : {};

  const clubs: Club[] = [];
  const competitions: Competition[] = [];
  const missing: string[] = [];

  for (const seed of COMPETITIONS) {
    let records: TeamRecord[] = [];
    const source = SOURCES.find((s) => s.competitionId === seed.id);
    const manualList = MANUAL_CLUBS[seed.id];

    if (source && existsSync(join(rawDir, source.file))) {
      const text = await readFile(join(rawDir, source.file), 'utf8');
      records = source.kind === 'json' ? parseJsonLeague(text) : parseTxtLeague(text);
    }

    // Countries whose top clubs we know from the football database rather than from a
    // league file: real names, real badges, ranked by the standing of the club.
    const guests = EURO_GUESTS.filter((guest) => guest.competitionId === seed.id);
    if (records.length === 0 && guests.length > 0) {
      guests.forEach((guest, i) => {
        const strength = Math.round(seed.reputation + 12 - (i * 24) / Math.max(1, guests.length - 1));
        const club = buildClub(seed, guest.name, strength, guest.city, true);
        club.id = guest.id;
        club.shortName = guest.shortName;
        if (guest.nameHe) club.nameHe = guest.nameHe;
        if (guest.crest) club.crest = guest.crest;
        if (guest.color) club.color = guest.color;
        clubs.push(club);
      });
    } else if (records.length === 0 && manualList) {
      for (const entry of manualList) {
        clubs.push(buildClub(seed, entry.name, entry.strength, entry.city, true));
      }
    } else if (records.length > 0) {
      const ppgs = records.map((r) => (r.played > 0 ? r.points / r.played : 1.3));
      const minPpg = Math.min(...ppgs);
      const maxPpg = Math.max(...ppgs);
      records.forEach((record, i) => {
        clubs.push(buildClub(seed, record.name, clubStrength(seed, ppgs[i]!, minPpg, maxPpg)));
      });
    } else {
      missing.push(seed.id);
      continue;
    }

    const teams = clubs.filter((c) => c.competitionId === seed.id).length;
    competitions.push({
      id: seed.id,
      name: seed.name,
      nameHe: seed.nameHe,
      country: seed.country,
      tier: seed.tier,
      type: 'league',
      teams,
      rounds: seed.rounds,
      ...(seed.promotionAuto ? { promotion: { auto: seed.promotionAuto, ...(seed.promotionTo ? { to: seed.promotionTo } : {}) } } : {}),
      ...(seed.relegationAuto ? { relegation: { auto: seed.relegationAuto, ...(seed.relegationTo ? { to: seed.relegationTo } : {}) } } : {}),
      ...(seed.ucl || seed.uel || seed.uecl || seed.uclQual || seed.uelQual || seed.ueclQual
        ? {
            europeanSlots: {
              ...(seed.ucl ? { ucl: seed.ucl } : {}),
              ...(seed.uel ? { uel: seed.uel } : {}),
              ...(seed.uecl ? { uecl: seed.uecl } : {}),
              ...(seed.uclQual ? { uclQual: seed.uclQual } : {}),
              ...(seed.uelQual ? { uelQual: seed.uelQual } : {}),
              ...(seed.ueclQual ? { ueclQual: seed.ueclQual } : {}),
            },
          }
        : {}),
      cards: seed.cards,
      calendar: calendarFor(seed.country),
      leagueRules: {
        pointsForWin: 3,
        pointsForDraw: 1,
        tieBreakers: tieBreakersFor(seed.country),
      },
      reputation: seed.reputation,
      seasonStartMonth: seasonStartMonthFor(seed.country),
    });
  }

  for (const club of clubs) {
    const asset = assets[club.id];
    // A hand-written Hebrew name always wins over the Wikipedia title, which
    // often carries a disambiguation suffix like "(כדורגל)".
    const manual = HEBREW_CLUB_NAMES[club.id];
    if (manual) club.nameHe = manual;
    if (!asset) continue;
    if (!manual && asset.nameHe) club.nameHe = cleanHebrewTitle(asset.nameHe);
    if (asset.crest) club.crest = asset.crest;
    if (asset.color) club.color = asset.color;
    // A colour we know beats one guessed from the crest image.
    const knownColor = CLUB_COLORS[club.id];
    if (knownColor) club.color = knownColor;
  }

  const countries: Country[] = COUNTRIES.map((c) => ({
    code: c.code,
    name: c.name,
    nameHe: c.nameHe,
    ...(c.confederation ? { confederation: c.confederation } : {}),
    reputation: c.reputation,
    competitionIds: competitions.filter((comp) => comp.country === c.code).map((comp) => comp.id),
    nameLocale: c.nameLocale,
    cupName: c.cupName,
    cupNameHe: c.cupNameHe,
  })).filter((c) => c.competitionIds.length > 0);

  // Rivalries, both ways round, plus anything that shares a city.
  const rivalsById = new Map<string, Set<string>>();
  const addRival = (a: string, b: string) => {
    if (a === b) return;
    if (!clubs.some((c) => c.id === a) || !clubs.some((c) => c.id === b)) return;
    const set = rivalsById.get(a) ?? new Set<string>();
    set.add(b);
    rivalsById.set(a, set);
  };
  for (const [a, b] of RIVALRIES) {
    addRival(a, b);
    addRival(b, a);
  }
  const byCity = new Map<string, Club[]>();
  for (const club of clubs) {
    if (!club.city) continue;
    const key = `${club.country}:${club.city.toLowerCase()}`;
    byCity.set(key, [...(byCity.get(key) ?? []), club]);
  }
  for (const sameCity of byCity.values()) {
    if (sameCity.length < 2 || sameCity.length > 4) continue;
    for (const a of sameCity) for (const b of sameCity) addRival(a.id, b.id);
  }
  for (const club of clubs) {
    const rivals = rivalsById.get(club.id);
    if (rivals && rivals.size > 0) club.rivals = [...rivals];
  }

  const pack: DataPack = {
    version: '2026.27.0',
    season: SEASON,
    countries,
    competitions,
    clubs,
    names: NAME_POOLS,
    stars: mergeStars(clubs),
    events: [...EVENTS, ...EVENTS_EXTRA, ...EVENTS_LIFESTYLE, ...EVENTS_DILEMMAS],
  };

  const problems = validatePack(pack);
  const errors = problems.filter((p) => p.level === 'error');
  for (const problem of problems) {
    console.log(`  ${problem.level.toUpperCase()}: ${problem.message}`);
  }

  const droppedStars = STARS.length - pack.stars.length;
  if (droppedStars > 0) console.log(`  note: ${droppedStars} stars dropped (club id not in pack)`);
  if (missing.length > 0) console.log(`  note: no data for ${missing.join(', ')}`);

  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'pack.json'), JSON.stringify(pack), 'utf8');
  await writeFile(join(outDir, 'pack.pretty.json'), JSON.stringify(pack, null, 2), 'utf8');

  const byTier = new Map<string, number>();
  for (const club of clubs) byTier.set(club.competitionId, (byTier.get(club.competitionId) ?? 0) + 1);

  const crested = clubs.filter((c) => c.crest).length;
  const hebrew = clubs.filter((c) => c.nameHe).length;
  console.log(`\npack ${pack.version}: ${countries.length} countries, ${competitions.length} competitions, ${clubs.length} clubs, ${crested} crests, ${hebrew} hebrew names, ${pack.stars.length} named stars, ${pack.events.length} events`);
  console.log([...byTier.entries()].map(([id, n]) => `${id}:${n}`).join('  '));

  if (errors.length > 0) {
    console.error(`\n${errors.length} errors in pack`);
    process.exitCode = 1;
  }
}

void main();
