import { Rng } from './rng.js';
import { emptyRow } from './league.js';
import type { Club, Fixture, LeagueTableRow } from './types.js';

/**
 * The European nights.
 *
 * Three competitions, entered by where a club finished at home: the Champions League,
 * the Europa League and the Conference League.
 *
 * Each runs the format UEFA moved to in 2024. Thirty-six clubs in one table, eight
 * matches each against eight different opponents - two from each of the four seeding
 * pots, four at home and four away - and no group to hide in. Finish in the top eight
 * and you are in the last sixteen. Finish ninth to twenty-fourth and there is a
 * two-legged play-off to survive first. Finish below that and the European season is
 * over in January, which is the point of the format: the last matchday still matters
 * to almost everybody.
 */

export type EuroTier = 'ucl' | 'uel' | 'uecl';
export const EURO_TIERS: EuroTier[] = ['ucl', 'uel', 'uecl'];

/** Midweeks, kept clear of the domestic cup rounds (7, 12, 17, 22, 29, 35, 40, 44). */
const GROUP_WEEKS = [5, 9, 13, 19, 24, 28];

/** The eight matchdays of the league phase. */
export const LEAGUE_PHASE_WEEKS = [5, 8, 11, 14, 18, 21, 25, 28];

const KNOCKOUT_WEEKS: Record<EuroKnockoutStage, number[]> = {
  playoff: [30, 32],
  r16: [34, 36],
  qf: [39, 41],
  sf: [43, 45],
  final: [46],
};

export type EuroKnockoutStage = 'playoff' | 'r16' | 'qf' | 'sf' | 'final';
export type EuroStage = 'qualifying' | 'group' | EuroKnockoutStage | 'done';

/** Summer weeks, before the domestic season starts. */
export const QUALIFYING_WEEKS = [1, 2, 3];

export interface EuroGroup {
  letter: string;
  clubIds: string[];
  table: Record<string, LeagueTableRow>;
}

export interface EuroTie {
  stage: EuroKnockoutStage;
  leg: 1 | 2;
  week: number;
  homeClubId: string;
  awayClubId: string;
  played: boolean;
  result?: [number, number];
}

export interface EuroQualifyingTie {
  round: number;
  week: number;
  homeClubId: string;
  awayClubId: string;
  played: boolean;
  result?: [number, number];
  winner?: string;
}

export interface EuroState {
  id: EuroTier;
  season: number;
  /**
   * The league phase: one table, thirty-six clubs, eight matches each. Careers saved
   * under the old eight-groups format keep their `groups` and are read that way, so an
   * old save still shows the competition it was actually playing.
   */
  leaguePhase?: Record<string, LeagueTableRow>;
  /** Clubs that go straight into the groups, held while the qualifiers are played. */
  seeded?: string[];
  /** The summer rounds, and who is left in them. */
  qualifying?: { round: number; alive: string[]; ties: EuroQualifyingTie[] };
  groups: EuroGroup[];
  fixtures: Fixture[];
  ties: EuroTie[];
  stage: EuroStage;
  /** Clubs still in it, in bracket order. */
  alive: string[];
  winner?: string;
}

/** Reputation a competition lends a club that plays in it, used for the money and the fame. */
export const EURO_PRESTIGE: Record<EuroTier, number> = { ucl: 96, uel: 78, uecl: 62 };

const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/**
 * Seeds a competition from the clubs that qualified. Anything short of 32 is padded
 * by playing fewer groups rather than inventing clubs - small nations do not always
 * fill a bracket in a game with thirteen countries in it.
 */
/**
 * A competition that has to be qualified for.
 *
 * The clubs with a place already are held aside; everyone else plays a single-leg
 * knockout across three summer weeks for whatever places are left. This is why a
 * champion of a smaller league is not simply in the Champions League: he has to get
 * past two ties in July first, and most years he does not.
 */
export function createEuroWithQualifying(
  rng: Rng,
  id: EuroTier,
  seeded: string[],
  qualifiers: string[],
  season: number,
  groupPlaces: number,
): EuroState {
  const placesLeft = Math.max(0, groupPlaces - seeded.length);
  const alive = rng.shuffle(qualifiers.slice());

  const state: EuroState = {
    id,
    season,
    seeded: seeded.slice(),
    qualifying: { round: 0, alive, ties: [] },
    groups: [],
    fixtures: [],
    ties: [],
    stage: 'qualifying',
    alive: [],
  };

  if (alive.length === 0 || placesLeft === 0) return state;
  drawQualifyingRound(rng, state, placesLeft);
  return state;
}

