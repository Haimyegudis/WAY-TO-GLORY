/**
 * Getting to the tournament.
 *
 * A World Cup or a Euro used to simply happen to a player's country, decided by a single
 * dice roll against its standing. That is not what international football feels like: it
 * is a group of four played over a season of Thursday and Sunday nights, a table that
 * everybody in the country can recite, and a play-off in March for whoever finishes
 * second. Most countries do not qualify, and the ones that do remember how.
 *
 * The campaign is played on the international weeks of the season that ends with the
 * tournament. Win the group and you are there. Finish second and there is one match left
 * standing between you and a summer. Finish third or fourth and you watch it on
 * television, which for a lot of careers is the honest answer.
 */
import { Rng, clamp } from './rng.js';
import { INTERNATIONAL_WEEKS } from './national.js';
import type { PackIndex } from './data.js';
import type { TournamentId } from './tournament.js';

export interface QualifierRow {
  countryCode: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface QualifierFixture {
  week: number;
  homeCountry: string;
  awayCountry: string;
  played: boolean;
  result?: [number, number];
  /** Set when this was his match: whether he was picked, and what he did.  */
  userPlayed?: boolean;
  userGoals?: number;
  userRating?: number;
}

export interface QualifyingCampaign {
  tournament: TournamentId;
  /** The season whose summer holds the tournament this campaign is for. */
  season: number;
  countryCode: string;
  table: Record<string, QualifierRow>;
  fixtures: QualifierFixture[];
  playoff?: {
    week: number;
    opponent: string;
    played: boolean;
    result?: [number, number];
    won?: boolean;
  };
  outcome?: 'direct' | 'playoff' | 'out';
}

const emptyRow = (countryCode: string): QualifierRow => ({
  countryCode,
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  points: 0,
});

/**
 * A group of four: his country, one seeded above it, one of its own size and one below.
 * That is the shape of nearly every qualifying group, and it is why a mid-sized nation
 * spends every campaign knowing exactly which match decides it.
 */
export function createCampaign(
  rng: Rng,
  index: PackIndex,
  countryCode: string,
  tournament: TournamentId,
  season: number,
): QualifyingCampaign | null {
  const home = index.countryByCode.get(countryCode);
  if (!home) return null;

  const field = [...index.countryByCode.values()].filter((country) => country.code !== countryCode);
  if (field.length < 3) return null;

  const pick = (low: number, high: number): string | null => {
    const band = field.filter(
      (country) => country.reputation >= home.reputation + low && country.reputation <= home.reputation + high,
    );
    const pool = band.length > 0 ? band : field;
    return pool[rng.int(0, pool.length - 1)]?.code ?? null;
  };

  const group = [countryCode];
  for (const [low, high] of [
    [8, 40],
    [-7, 7],
    [-40, -8],
  ] as [number, number][]) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const code = pick(low, high);
      if (code && !group.includes(code)) {
        group.push(code);
        break;
      }
    }
  }
  if (group.length < 4) return null;

  const table: Record<string, QualifierRow> = {};
  for (const code of group) table[code] = emptyRow(code);

  // Four nations, home and away: six rounds, one on each of the first six international
  // weeks, which leaves the last one free for the play-off in March.
  const [a, b, c, d] = group as [string, string, string, string];
  const rounds: [string, string][][] = [
    [[a, b], [c, d]],
    [[a, c], [d, b]],
    [[a, d], [b, c]],
  ];

  const fixtures: QualifierFixture[] = [];
  rounds.forEach((round, i) => {
    for (const [host, guest] of round) {
      fixtures.push({ week: INTERNATIONAL_WEEKS[i]!, homeCountry: host, awayCountry: guest, played: false });
      fixtures.push({ week: INTERNATIONAL_WEEKS[i + 3]!, homeCountry: guest, awayCountry: host, played: false });
    }
  });

  return { tournament, season, countryCode, table, fixtures: fixtures.sort((x, y) => x.week - y.week) };
}