/**
 * Pairs whoever is left. Once the field is down to the number of places on offer, the
 * rest go through without playing - which is what a bye is.
 */
export function drawQualifyingRound(rng: Rng, state: EuroState, placesLeft: number): void {
  const qualifying = state.qualifying;
  if (!qualifying) return;
  if (qualifying.alive.length <= placesLeft) return;

  const round = qualifying.round + 1;
  const week = QUALIFYING_WEEKS[Math.min(round - 1, QUALIFYING_WEEKS.length - 1)]!;
  qualifying.round = round;

  // Only as many ties as we need to shrink the field to the places available.
  const mustGo = qualifying.alive.length - placesLeft;
  const tieCount = Math.min(Math.floor(qualifying.alive.length / 2), Math.max(1, mustGo));
  const pool = rng.shuffle(qualifying.alive.slice());

  for (let i = 0; i < tieCount; i++) {
    const home = pool[i * 2];
    const away = pool[i * 2 + 1];
    if (!home || !away) break;
    qualifying.ties.push({ round, week, homeClubId: home, awayClubId: away, played: false });
  }
}

/** Settles a qualifying round and either draws the next one or fills the groups. */
export function resolveQualifyingRound(rng: Rng, state: EuroState, placesLeft: number): boolean {
  const qualifying = state.qualifying;
  if (!qualifying) return false;
  const ties = qualifying.ties.filter((tie) => tie.round === qualifying.round);
  if (ties.length === 0 || !ties.every((tie) => tie.played)) return false;

  const eliminated = new Set<string>();
  for (const tie of ties) {
    const [home, away] = tie.result ?? [0, 0];
    const winner = home === away ? (rng.chance(0.55) ? tie.homeClubId : tie.awayClubId) : home > away ? tie.homeClubId : tie.awayClubId;
    tie.winner = winner;
    eliminated.add(winner === tie.homeClubId ? tie.awayClubId : tie.homeClubId);
  }
  qualifying.alive = qualifying.alive.filter((clubId) => !eliminated.has(clubId));

  if (qualifying.alive.length > placesLeft && qualifying.round < QUALIFYING_WEEKS.length) {
    drawQualifyingRound(rng, state, placesLeft);
    return false;
  }
  return true;
}

/** Everyone who ends the summer with a place: the seeds plus whoever came through. */
export function qualifiedField(state: EuroState, groupPlaces: number): string[] {
  const seeded = state.seeded ?? [];
  const survivors = state.qualifying?.alive ?? [];
  return [...seeded, ...survivors].slice(0, groupPlaces);
}

/** How many clubs the league phase is built for, and how many each of them plays. */
export const LEAGUE_PHASE_SIZE = 36;
export const MATCHES_EACH = 8;

/**
 * The league phase draw. The field is split into four pots by strength and every club
 * plays two clubs out of each pot, one at home and one away - so the champions of Spain
 * get two of the other giants whether they want them or not, and a club that came
 * through qualifying is not handed a bracket of clubs its own size.
 *
 * The real draw is a constraint solver run on a computer in Nyon. This is a greedy
 * version of the same idea: serve the club with the most left to fill first, and when
 * the last few cannot be paired legally, take the nearest legal pairing rather than
 * fail. Nobody notices that one club drew Pot 3 twice; everybody notices a competition
 * that could not be drawn.
 */
function drawLeaguePhase(rng: Rng, entrants: string[], strengthOf: (clubId: string) => number): Fixture[] {
  const byStrength = entrants.slice().sort((a, b) => strengthOf(b) - strengthOf(a));
  const size = byStrength.length;
  const perPot = Math.max(1, Math.ceil(size / 4));

  // Seat the field so that neighbours around the circle come from different pots. The
  // draw below pairs clubs by how far apart they are seated, so interleaving the pots is
  // what stops a club drawing eight opponents of its own size.
  const seats: string[] = [];
  for (let i = 0; i < size; i++) {
    const pot = i % 4;
    const place = Math.floor(i / 4);
    const pick = byStrength[pot * perPot + place];
    if (pick) seats.push(pick);
  }
  for (const clubId of byStrength) if (!seats.includes(clubId)) seats.push(clubId);

  // A round-robin circle: one club stays put and the rest rotate around it. Every turn of
  // the circle is a full round of matches with every club playing exactly once, and no two
  // turns repeat a pairing - so eight turns give every club eight different opponents on
  // eight different nights, with nothing left to go wrong.
  const wheel = seats.length - 1;
  const potOfSeat = new Map<string, number>();
  byStrength.forEach((clubId, i) => potOfSeat.set(clubId, Math.min(3, Math.floor(i / perPot))));

  const roundsFor = (turn: number): { a: string; b: string }[] => {
    const pairs: { a: string; b: string }[] = [{ a: seats[wheel]!, b: seats[turn % wheel]! }];
    for (let step = 1; step < Math.ceil(wheel / 2); step++) {
      const one = seats[(turn + step) % wheel]!;
      const two = seats[(turn - step + wheel) % wheel]!;
      if (one !== two) pairs.push({ a: one, b: two });
    }
    return pairs;
  };

  /**
   * Two opponents out of each of the four pots is what the format promises. Which eight
   * turns of the circle are taken decides how close the draw gets to it, so a handful of
   * candidate sets are tried and the most even one is kept. This is the same bargain the
   * real draw makes: a computer tries arrangements until one of them looks fair.
   */
  const evenness = (candidate: number[]): number => {
    const counts = new Map<string, number[]>();
    for (const turn of candidate) {
      for (const pair of roundsFor(turn)) {
        for (const [club, other] of [[pair.a, pair.b], [pair.b, pair.a]] as const) {
          const tally = counts.get(club) ?? [0, 0, 0, 0];
          tally[potOfSeat.get(other) ?? 0]!++;
          counts.set(club, tally);
        }
      }
    }
    let cost = 0;
    for (const tally of counts.values()) cost += Math.max(...tally) - Math.min(...tally);
    return cost;
  };

  let turns = rng.shuffle(Array.from({ length: wheel }, (_, i) => i)).slice(0, LEAGUE_PHASE_WEEKS.length);
  let bestCost = evenness(turns);
  for (let attempt = 0; attempt < 40; attempt++) {
    const candidate = rng.shuffle(Array.from({ length: wheel }, (_, i) => i)).slice(0, LEAGUE_PHASE_WEEKS.length);
    const cost = evenness(candidate);
    if (cost < bestCost) {
      bestCost = cost;
      turns = candidate;
    }
  }

  const rounds = turns.map((turn) => roundsFor(turn));

  // Four at home and four away for everybody, exactly.
  //
  // Every club plays eight matches, and a set of matches where every club has an even
  // number of them can be walked as a closed circuit - in one gate and out of another,
  // never using the same match twice. Walking it and giving each match to whoever the
  // walk arrived from leaves every club hosting exactly half of its matches. No counting,
  // no repairs, no club left with five home nights.
  const pairs = rounds.flatMap((matches, round) => matches.map((pair) => ({ ...pair, round })));
  const gates = new Map<string, number[]>();
  pairs.forEach((pair, i) => {
    for (const clubId of [pair.a, pair.b]) {
      const list = gates.get(clubId);
      if (list) list.push(i);
      else gates.set(clubId, [i]);
    }
  });

  const used = pairs.map(() => false);
  const oriented: { home: string; away: string; round: number }[] = [];

  for (const start of gates.keys()) {
    // Hierholzer, with the stack holding where the walk currently stands.
    const stack: string[] = [start];
    while (stack.length > 0) {
      const here = stack[stack.length - 1]!;
      const gate = (gates.get(here) ?? []).find((i) => !used[i]);
      if (gate === undefined) {
        stack.pop();
        continue;
      }
      used[gate] = true;
      const pair = pairs[gate]!;
      const next = pair.a === here ? pair.b : pair.a;
      // Arrived at `next` from `here`: the club walked into is the one that hosts.
      oriented.push({ home: next, away: here, round: pair.round });
      stack.push(next);
    }
  }

  return oriented
    .map((tie) => ({
      round: tie.round + 1,
      week: LEAGUE_PHASE_WEEKS[tie.round]!,
      homeClubId: tie.home,
      awayClubId: tie.away,
      played: false,
    }))
    .sort((a, b) => a.week - b.week);
}

export function createEuroCompetition(
  rng: Rng,
  id: EuroTier,
  clubIds: string[],
  season: number,
  strengthOf: (clubId: string) => number = () => 50,
): EuroState | null {
  const entrants = rng.shuffle(clubIds.slice()).slice(0, LEAGUE_PHASE_SIZE);
  if (entrants.length < 8) return null;

  const leaguePhase: Record<string, LeagueTableRow> = {};
  for (const clubId of entrants) leaguePhase[clubId] = emptyRow(clubId);

  return {
    id,
    season,
    leaguePhase,
    groups: [],
    fixtures: drawLeaguePhase(rng, entrants, strengthOf),
    ties: [],
    stage: 'group',
    alive: [],
  };
}

function sortGroup(group: EuroGroup): LeagueTableRow[] {
  return Object.values(group.table).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });
}