/** The result of an international, from the two nations' standing and the usual noise. */
export function simulateQualifier(
  rng: Rng,
  index: PackIndex,
  homeCountry: string,
  awayCountry: string,
): [number, number] {
  const home = index.countryByCode.get(homeCountry)?.reputation ?? 50;
  const away = index.countryByCode.get(awayCountry)?.reputation ?? 50;

  // Qualifiers are low-scoring and the better side usually wins, but a night in Reykjavik
  // is a night in Reykjavik.
  const edge = (home + 6 - away) / 22;
  const homeGoals = Math.max(0, Math.round(1.15 + edge * 0.55 + rng.gauss(0, 0.85)));
  const awayGoals = Math.max(0, Math.round(1.15 - edge * 0.55 + rng.gauss(0, 0.85)));
  return [homeGoals, awayGoals];
}

export function applyQualifierResult(campaign: QualifyingCampaign, fixture: QualifierFixture): void {
  const [hg, ag] = fixture.result ?? [0, 0];
  const home = campaign.table[fixture.homeCountry];
  const away = campaign.table[fixture.awayCountry];
  if (!home || !away) return;

  home.played++;
  away.played++;
  home.goalsFor += hg;
  home.goalsAgainst += ag;
  away.goalsFor += ag;
  away.goalsAgainst += hg;
  if (hg > ag) {
    home.won++;
    away.lost++;
    home.points += 3;
  } else if (ag > hg) {
    away.won++;
    home.lost++;
    away.points += 3;
  } else {
    home.drawn++;
    away.drawn++;
    home.points++;
    away.points++;
  }
}

/** The group, best first. */
export function qualifyingTable(campaign: QualifyingCampaign): QualifierRow[] {
  return Object.values(campaign.table).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });
}

/**
 * Where the group leaves him. Winner goes; runner-up gets one match in March against
 * another country in the same position; everybody else is out.
 */
export function settleGroup(rng: Rng, index: PackIndex, campaign: QualifyingCampaign): void {
  if (campaign.outcome) return;
  if (campaign.fixtures.some((fixture) => !fixture.played)) return;

  const table = qualifyingTable(campaign);
  const position = table.findIndex((row) => row.countryCode === campaign.countryCode);

  if (position === 0) {
    campaign.outcome = 'direct';
    return;
  }
  if (position !== 1) {
    campaign.outcome = 'out';
    return;
  }

  // A play-off, against somebody who finished second in a group of their own.
  const home = index.countryByCode.get(campaign.countryCode);
  const rivals = [...index.countryByCode.values()].filter(
    (country) =>
      country.code !== campaign.countryCode &&
      !campaign.table[country.code] &&
      Math.abs(country.reputation - (home?.reputation ?? 50)) <= 14,
  );
  const pool = rivals.length > 0 ? rivals : [...index.countryByCode.values()].filter((c) => c.code !== campaign.countryCode);
  const opponent = pool[rng.int(0, pool.length - 1)]?.code;
  if (!opponent) {
    campaign.outcome = 'out';
    return;
  }

  campaign.playoff = { week: INTERNATIONAL_WEEKS[6]!, opponent, played: false };
}

/** One match, at home, for a summer. */
export function settlePlayoff(rng: Rng, index: PackIndex, campaign: QualifyingCampaign): void {
  const playoff = campaign.playoff;
  if (!playoff || playoff.played) return;

  const result = simulateQualifier(rng, index, campaign.countryCode, playoff.opponent);
  playoff.played = true;
  playoff.result = result;
  // Level after ninety minutes is extra time and penalties, and home advantage is most
  // of what a play-off is.
  playoff.won = result[0] === result[1] ? rng.chance(0.55) : result[0] > result[1];
  campaign.outcome = playoff.won ? 'playoff' : 'out';
}

/** Whether the country is going to the tournament. */
export function qualified(campaign: QualifyingCampaign | undefined): boolean {
  if (!campaign) return false;
  return campaign.outcome === 'direct' || (campaign.outcome === 'playoff' && campaign.playoff?.won === true);
}

/** How much a campaign is worth to a player who played in it. */
export function campaignFame(campaign: QualifyingCampaign): number {
  const caps = campaign.fixtures.filter((fixture) => fixture.userPlayed).length;
  const goals = campaign.fixtures.reduce((sum, fixture) => sum + (fixture.userGoals ?? 0), 0);
  return clamp(caps * 0.6 + goals * 1.4 + (qualified(campaign) ? 4 : 0), 0, 22);
}