export function applyEuroResult(state: EuroState, homeClubId: string, awayClubId: string, hg: number, ag: number): void {
  const table =
    state.leaguePhase ??
    state.groups.find((g) => g.clubIds.includes(homeClubId) && g.clubIds.includes(awayClubId))?.table;
  if (!table) return;
  const home = table[homeClubId];
  const away = table[awayClubId];
  if (!home || !away) return;

  home.played++; away.played++;
  home.goalsFor += hg; home.goalsAgainst += ag;
  away.goalsFor += ag; away.goalsAgainst += hg;
  if (hg > ag) { home.won++; away.lost++; home.points += 3; }
  else if (hg < ag) { away.won++; home.lost++; away.points += 3; }
  else { home.drawn++; away.drawn++; home.points++; away.points++; }
}

/** The league phase table, best first. */
export function leaguePhaseTable(state: EuroState): LeagueTableRow[] {
  if (!state.leaguePhase) return [];
  return Object.values(state.leaguePhase).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });
}

/**
 * Out of the league phase. The top eight are in the last sixteen and can spend February
 * watching; ninth to twenty-fourth play off for the other eight places, seeded so that
 * ninth draws twenty-fourth; twenty-fifth and below are out in January with nothing.
 */
export function qualifiersFromLeaguePhase(state: EuroState): { direct: string[]; playoff: string[] } {
  const table = leaguePhaseTable(state);
  const direct = table.slice(0, 8).map((row) => row.clubId);
  const contenders = table.slice(8, 24).map((row) => row.clubId);

  const playoff: string[] = [];
  for (let i = 0; i < Math.floor(contenders.length / 2); i++) {
    playoff.push(contenders[i]!);
    playoff.push(contenders[contenders.length - 1 - i]!);
  }
  return { direct, playoff };
}

/** Who goes through: the top two of every group, seeded winners against runners-up. */
export function qualifiersFromGroups(state: EuroState): string[] {
  const winners: string[] = [];
  const runnersUp: string[] = [];
  for (const group of state.groups) {
    const sorted = sortGroup(group);
    if (sorted[0]) winners.push(sorted[0].clubId);
    if (sorted[1]) runnersUp.push(sorted[1].clubId);
  }
  const bracket: string[] = [];
  for (let i = 0; i < winners.length; i++) {
    bracket.push(winners[i]!);
    // Pair a group winner with a runner-up from a different group.
    bracket.push(runnersUp[(i + 1) % runnersUp.length]!);
  }
  return bracket.filter(Boolean);
}

const NEXT_STAGE: Record<EuroKnockoutStage, EuroKnockoutStage | 'done'> = {
  playoff: 'r16', r16: 'qf', qf: 'sf', sf: 'final', final: 'done',
};

function stageForCount(count: number): EuroKnockoutStage {
  if (count > 16) return 'playoff';
  if (count > 8) return 'r16';
  if (count > 4) return 'qf';
  if (count > 2) return 'sf';
  return 'final';
}

/** Sets up the play-off round, holding the top eight back for the last sixteen. */
export function setPlayoffField(state: EuroState, direct: string[], playoff: string[]): void {
  state.alive = playoff;
  state.seeded = direct;
}

/** Draws the next knockout round for whoever is left. */
export function drawEuroRound(rng: Rng, state: EuroState, forceStage?: EuroKnockoutStage): void {
  const alive = state.alive.slice();
  if (alive.length < 2) {
    state.stage = 'done';
    state.winner = alive[0];
    return;
  }

  // Sixteen clubs can be a play-off round or a last sixteen; only the caller knows which,
  // because the difference is the eight clubs waiting on the other side of it.
  const stage = forceStage ?? stageForCount(alive.length);
  state.stage = stage;
  const weeks = KNOCKOUT_WEEKS[stage];
  const pairs: [string, string][] = [];
  // The play-off and the last sixteen are already seeded by where clubs finished; from
  // the quarter-finals on it is an open draw.
  const pool = stage === 'playoff' || stage === 'r16' ? alive : rng.shuffle(alive);
  for (let i = 0; i + 1 < pool.length; i += 2) pairs.push([pool[i]!, pool[i + 1]!]);

  for (const [a, b] of pairs) {
    if (stage === 'final') {
      state.ties.push({ stage, leg: 1, week: weeks[0]!, homeClubId: a, awayClubId: b, played: false });
    } else {
      state.ties.push({ stage, leg: 1, week: weeks[0]!, homeClubId: b, awayClubId: a, played: false });
      state.ties.push({ stage, leg: 2, week: weeks[1]!, homeClubId: a, awayClubId: b, played: false });
    }
  }
}

/**
 * Settles a round once every tie in it has been played: aggregate over two legs, and
 * a coin toss standing in for extra time and penalties when the aggregate is level.
 */
export function resolveEuroRound(rng: Rng, state: EuroState): void {
  if (state.stage === 'group' || state.stage === 'done') return;
  const stage = state.stage as EuroKnockoutStage;
  const ties = state.ties.filter((t) => t.stage === stage);
  if (ties.length === 0 || !ties.every((t) => t.played)) return;

  const survivors: string[] = [];
  if (stage === 'final') {
    const final = ties[0]!;
    const [hg, ag] = final.result ?? [0, 0];
    const winner = hg === ag ? (rng.chance(0.5) ? final.homeClubId : final.awayClubId) : hg > ag ? final.homeClubId : final.awayClubId;
    state.winner = winner;
    state.alive = [winner];
    state.stage = 'done';
    return;
  }

  const seen = new Set<string>();
  for (const first of ties.filter((t) => t.leg === 1)) {
    const pairKey = [first.homeClubId, first.awayClubId].sort().join('|');
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);
    const second = ties.find(
      (t) => t.leg === 2 && [t.homeClubId, t.awayClubId].sort().join('|') === pairKey,
    );
    const [h1, a1] = first.result ?? [0, 0];
    const [h2, a2] = second?.result ?? [0, 0];
    // first: away side is the seeded club, second: it is at home.
    const seededTotal = a1 + h2;
    const otherTotal = h1 + a2;
    const seeded = first.awayClubId;
    const other = first.homeClubId;
    const winner =
      seededTotal === otherTotal ? (rng.chance(0.55) ? seeded : other) : seededTotal > otherTotal ? seeded : other;
    survivors.push(winner);
  }

  // Whoever survives the play-off joins the eight clubs that finished in the top eight,
  // and the last sixteen is drawn out of the pair of them.
  if (stage === 'playoff' && state.seeded && state.seeded.length > 0) {
    const bracket: string[] = [];
    for (let i = 0; i < state.seeded.length; i++) {
      bracket.push(state.seeded[i]!);
      bracket.push(survivors[survivors.length - 1 - i] ?? survivors[i]!);
    }
    state.alive = bracket.filter(Boolean);
    state.seeded = [];
    drawEuroRound(rng, state);
    return;
  }

  state.alive = survivors;
  const next = NEXT_STAGE[stage];
  if (next === 'done' || survivors.length < 2) {
    state.stage = 'done';
    state.winner = survivors[0];
    return;
  }
  drawEuroRound(rng, state);
}

/** True once the last group match has been played. */
export function groupStageComplete(state: EuroState): boolean {
  return state.stage === 'group' && state.fixtures.every((f) => f.played);
}

/**
 * The clubs that earned a place in Europe for next season, from a league's final
 * table plus the domestic cup winner, who takes a Europa League place.
 */
export function europeanQualifiers(
  order: string[],
  slots: { ucl?: number; uel?: number; uecl?: number } | undefined,
  cupWinner: string | null,
): Record<EuroTier, string[]> {
  const out: Record<EuroTier, string[]> = { ucl: [], uel: [], uecl: [] };
  if (!slots) return out;

  let cursor = 0;
  const take = (count: number): string[] => {
    const picked = order.slice(cursor, cursor + count).filter(Boolean);
    cursor += count;
    return picked;
  };

  out.ucl = take(slots.ucl ?? 0);
  out.uel = take(slots.uel ?? 0);
  out.uecl = take(slots.uecl ?? 0);

  // The cup winner goes into the Europa League unless he is already in Europe.
  if (cupWinner && !out.ucl.includes(cupWinner) && !out.uel.includes(cupWinner) && !out.uecl.includes(cupWinner)) {
    if ((slots.uel ?? 0) > 0) out.uel.push(cupWinner);
    else if ((slots.uecl ?? 0) > 0) out.uecl.push(cupWinner);
  }
  return out;
}

/** Prize money, which is most of the reason a smaller club wants a European run. */
export function euroPrize(tier: EuroTier, stage: EuroStage, champion: boolean): number {
  const base: Record<EuroTier, number> = { ucl: 18_000_000, uel: 5_000_000, uecl: 2_000_000 };
  const multiplier: Record<EuroStage, number> = {
    qualifying: 0.35, group: 1, playoff: 1.25, r16: 1.5, qf: 2.1, sf: 2.9, final: 3.6, done: 3.6,
  };
  return Math.round(base[tier] * multiplier[stage] * (champion ? 1.35 : 1));
}

export function euroClubStrength(club: Club): number {
  return club.strength;
}
