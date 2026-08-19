import { Rng, clamp, hashString, randomSeed } from './rng.js';
import { FORMATIONS, overall, positionGroup, ratingAt } from './positions.js';
import { indexPack, type DataPack, type PackIndex } from './data.js';
import {
  clubBaseOvr,
  createUserPlayer,
  generatePlayer,
  generateSquad,
  starToPlayer,
  type UserPlayerInput,
} from './generate.js';
import {
  developWeek,
  driftPotential,
  updateCondition,
  updateForm,
} from './development.js';
import { isAvailable, pickBestLineup, resolveMinutes, type SelectionContext } from './selection.js';
import {
  clubRating,
  simulateQuickResult,
  simulateUserMatch,
  teamRatingFromSquad,
} from './match.js';
import {
  FIRST_MATCH_WEEK,
  LAST_MATCH_WEEK,
  WEEKS_PER_SEASON,
  applyResult,
  driftClubStrength,
  initCompetitionSeason,
  positionOf,
  resolveSeasonEnd,
  sortedTable,
  type SeasonEndOutcome,
} from './league.js';
import { createCup, drawRound, isCupFinal, isCupSemi, recordTieResult, type CupState } from './cup.js';
import {
  applyEuroResult,
  createEuroCompetition,
  drawEuroRound,
  euroPrize,
  europeanQualifiers,
  groupStageComplete,
  qualifiersFromGroups,
  resolveEuroRound,
  EURO_TIERS,
  type EuroState,
  type EuroTier,
} from './europe.js';
import { isInjured, rollInjury, tickInjuries, trainingInjuryChance } from './injury.js';
import { marketValue } from './value.js';
import { decideAwards, awardFame, awardReputation, type AwardResult } from './awards.js';
import { playTournament, tournamentFame, tournamentFor } from './tournament.js';
import { generateAgentOffers } from './agents.js';
import { generateLoanOffers, generateOffers, isTransferWindow, renewalIntent, expectedMinutesFor } from './transfer.js';
import {
  INTERNATIONAL_WEEKS,
  commitToCountry,
  initNationalTeam,
  levelForAge,
  rollCallUp,
  simulateInternationalMatch,
  updateNationalInterest,
} from './national.js';
import { pickEvent, toPendingDecision, type EventContext } from './events.js';
import {
  adjustRelationship,
  availableActions,
  driftRelationships,
  evaluateConsequences,
  initRelationships,
  isFrozenOut,
  performAction,
  track,
  type PlayerActionId,
} from './social.js';
import type {
  Achievement,
  Agent,
  AppliedChange,
  DecisionResult,
  PendingDecision,
  CareerSeasonRecord,
  CareerState,
  Club,
  Competition,
  Contract,
  InboxMessage,
  MatchImportance,
  MatchResult,
  NewsItem,
  Player,
  SeasonStats,
  SquadRole,
  TickResult,
  TransferOffer,
  CompetitionSeasonState,} from './types.js';

export const SCHEMA_VERSION = 1;
export const GAME_VERSION = '0.1.0';

export function emptySeasonStats(season: number, clubId: string | null, competitionId: string | null): SeasonStats {
  return {
    season,
    clubId,
    competitionId,
    apps: 0,
    starts: 0,
    subApps: 0,
    minutes: 0,
    goals: 0,
    assists: 0,
    cleanSheets: 0,
    yellowCards: 0,
    redCards: 0,
    motm: 0,
    ratingSum: 0,
    ratedApps: 0,
  };
}

export interface CreateCareerInput extends UserPlayerInput {
  /** Country whose pyramid the career starts in. */
  startCountry: string;
  seed?: number;
}

export function createCareer(pack: DataPack, input: CreateCareerInput): { state: CareerState; index: PackIndex } {
  const index = indexPack(pack);
  const seed = input.seed ?? randomSeed();
  const rng = new Rng(seed);
  const season = pack.season;

  const player = createUserPlayer(rng, input, season, 55);

  const state: CareerState = {
    schemaVersion: SCHEMA_VERSION,
    gameVersion: GAME_VERSION,
    careerSeed: seed,
    rngState: rng.getState(),
    createdAt: new Date(0).toISOString(),
    savedAt: new Date(0).toISOString(),
    player,
    contract: null,
    agent: null,
    agentOffers: [],
    training: { intensity: 'normal', focus: 'balanced', diet: 'normal' },
    managerTrust: 45,
    relationships: initRelationships(),
    socialActions: { used: 0, perWeek: 2 },
    lastResult: null,
    world: {
      season,
      week: 1,
      clubs: Object.fromEntries(pack.clubs.map((c) => [c.id, { ...c, prestige: c.reputation }])),
      competitions: {},
      squads: {},
      players: {},
      seasonStats: {},
      cups: {},
      history: { champions: [], topScorers: [], cupWinners: [] },
    },
    nationalTeam: initNationalTeam(player),
    seasonHistory: [],
    matchLog: [],
    lastMatch: null,
    trophies: [],
    inbox: [],
    news: [],
    achievements: [],
    pendingDecisions: [],
    transferOffers: [],
    eventCooldowns: {},
    firedOnceEvents: [],
    finances: { balance: 0, careerEarnings: 0 },
    marketValue: 0,
    retired: false,
    flags: { startCountry: input.startCountry, seasonStartOvr: overall(player.attributes, player.primaryPos, player.secondaryPos) },
  };

  initSeason(state, index, rng);
  state.rngState = rng.getState();
  return { state, index };
}

function initSeason(state: CareerState, index: PackIndex, rng: Rng): void {
  const season = state.world.season;
  state.world.competitions = {};
  for (const comp of index.pack.competitions) {
    if (comp.type !== 'league') continue;
    const clubIds = Object.values(state.world.clubs)
      .filter((c) => c.competitionId === comp.id)
      .map((c) => c.id);
    if (clubIds.length < 4) continue;
    state.world.competitions[comp.id] = initCompetitionSeason(rng, comp, clubIds, season);
  }

  state.world.cups = {};
  for (const country of index.pack.countries) {
    const clubs = Object.values(state.world.clubs).filter((c) => c.country === country.code);
    if (clubs.length < 8) continue;
    const cup = createCup(rng, country.code, clubs, season);
    drawRound(rng, cup);
    state.world.cups[cup.id] = cup;
  }

  initEurope(state, rng);
}

/**
 * Sets up the European competitions from whoever qualified last season. In the very
 * first season there is no table to read yet, so the entrants are the strongest clubs
 * in each country - which is, near enough, who would have qualified anyway.
 */
function initEurope(state: CareerState, rng: Rng): void {
  const season = state.world.season;
  const qualified = state.world.europeNext ?? defaultEuropeanEntrants(state);
  state.world.europe = {};

  for (const tier of EURO_TIERS) {
    const clubIds = (qualified[tier] ?? []).filter((id) => state.world.clubs[id]);
    const competition = createEuroCompetition(rng, tier, clubIds, season);
    if (competition) state.world.europe[tier] = competition;
  }
  state.world.europeNext = undefined;
}

/** First season only: seed Europe with the best clubs of every top division. */
function defaultEuropeanEntrants(state: CareerState): Record<string, string[]> {
  const byCountry = new Map<string, Club[]>();
  for (const club of Object.values(state.world.clubs)) {
    if (club.tier !== 1) continue;
    const list = byCountry.get(club.country) ?? [];
    list.push(club);
    byCountry.set(club.country, list);
  }

  const out: Record<string, string[]> = { ucl: [], uel: [], uecl: [] };
  for (const clubs of byCountry.values()) {
    const ranked = clubs.sort((a, b) => b.strength - a.strength);
    out.ucl!.push(...ranked.slice(0, 3).map((c) => c.id));
    out.uel!.push(...ranked.slice(3, 5).map((c) => c.id));
    out.uecl!.push(...ranked.slice(5, 7).map((c) => c.id));
  }
  return out;
}

export interface AcademyOffer {
  clubId: string;
  clubName: string;
  competitionId: string;
  tier: number;
  academyStars: number;       // 1-5
  developmentQuality: number; // 0-100
  competitionForPlace: number;// 0-100
  firstTeamChance: number;    // 0-100
  reputation: number;
}

/** Five academies to choose between: the first real trade-off of the career. */
export function getAcademyOffers(state: CareerState, index: PackIndex, count = 5): AcademyOffer[] {
  const rng = rngFrom(state, 'academy');
  const country = String(state.flags['startCountry'] ?? index.pack.countries[0]!.code);
  const clubs = Object.values(state.world.clubs).filter((c) => c.country === country);
  if (clubs.length === 0) return [];

  const byBand: Club[][] = [[], [], [], [], []];
  for (const club of clubs) {
    const band = club.reputation >= 80 ? 0 : club.reputation >= 62 ? 1 : club.reputation >= 45 ? 2 : club.reputation >= 30 ? 3 : 4;
    byBand[band]!.push(club);
  }

  const picks: Club[] = [];
  for (const band of byBand) {
    if (picks.length >= count) break;
    if (band.length === 0) continue;
    picks.push(rng.pick(band));
  }
  while (picks.length < count && clubs.length > picks.length) {
    const candidate = rng.pick(clubs);
    if (!picks.some((p) => p.id === candidate.id)) picks.push(candidate);
  }

  return picks.map((club) => {
    const level = clubBaseOvr(club);
    const competitionForPlace = clamp(Math.round(level * 1.05), 10, 99);
    const firstTeamChance = clamp(Math.round(100 - level * 1.05 + (100 - club.reputation) * 0.25), 3, 96);
    return {
      clubId: club.id,
      clubName: club.name,
      competitionId: club.competitionId,
      tier: club.tier,
      academyStars: clamp(Math.round(club.academy / 20), 1, 5),
      developmentQuality: Math.round(club.academy * 0.6 + club.training * 0.4),
      competitionForPlace,
      firstTeamChance,
      reputation: club.reputation,
    };
  });
}

function rngFrom(state: CareerState, label: string): Rng {
  return new Rng(state.careerSeed).fork(`${label}:${state.world.season}:${state.world.week}`);
}

function mainRng(state: CareerState): Rng {
  return Rng.fromState(state.rngState);
}

function commitRng(state: CareerState, rng: Rng): void {
  state.rngState = rng.getState();
}

/** Attach the player to a club, generate the squads we model, and write a contract. */
export function joinClub(
  state: CareerState,
  index: PackIndex,
  clubId: string,
  opts: { asAcademy?: boolean; salary?: number; years?: number; role?: SquadRole; isLoan?: boolean; parentClubId?: string } = {},
): void {
  const rng = mainRng(state);
  const club = state.world.clubs[clubId];
  if (!club) throw new Error(`joinClub: unknown club ${clubId}`);

  state.player.clubId = clubId;
  state.player.squadRole = opts.role ?? (opts.asAcademy ? 'academy' : 'rotation');

  const season = state.world.season;
  const age = season - state.player.birthYear;
  const comp = index.competitionById.get(club.competitionId);

  state.contract = {
    clubId,
    salaryPerWeek: opts.salary ?? (opts.asAcademy ? 200 : 1500),
    startSeason: season,
    endSeason: season + (opts.years ?? (opts.asAcademy ? 3 : 3)),
    squadRole: state.player.squadRole,
    signingBonus: 0,
    appearanceBonus: Math.round((opts.salary ?? 500) * 0.2),
    goalBonus: Math.round((opts.salary ?? 500) * 0.3),
    releaseClause: null,
    ...(opts.isLoan ? { isLoan: true, parentClubId: opts.parentClubId } : {}),
  };

  // A club that signs you as a key player already believes in you; a club that signs
  // you as a squad filler does not. That belief is where manager trust starts.
  const roleTrust: Record<string, number> = {
    academy: 42, futureProspect: 40, prospect: 44, fringe: 32, bench: 38,
    rotation: 46, starter: 55, important: 62, key: 70, star: 78,
  };
  state.managerTrust = clamp((roleTrust[state.player.squadRole] ?? 45) + rng.int(-5, 6), 15, 88);
  state.relationships.manager = state.managerTrust;
  // A new dressing room and a new crowd start from scratch.
  state.relationships.teammates = clamp(48 + rng.int(-8, 8), 20, 70);
  state.relationships.fans = clamp(50 + rng.int(-6, 10), 25, 75);
  state.relationships.board = clamp(52 + rng.int(-6, 8), 25, 78);
  state.flags['transferListed'] = false;
  state.flags['replacementSought'] = false;
  state.flags['benchedUntilWeek'] = 0;
  state.flags['droppedNotified'] = false;
  ensureModelledSquads(state, index, rng);

  // Season stats survive a mid-season move: the season is the season, wherever it was played.
  const existing = state.world.seasonStats[state.player.id];
  if (!existing || existing.season !== season) {
    state.world.seasonStats[state.player.id] = emptySeasonStats(season, clubId, comp?.id ?? null);
  } else {
    existing.clubId = clubId;
    existing.competitionId = comp?.id ?? null;
  }
  state.flags['lastTransferWeek'] = season * 52 + state.world.week;
  // Two clubs a season is the cap, the way registration rules work in real football.
  const movedIn = Number(state.flags['movesSeason'] ?? -1) === season
    ? Number(state.flags['movesThisSeason'] ?? 0)
    : 0;
  state.flags['movesSeason'] = season;
  state.flags['movesThisSeason'] = movedIn + 1;
  commitRng(state, rng);

  pushNews(state, 'news.joinedClub', { club: club.name }, 'medium');
  if (age <= 17) pushInbox(state, 'club', 'inbox.welcomeAcademy', { club: club.name });
}

/**
 * We only model the squads that matter: the user's club in full, plus the named
 * stars of every club in the user's league so the scoring charts stay believable.
 */
export function ensureModelledSquads(state: CareerState, index: PackIndex, rng: Rng): void {
  const clubId = state.player.clubId;
  if (!clubId) return;
  const club = state.world.clubs[clubId];
  if (!club) return;

  const keep = new Set<string>();
  const season = state.world.season;

  if (!state.world.squads[clubId] || state.world.squads[clubId]!.length < 18) {
    const stars = index.starsByClub.get(clubId) ?? [];
    const squad = generateSquad(rng, { club, season, index, stars });
    state.world.squads[clubId] = squad.map((p) => p.id);
    for (const p of squad) state.world.players[p.id] = p;
  }
  keep.add(clubId);

  const rivals = Object.values(state.world.clubs).filter((c) => c.competitionId === club.competitionId && c.id !== clubId);
  for (const rival of rivals) {
    keep.add(rival.id);
    if (state.world.squads[rival.id]) continue;
    const stars = index.starsByClub.get(rival.id) ?? [];
    const players: Player[] = [];
    for (const star of stars.slice(0, 8)) {
      players.push(starToPlayer(rng, index, star, season, rival));
    }
    const base = clubBaseOvr(rival);
    const positions = ['ST', 'CF', 'RW', 'LW', 'CAM', 'CM', 'CB', 'GK'] as const;
    for (let i = players.length; i < 8; i++) {
      players.push(
        generatePlayer(rng, index, {
          clubId: rival.id,
          pos: positions[i % positions.length]!,
          age: rng.int(20, 31),
          targetOvr: clamp(Math.round(base + rng.gaussIn(0, 3, -6, 6)), 25, 95),
          season,
          countryCode: rival.country,
          squadRole: 'starter',
        }),
      );
    }
    state.world.squads[rival.id] = players.map((p) => p.id);
    for (const p of players) state.world.players[p.id] = p;
  }

  // Drop squads we no longer need so a 20-season save doesn't accumulate thousands of players.
  for (const id of Object.keys(state.world.squads)) {
    if (keep.has(id)) continue;
    for (const pid of state.world.squads[id] ?? []) {
      if (pid !== state.player.id) delete state.world.players[pid];
    }
    delete state.world.squads[id];
  }
}

/** Which inbox folder a consequence belongs in. */
function consequenceCategory(id: string): InboxMessage['category'] {
  if (id.startsWith('fans')) return 'media';
  if (id.startsWith('board') || id === 'transferListed' || id === 'offTransferList' || id === 'clubSeeksReplacement') return 'club';
  if (id === 'injuryPickedUp') return 'medical';
  if (id === 'dressingRoomFallout') return 'personal';
  return 'manager';
}

function pushNews(state: CareerState, key: string, args: Record<string, string | number>, importance: NewsItem['importance']): void {
  state.news.unshift({ season: state.world.season, week: state.world.week, key, args, importance });
  if (state.news.length > 60) state.news.length = 60;
}

function pushInbox(
  state: CareerState,
  category: InboxMessage['category'],
  titleKey: string,
  args?: Record<string, string | number>,
  decisionId?: string,
): void {
  state.inbox.unshift({
    id: `msg_${state.world.season}_${state.world.week}_${state.inbox.length}`,
    season: state.world.season,
    week: state.world.week,
    category,
    titleKey,
    ...(args ? { args } : {}),
    read: false,
    ...(decisionId ? { decisionId } : {}),
  });
  if (state.inbox.length > 80) state.inbox.length = 80;
}

function unlock(state: CareerState, id: string, args?: Record<string, string | number>): void {
  if (state.achievements.some((a) => a.id === id)) return;
  const achievement: Achievement = { id, season: state.world.season, ...(args ? { args } : {}) };
  state.achievements.push(achievement);
  pushNews(state, `achievement.${id}`, args ?? {}, 'medium');
}

export function userClub(state: CareerState): Club | null {
  return state.player.clubId ? state.world.clubs[state.player.clubId] ?? null : null;
}

export function userCompetition(state: CareerState, index: PackIndex): Competition | null {
  const club = userClub(state);
  if (!club) return null;
  return index.competitionById.get(club.competitionId) ?? null;
}

export function userSquad(state: CareerState): Player[] {
  const clubId = state.player.clubId;
  if (!clubId) return [];
  const ids = state.world.squads[clubId] ?? [];
  const squad = ids.map((id) => state.world.players[id]).filter((p): p is Player => !!p);
  if (!isAcademyPlayer(state) && !squad.some((p) => p.id === state.player.id)) squad.push(state.player);
  return squad;
}

/** Academy players train and play youth football; they are not in the senior squad yet. */
export function isAcademyPlayer(state: CareerState): boolean {
  return state.player.squadRole === 'academy';
}

/** Each club sticks to a formation, so a CAM at a 4-3-3 club has a real problem. */
export function clubFormation(club: Club): string {
  const names = Object.keys(FORMATIONS);
  return names[hashString(club.id) % names.length]!;
}

export function minutesPct(state: CareerState): number {
  const stats = state.world.seasonStats[state.player.id];
  if (!stats) return 0;
  const club = userClub(state);
  const played = club ? state.world.competitions[club.competitionId]?.table[club.id]?.played ?? 0 : 0;
  if (played === 0) return 0;
  return clamp(stats.minutes / (played * 90), 0, 1);
}

/** One week of career time. Stops early when something needs the player's input. */
export function advanceWeek(state: CareerState, index: PackIndex): TickResult {
  const log: string[] = [];
  if (state.retired) return { state, stopped: 'retired', log };

  const rng = mainRng(state);
  const week = state.world.week;
  const season = state.world.season;
  const player = state.player;
  const club = userClub(state);
  let stopped: TickResult['stopped'] = 'week';
  let playedThisWeek = 0;

  // 0a. The week before a big one starts on the Monday.
  announceBigMatch(state, index);

  // 0. Nothing waits for ever. A club that hears nothing back signs someone else and
  // an agent stops calling, otherwise unanswered approaches pile up and quietly choke
  // off every other event in the game.
  expireDecisions(state);

  // 1. Domestic and international fixtures.
  const userMatch = simulateWeekFixtures(state, index, rng, club);
  if (userMatch) {
    playedThisWeek += userMatch.userLine?.minutes ?? 0;
    stopped = 'match';
    log.push(`match ${userMatch.homeClubId} ${userMatch.homeGoals}-${userMatch.awayGoals} ${userMatch.awayClubId}`);
  }

  // 2. Training, condition, development.
  const comp = userCompetition(state, index);
  // An academy player is playing youth football we don't simulate match by match,
  // but he is playing: development must not treat him as a benched senior.
  const developmentMinutes = isAcademyPlayer(state) ? 0.68 : minutesPct(state);
  const trainingCtx = {
    training: state.training,
    coachQuality: club?.training ?? 45,
    facilities: club?.academy ?? 45,
    minutesPct: developmentMinutes,
    competitiveLevel: comp?.reputation ?? 35,
    inSeason: week >= FIRST_MATCH_WEEK && week <= LAST_MATCH_WEEK,
  };
  updateCondition(player, state.training, playedThisWeek);
  const dev = developWeek(rng, player, season, trainingCtx);
  if (Math.round(dev.ovrAfter) > Math.round(dev.ovrBefore)) {
    log.push(`ovr ${dev.ovrBefore} -> ${dev.ovrAfter}`);
  }

  // 3. Injuries.
  const healed = tickInjuries(player);
  for (const injury of healed) {
    pushInbox(state, 'medical', 'inbox.injuryHealed', { type: `injury.${injury.type}` });
  }
  if (!isInjured(player) && rng.chance(trainingInjuryChance(player, state.training, season))) {
    const injury = rollInjury(rng, player, season);
    player.condition.injuries.push(injury);
    pushInbox(state, 'medical', 'inbox.injuredTraining', { type: `injury.${injury.type}`, weeks: injury.weeksOut });
    pushNews(state, 'news.injured', { weeks: injury.weeksOut }, 'high');
  }

  // 4. Wages.
  if (state.contract) {
    state.finances.balance += state.contract.salaryPerWeek;
    state.finances.careerEarnings += state.contract.salaryPerWeek;
  }

  // 5. National team.
  if (INTERNATIONAL_WEEKS.includes(week) && club) {
    handleInternationalWeek(state, index, rng, club);
  }

  // 6. Transfer window activity. A player who just moved is not on the market again
  // a fortnight later, so interest only builds up after he has settled.
  const weeksSinceTransfer = season * 52 + week - Number(state.flags['lastTransferWeek'] ?? 0);
  const settled = weeksSinceTransfer >= 20;
  const listed = Boolean(state.flags['transferListed']);
  // Clubs come once per window, not every fortnight, and nobody plays for three clubs
  // in one season: two moves is the limit, the way registration rules work.
  const windowId = `${season}:${week < 20 ? 'summer' : 'winter'}`;
  const approachedThisWindow = state.flags['offerWindow'] === windowId;
  const movesThisSeason = Number(state.flags['movesThisSeason'] ?? 0);
  const offerChance = listed ? 0.5 : state.flags['transferRequested'] ? 0.42 : 0.28;

  if (
    isTransferWindow(week) &&
    club &&
    settled &&
    !approachedThisWindow &&
    movesThisSeason < 2 &&
    state.transferOffers.length === 0 &&
    rng.chance(offerChance)
  ) {
    const share = minutesPct(state);
    // A young player who cannot get on the pitch is offered a loan instead of a move.
    const loans = generateLoanOffers({ state, index, rng, minutesPct: share });
    const offers = loans.length > 0 && rng.chance(0.7)
      ? loans
      : generateOffers({ state, index, rng, minutesPct: share });
    if (offers.length > 0) {
      state.flags['offerWindow'] = windowId;
      state.transferOffers = offers;
      openOfferDecision(state, offers);
      pushNews(state, 'news.transferInterest', { club: state.world.clubs[offers[0]!.clubId]?.name ?? '' }, 'medium');
    }
  }

  // 7. Agent offers early in the career.
  if (!state.agent && state.agentOffers.length === 0 && player.reputation >= 10 && rng.chance(0.25)) {
    const ovr = overall(player.attributes, player.primaryPos, player.secondaryPos);
    state.agentOffers = generateAgentOffers(rng, index, player, ovr, season - player.birthYear);
    if (state.agentOffers.length > 0) openAgentDecision(state, state.agentOffers);
  }

  // 8. Career events. Only another event blocks one: a transfer approach sitting on
  // the table should not stop the rest of his life happening.
  const eventPending = state.pendingDecisions.some((d) => d.kind === 'event');
  if (!eventPending && rng.chance(0.22)) {
    const ctx = buildEventContext(state, index);
    const def = pickEvent(rng, index.pack.events, ctx, state);
    if (def) {
      const decision = toPendingDecision(def, ctx.absoluteWeek);
      state.pendingDecisions.push(decision);
      pushInbox(state, def.category === 'media' ? 'media' : def.category, def.textKey, undefined, decision.id);
      stopped = 'decision';
    }
  } else if (state.pendingDecisions.length > 0) {
    stopped = 'decision';
  }

  // 9. The people around him react to the week just played.
  state.socialActions.used = 0;
  driftMorale(state);
  const weekRatings = state.matchLog
    .filter((m) => m.season === season && m.userLine?.played)
    .slice(0, 3)
    .map((m) => m.userLine!.rating);
  driftRelationships(rng, state, {
    minutesPct: minutesPct(state),
    recentRating: weekRatings.length > 0 ? weekRatings.reduce((a, b) => a + b, 0) / weekRatings.length : null,
    played: playedThisWeek > 0,
  });
  for (const consequence of evaluateConsequences(rng, state)) {
    pushInbox(state, consequenceCategory(consequence.id), `consequence.${consequence.id}`, consequence.args);
    pushNews(state, `consequence.${consequence.id}`, consequence.args ?? {}, 'medium');
  }

  // 10. Form and market value.
  const recentRatings = state.matchLog
    .filter((m) => m.userLine?.played && m.season === season)
    .slice(0, 5)
    .map((m) => m.userLine!.rating);
  updateForm(player, recentRatings);
  state.marketValue = marketValue(player, {
    season,
    leagueReputation: comp?.reputation ?? 35,
    contract: state.contract,
    internationalCaps: state.nationalTeam.caps,
  });

  // 11. Advance the clock.
  state.world.week += 1;
  if (state.world.week > WEEKS_PER_SEASON) {
    endSeason(state, index, rng);
    stopped = state.retired ? 'retired' : 'seasonEnd';
  }

  commitRng(state, rng);
  state.savedAt = new Date(0).toISOString();
  return { state, stopped, log };
}

/**
 * Morale settles back toward where his life actually is. Without this a spell on the
 * bench drives it to zero and it can never climb out, which is not how a footballer
 * works: a run in the team, the crowd back onside, or simply time, all pull him back
 * up. Sustained problems still keep him low - the weekly hits are bigger than the pull.
 */
function driftMorale(state: CareerState): void {
  const player = state.player;
  const rel = state.relationships;
  const target = clamp(
    46 + (player.form - 50) * 0.35 + (rel.teammates - 50) * 0.16 + (rel.fans - 50) * 0.12 + (rel.manager - 50) * 0.14,
    18,
    92,
  );
  player.morale = clamp(player.morale + (target - player.morale) * 0.14, 0, 100);
}

function buildEventContext(state: CareerState, index: PackIndex): EventContext {
  const club = userClub(state);
  const player = state.player;
  return {
    age: state.world.season - player.birthYear,
    absoluteWeek: state.world.season * 52 + state.world.week,
    seasonWeek: state.world.week,
    minutesPct: minutesPct(state),
    squadRole: player.squadRole,
    ovr: overall(player.attributes, player.primaryPos, player.secondaryPos),
    morale: player.morale,
    managerTrust: state.managerTrust,
    hasAgent: state.agent !== null,
    injured: isInjured(player),
    tier: club?.tier ?? 3,
    contractYearsLeft: state.contract ? state.contract.endSeason - state.world.season : null,
  };
}

/** Play every fixture scheduled this week, in the right level of detail. */

/**
 * What kind of afternoon this is. A derby, a title decider or a six-pointer at the
 * bottom is not the same game as a Tuesday against mid-table, and the player feels it
 * before kick-off, during it, and in the rating afterwards.
 */

/**
 * The build-up. When the next fixture is a derby, a title decider or a European night,
 * the player hears about it before he plays it - which is most of what makes those
 * weeks different from the other thirty.
 */
function announceBigMatch(state: CareerState, index: PackIndex): void {
  const club = userClub(state);
  if (!club) return;
  const week = state.world.week;

  const compState = state.world.competitions[club.competitionId];
  const fixture = compState?.fixtures.find(
    (f) => !f.played && f.week === week && (f.homeClubId === club.id || f.awayClubId === club.id),
  );
  if (!fixture) return;

  const importance = matchImportanceFor(state, index, club.competitionId, fixture.homeClubId, fixture.awayClubId);
  if (importance === 'normal') return;

  const announced = `bigMatch:${state.world.season}:${week}`;
  if (state.flags['lastBigMatch'] === announced) return;
  state.flags['lastBigMatch'] = announced;

  const opponentId = fixture.homeClubId === club.id ? fixture.awayClubId : fixture.homeClubId;
  const opponent = state.world.clubs[opponentId];
  pushInbox(state, 'club', `inbox.buildUp.${importance}`, { opponent: opponent?.name ?? '' });
  pushNews(state, `news.buildUp.${importance}`, { club: club.name, opponent: opponent?.name ?? '' }, 'high');
}

function matchImportanceFor(
  state: CareerState,
  index: PackIndex,
  competitionId: string,
  homeClubId: string,
  awayClubId: string,
): MatchImportance {
  const club = userClub(state);
  if (!club) return 'normal';
  const opponentId = homeClubId === club.id ? awayClubId : homeClubId;
  const opponent = state.world.clubs[opponentId];
  if (!opponent) return 'normal';

  // His first ever senior appearance is its own occasion.
  const played = state.seasonHistory.reduce((sum, record) => sum + record.apps, 0)
    + (state.world.seasonStats[state.player.id]?.apps ?? 0);
  if (played === 0) return 'firstProMatch';

  if (club.rivals?.includes(opponentId)) {
    return club.city && opponent.city && club.city === opponent.city ? 'derby' : 'rival';
  }

  const compState = state.world.competitions[competitionId];
  if (compState && state.world.week >= 30) {
    const rows = sortedTable(compState);
    const mine = rows.findIndex((row) => row.clubId === club.id);
    const theirs = rows.findIndex((row) => row.clubId === opponentId);
    if (mine >= 0 && theirs >= 0) {
      if (mine < 3 && theirs < 3) return 'titleDecider';
      if (mine >= rows.length - 4 && theirs >= rows.length - 4) return 'relegationSixPointer';
    }
  }

  return 'normal';
}

/** How much louder the ground is, and how much more it costs to get it wrong. */
export function importanceWeight(importance: MatchImportance): number {
  switch (importance) {
    case 'cupFinal': return 1.6;
    case 'titleDecider': return 1.5;
    case 'derby': return 1.4;
    case 'europeanNight': return 1.35;
    case 'cupSemi': return 1.3;
    case 'rival': return 1.25;
    case 'relegationSixPointer': return 1.25;
    case 'firstProMatch': return 1.2;
    case 'debut': return 1.2;
    default: return 1;
  }
}

function simulateWeekFixtures(state: CareerState, index: PackIndex, rng: Rng, club: Club | null): MatchResult | null {
  const week = state.world.week;
  const userCompId = club?.competitionId ?? null;
  let userResult: MatchResult | null = null;

  for (const compState of Object.values(state.world.competitions)) {
    const competition = index.competitionById.get(compState.competitionId);
    if (!competition) continue;
    const isUserComp = compState.competitionId === userCompId;

    for (const fixture of compState.fixtures) {
      if (fixture.played || fixture.week !== week) continue;

      const involvesUser = club !== null && (fixture.homeClubId === club.id || fixture.awayClubId === club.id);
      if (involvesUser) {
        const importance = matchImportanceFor(state, index, competition.id, fixture.homeClubId, fixture.awayClubId);
        const result = playUserMatch(state, index, rng, fixture.homeClubId, fixture.awayClubId, competition.id, importance);
        fixture.played = true;
        fixture.result = [result.homeGoals, result.awayGoals];
        applyResult(compState, fixture.homeClubId, fixture.awayClubId, result.homeGoals, result.awayGoals);
        attributeGoals(state, rng, compState, fixture.homeClubId, result.homeGoals, result);
        attributeGoals(state, rng, compState, fixture.awayClubId, result.awayGoals, result);
        userResult = result;
        continue;
      }

      const home = state.world.clubs[fixture.homeClubId];
      const away = state.world.clubs[fixture.awayClubId];
      if (!home || !away) continue;
      const [hg, ag] = simulateQuickResult(rng, { homeRating: clubRating(home), awayRating: clubRating(away) });
      fixture.played = true;
      fixture.result = [hg, ag];
      applyResult(compState, fixture.homeClubId, fixture.awayClubId, hg, ag);

      if (isUserComp) {
        attributeGoals(state, rng, compState, fixture.homeClubId, hg, null);
        attributeGoals(state, rng, compState, fixture.awayClubId, ag, null);
        attributeCards(state, rng, compState, fixture.homeClubId);
        attributeCards(state, rng, compState, fixture.awayClubId);
      }
    }
  }

  const cupResult = simulateCupWeek(state, index, rng, club);
  const euroResult = simulateEuroWeek(state, index, rng, club);
  // A European night is the match of the week when there is one.
  return euroResult ?? userResult ?? cupResult;
}

/**
 * The midweek. Group games first, then the knockout ties, and when a round is fully
 * played the next one is drawn - so the bracket unfolds while the season runs rather
 * than being decided up front.
 */
function simulateEuroWeek(state: CareerState, index: PackIndex, rng: Rng, club: Club | null): MatchResult | null {
  const europe = state.world.europe;
  if (!europe) return null;
  const week = state.world.week;
  let userResult: MatchResult | null = null;

  for (const competition of Object.values(europe)) {
    if (isFinished(competition)) continue;

    if (isGroupStage(competition)) {
      for (const fixture of competition.fixtures) {
        if (fixture.played || fixture.week !== week) continue;
        const home = state.world.clubs[fixture.homeClubId];
        const away = state.world.clubs[fixture.awayClubId];
        if (!home || !away) { fixture.played = true; continue; }

        if (club && (fixture.homeClubId === club.id || fixture.awayClubId === club.id)) {
          const result = playUserMatch(state, index, rng, fixture.homeClubId, fixture.awayClubId, competition.id, 'europeanNight');
          fixture.played = true;
          fixture.result = [result.homeGoals, result.awayGoals];
          applyEuroResult(competition, fixture.homeClubId, fixture.awayClubId, result.homeGoals, result.awayGoals);
          userResult = result;
          continue;
        }

        const [hg, ag] = simulateQuickResult(rng, { homeRating: clubRating(home), awayRating: clubRating(away) });
        fixture.played = true;
        fixture.result = [hg, ag];
        applyEuroResult(competition, fixture.homeClubId, fixture.awayClubId, hg, ag);
      }

      if (groupStageComplete(competition)) {
        competition.alive = qualifiersFromGroups(competition);
        payEuroPrize(state, competition, 'group');
        drawEuroRound(rng, competition);
      }
      continue;
    }

    for (const tie of competition.ties) {
      if (tie.played || tie.week !== week) continue;
      const home = state.world.clubs[tie.homeClubId];
      const away = state.world.clubs[tie.awayClubId];
      if (!home || !away) { tie.played = true; continue; }

      if (club && (tie.homeClubId === club.id || tie.awayClubId === club.id)) {
        const importance: MatchImportance = tie.stage === 'final' ? 'cupFinal' : tie.stage === 'sf' ? 'cupSemi' : 'europeanNight';
        const result = playUserMatch(state, index, rng, tie.homeClubId, tie.awayClubId, competition.id, importance);
        tie.played = true;
        tie.result = [result.homeGoals, result.awayGoals];
        userResult = result;
        continue;
      }

      const [hg, ag] = simulateQuickResult(rng, { homeRating: clubRating(home), awayRating: clubRating(away) });
      tie.played = true;
      tie.result = [hg, ag];
    }

    const stageBefore: EuroState['stage'] = competition.stage;
    resolveEuroRound(rng, competition);
    // Read it back through the wider type: resolveEuroRound can end the competition.
    const stageAfter: EuroState['stage'] = competition.stage;
    if (stageAfter !== stageBefore) {
      payEuroPrize(state, competition, stageBefore);
      if (stageAfter === 'done' && competition.winner) {
        recordEuroWin(state, competition);
      }
    }
  }

  return userResult;
}

/** Read through a function so the compiler keeps the full stage type in the loop. */
function isFinished(competition: EuroState): boolean {
  return competition.stage === 'done';
}

/** A type guard, so the compiler does not decide the stage can never end. */
function isGroupStage(competition: EuroState): boolean {
  return competition.stage === 'group';
}

/** Money for the run, which is what a European place is worth to a club. */
function payEuroPrize(state: CareerState, competition: EuroState, stage: EuroState['stage']): void {
  const club = userClub(state);
  if (!club || !competition.alive.includes(club.id)) return;
  // Club money is modelled as wage power, so a European run raises what the club can
  // pay and what it is worth rather than crediting a transfer kitty it does not have.
  const share = euroPrize(competition.id, stage, false) / 40_000_000;
  club.finances = clamp(club.finances + share * 4, 0, 100);
  club.reputation = clamp(club.reputation + share, 0, 100);
}

function recordEuroWin(state: CareerState, competition: EuroState): void {
  const winner = competition.winner!;
  const history = state.world.history;
  history.europeanWinners = history.europeanWinners ?? [];
  history.europeanWinners.push({ season: competition.season, tier: competition.id, clubId: winner });

  const club = userClub(state);
  if (club && club.id === winner) {
    state.trophies.push({ season: competition.season, competitionId: competition.id, kind: 'cup' });
    unlock(state, 'europeanTrophy', { competition: competition.id });
    pushNews(state, `news.europe.${competition.id}Won`, { club: club.name }, 'high');
    state.player.fame = clamp(state.player.fame + (competition.id === 'ucl' ? 12 : competition.id === 'uel' ? 7 : 4), 0, 100);
  }
}


/** One booking, on the chart. */
function addCard(compState: CompetitionSeasonState, playerId: string, kind: 'yellow' | 'red'): void {
  compState.cards = compState.cards ?? {};
  const entry = compState.cards[playerId] ?? { yellow: 0, red: 0 };
  entry[kind] += 1;
  compState.cards[playerId] = entry;
}

/**
 * Bookings for the matches we only simulate as a scoreline. A referee gives out three
 * or four cards in a normal game; without this the discipline chart would only ever
 * contain the user.
 */
function attributeCards(state: CareerState, rng: Rng, compState: CompetitionSeasonState, clubId: string): void {
  const squad = (state.world.squads[clubId] ?? [])
    .map((id) => state.world.players[id])
    .filter((p): p is Player => !!p);
  if (squad.length === 0) return;

  const count = rng.int(0, 3);
  for (let i = 0; i < count; i++) {
    const booked = rng.weighted(squad, (p) => {
      const group = positionGroup(p.primaryPos);
      const base = group === 'DEF' ? 1 : group === 'MID' ? 0.9 : group === 'ATT' ? 0.5 : 0.15;
      return base * (1.4 - p.personality.discipline / 100);
    });
    if (!booked) continue;
    addCard(compState, booked.id, rng.chance(0.05) ? 'red' : 'yellow');
  }
}

/** Spread a club's goals across its modelled players so the scoring charts mean something. */
function attributeGoals(
  state: CareerState,
  rng: Rng,
  compState: CompetitionSeasonState,
  clubId: string,
  goals: number,
  userMatch: MatchResult | null,
): void {
  if (goals <= 0) return;

  if (userMatch && clubId === state.player.clubId) {
    for (const event of userMatch.events ?? []) {
      if (event.type === 'goal' && event.playerId) {
        compState.scorers[event.playerId] = (compState.scorers[event.playerId] ?? 0) + 1;
      }
      if (event.type === 'assist' && event.playerId) {
        compState.assists = compState.assists ?? {};
        compState.assists[event.playerId] = (compState.assists[event.playerId] ?? 0) + 1;
      }
      if ((event.type === 'yellow' || event.type === 'red') && event.playerId) {
        addCard(compState, event.playerId, event.type === 'red' ? 'red' : 'yellow');
      }
    }
    return;
  }

  const squad = (state.world.squads[clubId] ?? [])
    .map((id) => state.world.players[id])
    .filter((p): p is Player => !!p);
  if (squad.length === 0) return;

  for (let i = 0; i < goals; i++) {
    const scorer = rng.weighted(squad, (p) => {
      const group = p.primaryPos;
      const base = group === 'ST' || group === 'CF' ? 1 : group === 'RW' || group === 'LW' || group === 'CAM' ? 0.6 : group === 'GK' ? 0.001 : 0.2;
      return base * (ratingAt(p.attributes, p.primaryPos) / 60);
    });
    if (!scorer) continue;
    compState.scorers[scorer.id] = (compState.scorers[scorer.id] ?? 0) + 1;

    // Most goals are made by someone. Creators are weighted the way the match engine
    // weights them, so the assist chart reads like the scoring chart's other half.
    if (rng.chance(0.66)) {
      const creators = squad.filter((p) => p.id !== scorer.id);
      const creator = rng.weighted(creators, (p) => {
        const pos = p.primaryPos;
        const base = pos === 'CAM' || pos === 'RW' || pos === 'LW' || pos === 'RM' || pos === 'LM' ? 1
          : pos === 'CM' || pos === 'CF' || pos === 'ST' ? 0.7
          : pos === 'GK' ? 0.01 : 0.3;
        return base * ((p.attributes.vision + p.attributes.passing + p.attributes.crossing) / 200);
      });
      if (creator) {
        compState.assists = compState.assists ?? {};
        compState.assists[creator.id] = (compState.assists[creator.id] ?? 0) + 1;
      }
    }
  }
}

function simulateCupWeek(state: CareerState, index: PackIndex, rng: Rng, club: Club | null): MatchResult | null {
  const week = state.world.week;
  let userResult: MatchResult | null = null;

  for (const cup of Object.values(state.world.cups)) {
    if (cup.finished) continue;
    const ties = cup.ties.filter((t) => !t.played && t.week === week);
    if (ties.length === 0) continue;

    for (const tie of ties) {
      const home = state.world.clubs[tie.homeClubId];
      const away = state.world.clubs[tie.awayClubId];
      if (!home || !away) continue;

      const involvesUser = club !== null && (tie.homeClubId === club.id || tie.awayClubId === club.id);
      if (involvesUser) {
        const importance: MatchImportance = isCupFinal(cup, tie) ? 'cupFinal' : isCupSemi(cup, tie) ? 'cupSemi' : 'normal';
        const result = playUserMatch(state, index, rng, tie.homeClubId, tie.awayClubId, cup.id, importance);
        recordTieResult(cup, tie, result.homeGoals, result.awayGoals, rng);
        userResult = result;
        if (importance === 'cupFinal' && club && tie.winner === club.id) {
          state.trophies.push({ season: state.world.season, competitionId: cup.id, kind: 'cup' });
          unlock(state, 'cupWinner', { cup: cup.id });
          pushNews(state, 'news.cupWon', { club: club.name }, 'high');
        }
      } else {
        const [hg, ag] = simulateQuickResult(rng, { homeRating: clubRating(home), awayRating: clubRating(away) });
        recordTieResult(cup, tie, hg, ag, rng);
      }
    }

    // Draw the next round once every tie in this round is settled.
    const currentRoundTies = cup.ties.filter((t) => t.round === cup.round);
    if (currentRoundTies.every((t) => t.played) && cup.alive.length > 1) {
      drawRound(rng, cup);
    } else if (currentRoundTies.every((t) => t.played) && cup.alive.length === 1) {
      cup.finished = true;
      cup.winner = cup.alive[0]!;
      state.world.history.cupWinners.push({ season: cup.season, cupId: cup.id, clubId: cup.winner });
    }
  }

  return userResult;
}

function playUserMatch(
  state: CareerState,
  index: PackIndex,
  rng: Rng,
  homeClubId: string,
  awayClubId: string,
  competitionId: string,
  importance: MatchImportance,
): MatchResult {
  const club = userClub(state)!;
  const player = state.player;
  const squad = userSquad(state);
  const userIsHome = homeClubId === club.id;
  const opponentId = userIsHome ? awayClubId : homeClubId;
  const opponent = state.world.clubs[opponentId]!;

  const suspension = player.condition.suspensions.find((s) => s.competitionId === competitionId && s.matchesRemaining > 0);
  // A manager who has fallen out with him simply leaves him out for a while.
  const available = isAvailable(player) && !suspension && !isAcademyPlayer(state) && !isFrozenOut(state);

  const rotationPressure = clamp(state.matchLog.filter((m) => m.season === state.world.season && m.week >= state.world.week - 2).length / 3, 0, 1);
  const selectionCtx: SelectionContext = {
    formation: clubFormation(club),
    managerTrust: state.managerTrust,
    userId: player.id,
    rotationPressure,
    importantMatch: importance !== 'normal',
  };

  const lineup = pickBestLineup(rng, squad.filter((p) => p.id !== player.id || available), selectionCtx);
  const minutes = available
    ? resolveMinutes(rng, player.id, lineup, player)
    : { played: false, started: false, minutes: 0, slot: null };

  const opponentStarIds = state.world.squads[opponentId] ?? [];
  const opponentStars = opponentStarIds.map((id) => state.world.players[id]).filter((p): p is Player => !!p);
  const opponentRating = opponentStars.length >= 8 ? teamRatingFromSquad(opponentStars) : clubRating(opponent);

  const outcome = simulateUserMatch(rng, {
    mental: mentalFactor(state) * occasionFactor(state, importance),
    season: state.world.season,
    week: state.world.week,
    competitionId,
    homeClub: state.world.clubs[homeClubId]!,
    awayClub: state.world.clubs[awayClubId]!,
    userIsHome,
    userClubSquad: squad,
    opponentStars,
    opponentRating,
    user: player,
    lineup,
    minutes,
    importance,
    matchId: `m_${state.world.season}_${state.world.week}_${homeClubId}_${awayClubId}`,
  });

  const result = outcome.result;
  if (!available) {
    result.userLine!.reasonNotPlayed = suspension
      ? 'suspended'
      : isInjured(player)
        ? 'injured'
        : isAcademyPlayer(state)
          ? 'notInSquad'
          : 'notSelected';
  }

  // Suspensions tick down on matches the player was banned for.
  if (suspension) {
    suspension.matchesRemaining -= 1;
    player.condition.suspensions = player.condition.suspensions.filter((s) => s.matchesRemaining > 0);
  }

  applyMatchToPlayer(state, index, rng, result, competitionId, outcome.injuryRolled);

  state.lastMatch = result;
  state.matchLog.unshift(result);
  // A full season of fixtures plus a cup run, so the results page can show them all.
  if (state.matchLog.length > 140) state.matchLog.length = 140;

  return result;
}

/**
 * Everything he carries onto the pitch that is not ability: morale, sharpness, the
 * crowd, the dressing room, and whether he is fighting with the manager. Returns a
 * multiplier around 1, so a settled player plays to his level and an unsettled one
 * does not.
 */
/**
 * What a big night does to him before he has touched the ball. A crowd behind a player
 * who can handle it is worth something real; the same crowd on a player who cannot,
 * or one the fans have turned on, is worth the same amount the other way.
 */
export function occasionFactor(state: CareerState, importance: MatchImportance): number {
  const weight = importanceWeight(importance) - 1;
  if (weight <= 0) return 1;
  const player = state.player;
  const nerve = (player.personality.pressureHandling - 50) / 50;       // -1 .. 1
  const crowd = (state.relationships.fans - 50) / 50;
  const swing = (nerve * 0.6 + crowd * 0.4) * weight * 0.5;
  return clamp(1 + swing, 0.78, 1.22);
}

export function mentalFactor(state: CareerState): number {
  const player = state.player;
  const rel = state.relationships;

  const morale = (player.morale - 55) / 220;          // +/- 0.2
  const sharpness = (player.condition.sharpness - 60) / 320;
  const fans = (rel.fans - 50) / 400;
  const dressingRoom = (rel.teammates - 50) / 500;
  const manager = (rel.manager - 45) / 600;
  const pressure = (player.personality.pressureHandling - 50) / 700;
  const fatigue = -player.condition.fatigue / 500;

  return clamp(1 + morale + sharpness + fans + dressingRoom + manager + pressure + fatigue, 0.72, 1.2);
}

function applyMatchToPlayer(
  state: CareerState,
  index: PackIndex,
  rng: Rng,
  result: MatchResult,
  competitionId: string,
  injuryRolled: boolean,
): void {
  const line = result.userLine;
  if (!line) return;
  const player = state.player;
  const stats = state.world.seasonStats[player.id] ?? emptySeasonStats(state.world.season, player.clubId, competitionId);
  state.world.seasonStats[player.id] = stats;

  if (line.played) {
    stats.apps++;
    if (line.started) stats.starts++;
    else stats.subApps++;
    stats.minutes += line.minutes;
    stats.goals += line.goals;
    stats.assists += line.assists;
    stats.yellowCards += line.yellow;
    stats.redCards += line.red;
    stats.ratingSum += line.rating;
    stats.ratedApps++;
    if (line.motm) stats.motm++;

    // Manager trust follows performance, weighted by how much of the game he played.
    const weight = clamp(line.minutes / 90, 0.2, 1);
    const delta = ((line.rating - 6.6) * 2.2 + (line.motm ? 2 : 0)) * weight - line.red * 6;
    state.managerTrust = clamp(state.managerTrust + delta * 0.5, 0, 100);
    state.relationships.manager = state.managerTrust;
    player.morale = clamp(player.morale + (line.rating - 6.4) * 1.6, 0, 100);
    player.reputation = clamp(player.reputation + line.goals * 0.35 + line.assists * 0.2 + (line.motm ? 0.5 : 0), 0, 100);
    player.fame = clamp(player.fame + line.goals * 0.4 + (line.motm ? 0.6 : 0), 0, 100);

    if (stats.goals >= 1 && !state.achievements.some((a) => a.id === 'firstGoal')) unlock(state, 'firstGoal');
    if (line.goals >= 3) unlock(state, 'hatTrick');
    if (stats.apps === 1) unlock(state, 'debut');

    // Cards and suspensions, using the competition's own rules.
    const competition = index.competitionById.get(competitionId);
    const rules = competition?.cards ?? { yellowSuspensionThreshold: 5, resetAfterMatchday: 0, secondYellowSuspension: 1, redSuspension: 3 };
    if (line.yellow > 0) {
      const running = (player.condition.yellowCards[competitionId] ?? 0) + line.yellow;
      player.condition.yellowCards[competitionId] = running;
      if (running >= rules.yellowSuspensionThreshold) {
        player.condition.yellowCards[competitionId] = 0;
        player.condition.suspensions.push({ matchesRemaining: 1, reason: 'yellowAccumulation', competitionId });
        pushInbox(state, 'club', 'inbox.suspendedYellows', { matches: 1 });
      }
    }
    if (line.red > 0) {
      const matches = line.yellow >= 2 ? rules.secondYellowSuspension : rules.redSuspension;
      player.condition.suspensions.push({
        matchesRemaining: matches,
        reason: line.yellow >= 2 ? 'secondYellow' : 'redCard',
        competitionId,
      });
      pushInbox(state, 'club', 'inbox.suspendedRed', { matches });
    }

    if (injuryRolled) {
      const injury = rollInjury(rng, player, state.world.season, 1.2);
      player.condition.injuries.push(injury);
      pushInbox(state, 'medical', 'inbox.injuredMatch', { type: `injury.${injury.type}`, weeks: injury.weeksOut });
    }

    if (line.goals > 0) {
      pushNews(state, 'news.scored', { goals: line.goals }, line.goals >= 2 ? 'high' : 'low');
      if (state.contract) state.finances.balance += state.contract.goalBonus * line.goals;
    }
    if (state.contract) state.finances.balance += state.contract.appearanceBonus;
  } else {
    // Sitting out hurts morale, more so for players who expect to play.
    const expected = expectedMinutesFor(player.squadRole);
    player.morale = clamp(player.morale - expected * 3.5, 0, 100);
  }
}

function handleInternationalWeek(state: CareerState, index: PackIndex, rng: Rng, club: Club): void {
  const player = state.player;
  const season = state.world.season;
  const age = season - player.birthYear;
  const comp = index.competitionById.get(club.competitionId);

  updateNationalInterest({
    player,
    age,
    season,
    minutesPct: minutesPct(state),
    clubReputation: club.reputation,
    leagueReputation: comp?.reputation ?? 35,
    index,
    nt: state.nationalTeam,
  });

  if (isInjured(player)) return;

  const callUp = rollCallUp(rng, {
    player,
    age,
    season,
    minutesPct: minutesPct(state),
    clubReputation: club.reputation,
    leagueReputation: comp?.reputation ?? 35,
    index,
    nt: state.nationalTeam,
  });
  if (!callUp) return;

  const country = index.countryByCode.get(callUp.countryCode);
  if (!country) return;

  const nt = state.nationalTeam;
  nt.level = callUp.level;
  nt.callUpHistory.push({ season, level: callUp.level, countryCode: callUp.countryCode });

  if (callUp.isFirst) {
    pushInbox(state, 'national', 'inbox.firstCallUp', { country: country.name, level: callUp.level });
    unlock(state, 'firstCallUp', { country: country.name });
  }

  const matches = rng.int(1, 2);
  for (let i = 0; i < matches; i++) {
    const outcome = simulateInternationalMatch(rng, player, callUp.level, country.reputation);
    if (!outcome.played) continue;
    if (callUp.isSenior) {
      nt.caps++;
      nt.goals += outcome.goals;
      if (!nt.capturedBySenior) {
        commitToCountry(nt, callUp.countryCode);
        unlock(state, 'internationalDebut', { country: country.name });
        pushNews(state, 'news.internationalDebut', { country: country.name }, 'high');
      }
      if (nt.caps === 50) unlock(state, 'caps50');
      if (nt.caps === 100) unlock(state, 'caps100');
    }
    player.reputation = clamp(player.reputation + 0.6 + outcome.goals * 0.8, 0, 100);
    player.fame = clamp(player.fame + 0.8 + outcome.goals * 1.1, 0, 100);
    player.condition.fatigue = clamp(player.condition.fatigue + outcome.minutes / 9, 0, 100);
  }
}

/** Season rollover: tables settle, contracts run out, everyone gets a year older. */
function endSeason(state: CareerState, index: PackIndex, rng: Rng): void {
  const season = state.world.season;
  const player = state.player;
  const club = userClub(state);
  const stats = state.world.seasonStats[player.id] ?? emptySeasonStats(season, player.clubId, club?.competitionId ?? null);
  const ovrEnd = overall(player.attributes, player.primaryPos, player.secondaryPos);
  const ovrStart = Number(state.flags['seasonStartOvr'] ?? ovrEnd);

  // Competitions. Capture the league the player finished the season in before
  // promotion and relegation start moving clubs between divisions.
  const userCompetitionId = club?.competitionId ?? null;
  const outcomes = new Map<string, SeasonEndOutcome>();
  let leaguePosition: number | null = null;
  const trophies: string[] = [];
  for (const compState of Object.values(state.world.competitions)) {
    const competition = index.competitionById.get(compState.competitionId);
    if (!competition) continue;
    const outcome = resolveSeasonEnd(compState, competition);
    outcomes.set(compState.competitionId, outcome);
    if (outcome.champion) {
      state.world.history.champions.push({ season, competitionId: compState.competitionId, clubId: outcome.champion });
      if (club && outcome.champion === club.id) {
        trophies.push(compState.competitionId);
        state.trophies.push({ season, competitionId: compState.competitionId, kind: 'league' });
        unlock(state, 'leagueChampion', { competition: compState.competitionId });
        pushNews(state, 'news.leagueWon', { club: club.name }, 'high');
      }
    }

    const topScorer = Object.entries(compState.scorers).sort((a, b) => b[1] - a[1])[0];
    if (topScorer) {
      state.world.history.topScorers.push({
        season,
        competitionId: compState.competitionId,
        playerId: topScorer[0],
        goals: topScorer[1],
      });
      if (topScorer[0] === player.id) unlock(state, 'goldenBoot', { goals: topScorer[1] });
    }

    if (club && compState.competitionId === userCompetitionId) {
      leaguePosition = positionOf(compState, club.id);
    }

    const table = sortedTable(compState);
    table.forEach((row, i) => {
      const c = state.world.clubs[row.clubId];
      if (c) driftClubStrength(rng, c, table.length > 1 ? i / (table.length - 1) : 0.5);
    });
  }

  // Who plays in Europe next season, decided from the final tables before promotion
  // and relegation shuffle anybody between divisions.
  decideEuropeanQualification(state, index);

  applyPromotionRelegation(state, index, outcomes);

  // The summer: a World Cup or a Euro, if his country is at one and he is in the squad.
  playSummerTournament(state, index, rng);

  // Individual honours, decided before the world ages and the season rolls over.
  applyAwards(state, index, rng);

  // Career record for the season.
  const record: CareerSeasonRecord = {
    ...stats,
    age: season - player.birthYear,
    ovrStart,
    ovrEnd,
    valueStart: state.seasonHistory.at(-1)?.valueEnd ?? 0,
    valueEnd: state.marketValue,
    leaguePosition,
    trophies,
    ...(state.contract?.isLoan && state.contract.parentClubId ? { onLoanFrom: state.contract.parentClubId } : {}),
  };
  state.seasonHistory.push(record);

  // Potential drift on the back of the season just played. A handful of cameos is
  // a small sample, so ratings only count for as much as the minutes justify.
  const expectedMinutes = expectedMinutesFor(player.squadRole);
  const actualMinutes = isAcademyPlayer(state) ? 0.6 : minutesPct(state);
  const avgRating = stats.ratedApps > 0 ? stats.ratingSum / stats.ratedApps : 6.6;
  const sampleWeight = clamp(stats.apps / 15, 0, 1);
  const performanceScore = clamp(
    (actualMinutes - expectedMinutes) * 1.6 + (avgRating - 6.6) * 0.9 * sampleWeight,
    -1,
    1,
  );
  driftPotential(rng, player, season, performanceScore);
  updateSquadRole(state, rng, actualMinutes);

  // A club does not keep a fit senior who never plays: after a season in the stands
  // he is told he can find somewhere else, which is what opens the door to a move.
  const seniorAge = season - player.birthYear;
  if (club && seniorAge >= 22 && actualMinutes < 0.15 && !isAcademyPlayer(state) && !state.contract?.isLoan) {
    if (!state.flags['transferListed']) {
      state.flags['transferListed'] = true;
      pushInbox(state, 'club', 'inbox.freeToLeave', { club: club.name });
      pushNews(state, 'news.freeToLeave', { club: club.name }, 'medium');
    }
  }
  updateStanding(state, index, actualMinutes);

  // Age the modelled world and develop it a season's worth.
  advanceModelledPlayers(state, index, rng);

  // Contracts.
  handleContractEnd(state, index, rng, performanceScore, actualMinutes);

  // Achievements based on career totals.
  const careerApps = state.seasonHistory.reduce((s, r) => s + r.apps, 0);
  const careerGoals = state.seasonHistory.reduce((s, r) => s + r.goals, 0);
  if (careerApps >= 100) unlock(state, 'apps100');
  if (careerApps >= 500) unlock(state, 'apps500');
  if (careerGoals >= 100) unlock(state, 'goals100');

  // Roll the clock forward.
  state.world.season += 1;
  state.world.week = 1;
  state.flags['movesThisSeason'] = 0;
  state.flags['offerWindow'] = '';
  state.world.seasonStats = {};
  player.condition.yellowCards = {};
  player.condition.suspensions = [];
  state.transferOffers = [];
  initSeason(state, index, rng);
  ensureModelledSquads(state, index, rng);
  state.world.seasonStats[player.id] = emptySeasonStats(state.world.season, player.clubId, userClub(state)?.competitionId ?? null);
  state.flags['seasonStartOvr'] = overall(player.attributes, player.primaryPos, player.secondaryPos);

  checkRetirement(state, rng);
}

/**
 * Where the player stands in the squad now. Academy players get promoted once they
 * are close enough to the first team's level, or once they are simply too old for
 * youth football - and a club that rates them will push them up sooner.
 */
function updateSquadRole(state: CareerState, rng: Rng, actualMinutes: number): void {
  const player = state.player;
  const club = userClub(state);
  if (!club) return;
  const season = state.world.season;
  const age = season - player.birthYear;
  const ovr = overall(player.attributes, player.primaryPos, player.secondaryPos);
  const level = clubBaseOvr(club);
  const gap = ovr - level;

  if (player.squadRole === 'academy') {
    const readyOnMerit = gap >= -12 && age >= 16;
    const tooOld = age >= 19;
    if (readyOnMerit || tooOld || rng.chance(0.15)) {
      player.squadRole = gap >= -4 ? 'prospect' : 'futureProspect';
      state.managerTrust = clamp(state.managerTrust + 6, 0, 100);
      pushInbox(state, 'club', 'inbox.promotedToFirstTeam', { club: club.name });
      pushNews(state, 'news.promotedToFirstTeam', { club: club.name }, 'high');
      unlock(state, 'firstTeamSquad', { club: club.name });
    }
    return;
  }

  // Senior squad: role follows what he is actually worth to this club.
  const earned: SquadRole =
    gap >= 8 ? 'star'
    : gap >= 4 ? 'key'
    : gap >= 1 ? 'important'
    : gap >= -3 ? 'starter'
    : gap >= -7 ? 'rotation'
    : gap >= -11 ? 'bench'
    : age <= 21 ? 'prospect' : 'fringe';

  // Minutes actually played pull the label toward reality.
  const playedALot = actualMinutes > 0.6;
  const playedLittle = actualMinutes < 0.15;
  const order = SQUAD_ROLE_ORDER;
  let idx = order.indexOf(earned);
  if (playedALot) idx = Math.min(order.length - 1, idx + 1);
  if (playedLittle && idx > 0) idx -= 1;
  player.squadRole = order[idx]!;
  if (state.contract) state.contract.squadRole = player.squadRole;
}

/**
 * Reputation and fame settle toward what a season of this quality, at this level,
 * with this many minutes, is worth. Playing regularly in a good league is what makes
 * scouts and supporters know your name - not the rating on your profile page.
 */
function updateStanding(state: CareerState, index: PackIndex, actualMinutes: number): void {
  const player = state.player;
  const club = userClub(state);
  const comp = club ? index.competitionById.get(club.competitionId) : undefined;
  const leagueRep = comp?.reputation ?? 30;
  const ovr = overall(player.attributes, player.primaryPos, player.secondaryPos);

  const repTarget = clamp(
    ovr * 0.7 * (0.7 + leagueRep / 180) + actualMinutes * 8 + state.nationalTeam.caps * 0.2,
    1,
    99,
  );
  player.reputation = clamp(player.reputation + (repTarget - player.reputation) * 0.35, 1, 100);

  const stats = state.world.seasonStats[player.id];
  const goalContribution = stats ? stats.goals + stats.assists : 0;
  const fameTarget = clamp(
    player.reputation * 0.85 + goalContribution * 0.6 + state.trophies.length * 1.5 + state.nationalTeam.caps * 0.25,
    1,
    99,
  );
  player.fame = clamp(player.fame + (fameTarget - player.fame) * 0.25, 1, 100);
}

const SQUAD_ROLE_ORDER: SquadRole[] = [
  'fringe', 'futureProspect', 'prospect', 'bench', 'rotation', 'starter', 'important', 'key', 'star',
];

/**
 * Move clubs between divisions. Promotion and relegation are applied as an exchange
 * between two divisions, never independently: if they were applied separately, any
 * mismatch in the counts would slowly inflate one division and starve another until
 * a league had fifty clubs in it.
 */

/**
 * Reads every top division's final table, hands out the continental places it is
 * entitled to, and gives the domestic cup winner a Europa League place. The result
 * is stored for the next season's draw.
 */

/**
 * Hands out the season's individual awards and records what they did to the player:
 * a trophy in the cabinet if he won one, a note if he was only shortlisted, and the
 * fame that comes with being talked about at all.
 */

/**
 * The tournament at the end of the season. He has to be a senior international with a
 * national side that qualified - which is decided the same way a call-up is, from how
 * much he plays and at what level - and then the country goes as far as it goes.
 */
function playSummerTournament(state: CareerState, index: PackIndex, rng: Rng): void {
  const player = state.player;
  const nt = state.nationalTeam;
  const season = state.world.season;
  const id = tournamentFor(season);
  if (!id) return;
  if (nt.level !== 'senior' || !nt.countryCode) return;

  const country = index.countryByCode.get(nt.countryCode);
  if (!country) return;

  // Qualifying: the bigger nations are almost always there, the smaller ones are not.
  const qualifyOdds = clamp(0.2 + (country.reputation - 55) / 70, 0.1, 0.95);
  if (!rng.chance(qualifyOdds)) {
    pushInbox(state, 'national', `inbox.tournament.missed.${id}`, { country: country.name });
    return;
  }

  const result = playTournament(rng, id, player, country.code, country.reputation, season, minutesPct(state));
  state.tournaments = state.tournaments ?? [];
  state.tournaments.push(result);

  nt.caps += result.caps;
  nt.goals += result.goals;
  player.fame = clamp(player.fame + tournamentFame(result), 0, 100);
  player.reputation = clamp(player.reputation + tournamentFame(result) * 0.35, 0, 100);

  pushNews(state, `news.tournament.${result.finish}`, { country: country.name, tournament: id }, 'high');
  pushInbox(state, 'national', `inbox.tournament.${result.finish}`, {
    country: country.name,
    caps: result.caps,
    goals: result.goals,
  });

  if (result.finish === 'winner') {
    unlock(state, id === 'worldCup' ? 'wonWorldCup' : 'wonEuros', { country: country.name });
    state.trophies.push({ season, competitionId: id, kind: 'cup' });
  }
}

function applyAwards(state: CareerState, index: PackIndex, rng: Rng): void {
  const season = state.world.season;
  const results: AwardResult[] = decideAwards(rng, state, index);
  const history = state.world.history;
  history.awards = history.awards ?? [];

  for (const result of results) {
    history.awards.push({
      season,
      award: result.award,
      playerId: result.playerId,
      playerName: result.playerName,
      ...(result.detail !== undefined ? { detail: result.detail } : {}),
    });

    const isUser = result.playerId === state.player.id;
    const shortlisted = result.shortlist.includes(state.player.id);

    if (isUser) {
      state.awards = state.awards ?? [];
      state.awards.push({
        season,
        award: result.award,
        ...(result.competitionId ? { competitionId: result.competitionId } : {}),
        ...(result.detail !== undefined ? { detail: result.detail } : {}),
      });
      state.player.fame = clamp(state.player.fame + awardFame(result.award), 0, 100);
      state.player.reputation = clamp(state.player.reputation + awardReputation(result.award), 0, 100);
      state.player.morale = clamp(state.player.morale + 6, 0, 100);
      unlock(state, `award.${result.award}`, result.detail !== undefined ? { detail: result.detail } : undefined);
      pushNews(state, `news.award.${result.award}`, { player: `${state.player.firstName} ${state.player.lastName}` }, 'high');
      pushInbox(state, 'media', `inbox.award.${result.award}`, result.detail !== undefined ? { detail: result.detail } : undefined);
    } else if (shortlisted) {
      state.awardNominations = state.awardNominations ?? [];
      state.awardNominations.push({ season, award: result.award });
      state.player.fame = clamp(state.player.fame + awardFame(result.award) * 0.25, 0, 100);
      pushInbox(state, 'media', `inbox.awardShortlist.${result.award}`);
    }
  }
}

function decideEuropeanQualification(state: CareerState, index: PackIndex): void {
  const next: Record<string, string[]> = { ucl: [], uel: [], uecl: [] };

  for (const compState of Object.values(state.world.competitions)) {
    const competition = index.competitionById.get(compState.competitionId);
    if (!competition?.europeanSlots) continue;

    const order = sortedTable(compState).map((row) => row.clubId);
    const cup = Object.values(state.world.cups).find((c) => c.country === competition.country);
    const cupWinner = cup?.winner ?? null;
    const qualified = europeanQualifiers(order, competition.europeanSlots, cupWinner);
    for (const tier of EURO_TIERS) next[tier]!.push(...qualified[tier]);
  }

  // The holders are in next season's competition whatever they did at home.
  for (const competition of Object.values(state.world.europe ?? {})) {
    if (!competition.winner) continue;
    const tier: EuroTier = competition.id === 'ucl' ? 'ucl' : 'ucl';
    if (!next[tier]!.includes(competition.winner)) next[tier]!.push(competition.winner);
  }

  state.world.europeNext = next;
}

function applyPromotionRelegation(
  state: CareerState,
  index: PackIndex,
  outcomes: Map<string, SeasonEndOutcome>,
): void {
  for (const [competitionId, outcome] of outcomes) {
    const competition = index.competitionById.get(competitionId);
    const downTo = competition?.relegation?.to;
    if (!competition || !downTo) continue;

    const lower = index.competitionById.get(downTo);
    const lowerOutcome = outcomes.get(downTo);
    if (!lower || !lowerOutcome) continue;

    const exchange = Math.min(outcome.relegated.length, lowerOutcome.promoted.length);
    if (exchange === 0) continue;

    for (let i = 0; i < exchange; i++) {
      const goingDown = state.world.clubs[outcome.relegated[i]!];
      const comingUp = state.world.clubs[lowerOutcome.promoted[i]!];
      if (!goingDown || !comingUp) continue;

      goingDown.competitionId = lower.id;
      goingDown.tier = lower.tier;
      comingUp.competitionId = competition.id;
      comingUp.tier = competition.tier;

      if (comingUp.id === state.player.clubId) {
        state.trophies.push({ season: state.world.season, competitionId: downTo, kind: 'promotion' });
        unlock(state, 'promotion', { competition: competition.id });
        pushNews(state, 'news.promoted', { club: comingUp.name, competition: competition.id }, 'high');
      }
      if (goingDown.id === state.player.clubId) {
        pushNews(state, 'news.relegated', { club: goingDown.name, competition: lower.id }, 'high');
      }
    }
  }
}

/** AI players age, develop, and eventually get replaced by academy graduates. */
function advanceModelledPlayers(state: CareerState, index: PackIndex, rng: Rng): void {
  const season = state.world.season;
  for (const [clubId, ids] of Object.entries(state.world.squads)) {
    const club = state.world.clubs[clubId];
    if (!club) continue;
    const replacements: string[] = [];

    for (const id of ids) {
      const p = state.world.players[id];
      if (!p || p.isUser) continue;
      const age = season - p.birthYear;

      if (age >= 34 && rng.chance((age - 33) * 0.28)) {
        // Retire and replace with a younger player at a similar level - except once in
        // a while, when a club that has no business producing one produces a player
        // far better than the level around him. Rare, and the reason scouts exist.
        delete state.world.players[id];
        const generational = rng.chance(0.02);
        const target = generational
          ? clamp(Math.round(clubBaseOvr(club) + rng.range(8, 18)), 40, 95)
          : clamp(Math.round(clubBaseOvr(club) + rng.gaussIn(-2, 3, -8, 6)), 25, 92);
        const fresh = generatePlayer(rng, index, {
          clubId,
          pos: p.primaryPos,
          age: generational ? rng.int(17, 20) : rng.int(18, 24),
          targetOvr: target,
          ...(generational ? { potential: clamp(target + rng.int(6, 16), target, 99) } : {}),
          season,
          countryCode: rng.chance(0.7) ? club.country : p.birthCountry,
          squadRole: p.squadRole,
        });
        state.world.players[fresh.id] = fresh;
        replacements.push(fresh.id);
        continue;
      }

      // A season of development, applied in one coarse pass.
      const estMinutes = clamp(0.25 + (ratingAt(p.attributes, p.primaryPos) - clubBaseOvr(club)) / 25, 0.05, 0.95);
      for (let w = 0; w < 30; w++) {
        developWeek(rng, p, season, {
          training: { intensity: 'normal', focus: 'balanced', diet: 'professional' },
          coachQuality: club.training,
          facilities: club.academy,
          minutesPct: estMinutes,
          competitiveLevel: index.competitionById.get(club.competitionId)?.reputation ?? 40,
          inSeason: true,
        });
      }
      replacements.push(id);
    }
    state.world.squads[clubId] = replacements;
  }
}

function handleContractEnd(
  state: CareerState,
  index: PackIndex,
  rng: Rng,
  performanceScore: number,
  actualMinutes: number,
): void {
  const contract = state.contract;
  const player = state.player;
  const season = state.world.season;
  if (!contract) return;

  const club = state.world.clubs[contract.clubId];
  if (!club) return;

  // Loans always end at the season boundary.
  if (contract.isLoan && contract.parentClubId) {
    const parent = state.world.clubs[contract.parentClubId];
    if (parent) {
      player.clubId = parent.id;
      state.contract = {
        clubId: parent.id,
        salaryPerWeek: contract.salaryPerWeek,
        startSeason: season + 1,
        endSeason: season + 2,
        squadRole: 'rotation',
        signingBonus: 0,
        appearanceBonus: contract.appearanceBonus,
        goalBonus: contract.goalBonus,
        releaseClause: null,
      };
      player.squadRole = 'rotation';
      pushInbox(state, 'club', 'inbox.loanEnded', { club: parent.name });
    }
    return;
  }

  const yearsLeft = contract.endSeason - season;
  if (yearsLeft > 0) return;

  const ovr = overall(player.attributes, player.primaryPos, player.secondaryPos);
  const intent = renewalIntent(rng, ovr, clubBaseOvr(club), season - player.birthYear, actualMinutes, state.managerTrust);

  if (intent === 'extend') {
    const comp = index.competitionById.get(club.competitionId);
    const raise = 1 + clamp(performanceScore, -0.2, 0.8);
    state.contract = {
      ...contract,
      salaryPerWeek: Math.round(contract.salaryPerWeek * raise * rng.range(1.05, 1.4)),
      startSeason: season + 1,
      endSeason: season + rng.int(2, 4),
      squadRole: player.squadRole,
    };
    pushInbox(state, 'club', 'inbox.contractExtended', { club: club.name, comp: comp?.name ?? '' });
  } else {
    state.contract = null;
    player.clubId = null;
    player.squadRole = 'fringe';
    pushInbox(state, 'club', 'inbox.released', { club: club.name });
    pushNews(state, 'news.released', { club: club.name }, 'high');
    // Free agent: the market decides what happens next.
    const offers = generateOffers({ state, index, rng, minutesPct: actualMinutes, maxOffers: 5 });
    state.transferOffers = offers;
  }
}

/**
 * Nobody tells a footballer when to stop. Once he is past thirty and the ratings have
 * started to go the other way, the question is put to him at the end of the season -
 * it might come at 31, it might not come until 38 - and he decides. The game only
 * decides for him at 41, or when he has been without a club for a year.
 */
function checkRetirement(state: CareerState, rng: Rng): void {
  const player = state.player;
  const age = state.world.season - player.birthYear;
  if (age < 31) return;

  const ovr = overall(player.attributes, player.primaryPos, player.secondaryPos);
  const injuryLoad = player.condition.injuryHistory.reduce((s, i) => s + i.weeksOut, 0);
  const noClub = player.clubId === null;

  if (age >= 41 || (noClub && age >= 34)) {
    retire(state);
    return;
  }

  const last = state.seasonHistory.at(-1);
  const declining = last ? last.ovrEnd < last.ovrStart : false;
  const slipped = last ? last.ovrStart - last.ovrEnd : 0;

  // The thought only arrives once the body has started answering back.
  const weight =
    (age - 31) * 0.10 +
    (declining ? 0.18 + slipped * 0.06 : 0) +
    (ovr < 55 ? 0.18 : 0) +
    injuryLoad / 320 +
    (noClub ? 0.4 : 0) -
    player.personality.determination / 400;

  if (!rng.chance(clamp(weight, 0, 0.9))) return;
  if (state.pendingDecisions.some((d) => d.eventId === 'retirement_choice')) return;

  const absoluteWeek = state.world.season * 52 + state.world.week;
  state.pendingDecisions.push({
    id: `retire_${state.world.season}`,
    kind: 'event',
    eventId: 'retirement_choice',
    category: 'personal',
    textKey: 'decision.retirement',
    textArgs: { age, ovr },
    options: [
      { id: 'retire', labelKey: 'decision.retirement.retire', effects: [] },
      { id: 'continue', labelKey: 'decision.retirement.continue', effects: [] },
    ],
    expiresWeek: absoluteWeek + 6,
  });
  pushInbox(state, 'club', 'inbox.retirementThought', { age });
}

export function retire(state: CareerState): void {
  state.retired = true;
  state.retirementSeason = state.world.season;
  state.careerScore = computeCareerScore(state);
  state.player.retired = true;

  // The announcement reads like an obituary of the career, because that is what it is.
  const legacy = careerLegacy(state);
  const clubs = legacy.spells.filter((spell) => !spell.onLoan).length;
  pushNews(state, 'news.retired', { age: state.world.season - state.player.birthYear }, 'high');
  pushInbox(state, 'media', 'inbox.retirementSummary', {
    age: state.world.season - state.player.birthYear,
    seasons: state.seasonHistory.length,
    apps: legacy.totals.apps,
    goals: legacy.totals.goals,
    assists: legacy.totals.assists,
    trophies: state.trophies.length,
    awards: (state.awards ?? []).length,
    clubs,
  });
  if (legacy.legendOf.length > 0) {
    const clubId = legacy.legendOf[0]!;
    pushInbox(state, 'club', 'inbox.retirementLegend', {
      club: state.world.clubs[clubId]?.name ?? clubId,
    });
    unlock(state, 'clubLegend', { club: state.world.clubs[clubId]?.name ?? clubId });
  }
}

export interface CareerSummary {
  seasons: number;
  matches: number;
  goals: number;
  assists: number;
  avgRating: number;
  caps: number;
  internationalGoals: number;
  trophies: number;
  peakOvr: number;
  peakValue: number;
  careerEarnings: number;
  score: number;
  status: string;
}

export function careerSummary(state: CareerState): CareerSummary {
  const h = state.seasonHistory;
  const matches = h.reduce((s, r) => s + r.apps, 0);
  const goals = h.reduce((s, r) => s + r.goals, 0);
  const assists = h.reduce((s, r) => s + r.assists, 0);
  const ratedApps = h.reduce((s, r) => s + r.ratedApps, 0);
  const ratingSum = h.reduce((s, r) => s + r.ratingSum, 0);
  const peakOvr = h.reduce((m, r) => Math.max(m, r.ovrEnd), 0);
  const peakValue = h.reduce((m, r) => Math.max(m, r.valueEnd), 0);
  const score = state.careerScore ?? computeCareerScore(state);

  return {
    seasons: h.length,
    matches,
    goals,
    assists,
    avgRating: ratedApps > 0 ? Math.round((ratingSum / ratedApps) * 100) / 100 : 0,
    caps: state.nationalTeam.caps,
    internationalGoals: state.nationalTeam.goals,
    trophies: state.trophies.length,
    peakOvr,
    peakValue,
    careerEarnings: state.finances.careerEarnings,
    score,
    status: careerStatus(score),
  };
}


/** What a club meant to him, and he to it. */
export interface ClubSpell {
  clubId: string;
  seasons: number;
  firstSeason: number;
  lastSeason: number;
  apps: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  trophies: number;
  onLoan: boolean;
  /** Enough appearances and enough won that the club would put him on a wall. */
  legend: boolean;
}

export interface CareerLegacy {
  spells: ClubSpell[];
  totals: {
    apps: number;
    goals: number;
    assists: number;
    cleanSheets: number;
    minutes: number;
    motm: number;
    yellowCards: number;
    redCards: number;
  };
  teamTrophies: { competitionId: string; count: number }[];
  awards: { award: string; count: number }[];
  tournaments: { id: string; season: number; finish: string; caps: number; goals: number }[];
  legendOf: string[];
}

/**
 * Everything a career adds up to, for the screen he sees when he hangs them up:
 * where he played and for how long, what he won there and whether it was enough for
 * the club to call him one of its own.
 */
export function careerLegacy(state: CareerState): CareerLegacy {
  const spells = new Map<string, ClubSpell>();
  const totals = { apps: 0, goals: 0, assists: 0, cleanSheets: 0, minutes: 0, motm: 0, yellowCards: 0, redCards: 0 };

  for (const record of state.seasonHistory) {
    totals.apps += record.apps;
    totals.goals += record.goals;
    totals.assists += record.assists;
    totals.cleanSheets += record.cleanSheets;
    totals.minutes += record.minutes;
    totals.motm += record.motm;
    totals.yellowCards += record.yellowCards;
    totals.redCards += record.redCards;

    const clubId = record.clubId;
    if (!clubId) continue;
    const spell = spells.get(clubId) ?? {
      clubId,
      seasons: 0,
      firstSeason: record.season,
      lastSeason: record.season,
      apps: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      trophies: 0,
      onLoan: false,
      legend: false,
    };
    spell.seasons += 1;
    spell.firstSeason = Math.min(spell.firstSeason, record.season);
    spell.lastSeason = Math.max(spell.lastSeason, record.season);
    spell.apps += record.apps;
    spell.goals += record.goals;
    spell.assists += record.assists;
    spell.cleanSheets += record.cleanSheets;
    spell.trophies += record.trophies.length;
    if (record.onLoanFrom) spell.onLoan = true;
    spells.set(clubId, spell);
  }

  const group = positionGroup(state.player.primaryPos);
  for (const spell of spells.values()) {
    // A legend is measured differently by position: a keeper is remembered for the
    // seasons and the clean sheets, a forward for what he scored.
    const scoringWeight = group === 'ATT' ? spell.goals + spell.assists * 0.5 : (spell.goals + spell.assists) * 0.8;
    const standing = spell.apps + scoringWeight * 2.5 + spell.trophies * 25;
    spell.legend = !spell.onLoan && spell.apps >= 80 && standing >= 180;
  }

  const trophyCounts = new Map<string, number>();
  for (const trophy of state.trophies) {
    trophyCounts.set(trophy.competitionId, (trophyCounts.get(trophy.competitionId) ?? 0) + 1);
  }
  const awardCounts = new Map<string, number>();
  for (const award of state.awards ?? []) {
    awardCounts.set(award.award, (awardCounts.get(award.award) ?? 0) + 1);
  }

  const ordered = [...spells.values()].sort((a, b) => a.firstSeason - b.firstSeason);

  return {
    spells: ordered,
    totals,
    teamTrophies: [...trophyCounts].map(([competitionId, count]) => ({ competitionId, count })),
    awards: [...awardCounts].map(([award, count]) => ({ award, count })),
    tournaments: (state.tournaments ?? []).map((tournament) => ({
      id: tournament.id,
      season: tournament.season,
      finish: tournament.finish,
      caps: tournament.caps,
      goals: tournament.goals,
    })),
    legendOf: ordered.filter((spell) => spell.legend).map((spell) => spell.clubId),
  };
}

export function computeCareerScore(state: CareerState): number {
  const h = state.seasonHistory;
  const matches = h.reduce((s, r) => s + r.apps, 0);
  const goals = h.reduce((s, r) => s + r.goals, 0);
  const assists = h.reduce((s, r) => s + r.assists, 0);
  const peakOvr = h.reduce((m, r) => Math.max(m, r.ovrEnd), 0);
  const trophies = state.trophies.length;
  const caps = state.nationalTeam.caps;

  const score =
    peakOvr * 0.55 +
    Math.min(20, matches / 30) +
    Math.min(14, (goals + assists) / 22) +
    Math.min(14, trophies * 1.6) +
    Math.min(10, caps / 9) +
    Math.min(6, state.player.fame / 18);

  return clamp(Math.round(score), 1, 100);
}

export function careerStatus(score: number): string {
  if (score >= 92) return 'goatCandidate';
  if (score >= 84) return 'legend';
  if (score >= 74) return 'worldClass';
  if (score >= 64) return 'nationalStar';
  if (score >= 52) return 'clubLegend';
  if (score >= 38) return 'professional';
  return 'localHero';
}

/**
 * Drop approaches the player never answered. Silence is an answer: the club moves on
 * and the agent takes another client, which is also what stops the decision list
 * growing without bound over a twenty-season career.
 */
function expireDecisions(state: CareerState): void {
  const absoluteWeek = state.world.season * 52 + state.world.week;
  const expired = state.pendingDecisions.filter((d) => d.expiresWeek !== undefined && d.expiresWeek < absoluteWeek);
  if (expired.length === 0) return;

  const expiredIds = new Set(expired.map((d) => d.id));
  state.pendingDecisions = state.pendingDecisions.filter((d) => !expiredIds.has(d.id));

  for (const decision of expired) {
    if (decision.kind === 'transfer' && decision.offers) {
      const gone = new Set(decision.offers.map((o) => o.id));
      state.transferOffers = state.transferOffers.filter((o) => !gone.has(o.id));
    }
    if (decision.kind === 'agent') {
      state.agentOffers = [];
    }
  }
  state.inbox = state.inbox.filter((item) => !item.decisionId || !expiredIds.has(item.decisionId));
}

/** Put clubs on the table as a decision the player has to answer. */
function openOfferDecision(state: CareerState, offers: TransferOffer[]): void {
  const absoluteWeek = state.world.season * 52 + state.world.week;
  const anyLoan = offers.some((o) => o.isLoan);
  const decision: PendingDecision = {
    id: `offer_${absoluteWeek}`,
    kind: 'transfer',
    eventId: 'transferApproach',
    category: 'transfer',
    textKey: anyLoan ? 'decision.loanApproach' : 'decision.transferApproach',
    options: [],
    offers,
    expiresWeek: absoluteWeek + 3,
  };
  state.pendingDecisions.push(decision);
  pushInbox(state, 'transfer', 'inbox.transferInterest', { count: offers.length }, decision.id);
}

function openAgentDecision(state: CareerState, agents: Agent[]): void {
  const absoluteWeek = state.world.season * 52 + state.world.week;
  const decision: PendingDecision = {
    id: `agent_${absoluteWeek}`,
    kind: 'agent',
    eventId: 'agentApproach',
    category: 'agent',
    textKey: 'decision.agentApproach',
    options: [],
    agents,
    expiresWeek: absoluteWeek + 3,
  };
  state.pendingDecisions.push(decision);
  pushInbox(state, 'agent', 'inbox.agentInterest', { count: agents.length }, decision.id);
}

/**
 * Answer a club approach. Passing null turns every club down, which the manager
 * and the supporters notice as much as leaving would have.
 */
export function answerOffer(
  state: CareerState,
  index: PackIndex,
  decisionId: string,
  offerId: string | null,
): DecisionResult | null {
  const at = state.pendingDecisions.findIndex((d) => d.id === decisionId && d.kind === 'transfer');
  if (at === -1) return null;
  const decision = state.pendingDecisions[at]!;
  const rng = mainRng(state);
  const changes: AppliedChange[] = [];

  if (offerId) {
    const offer = decision.offers?.find((o) => o.id === offerId);
    if (!offer) return null;
    const club = state.world.clubs[offer.clubId];
    state.pendingDecisions.splice(at, 1);
    acceptOffer(state, index, offer.id);
    changes.push({ key: 'change.newClub', delta: 1, before: 0, after: 0, tone: 'good' });
    const result: DecisionResult = {
      changes,
      consequences: [],
      narrativeKey: offer.isLoan ? 'decision.loanApproach.joined' : 'decision.transferApproach.joined',
    };
    state.lastResult = result;
    if (club) pushNews(state, 'news.joinedClub', { club: club.name }, 'high');
    return result;
  }

  // Staying put: the club reads it as loyalty, the agent as a missed payday.
  state.pendingDecisions.splice(at, 1);
  state.transferOffers = [];
  adjustRelationship(state, 'fans', 4, changes);
  adjustRelationship(state, 'board', 3, changes);
  if (state.agent) {
    const before = state.agent.relationship;
    state.agent.relationship = clamp(before - 6, 0, 100);
    track(changes, 'change.agent', before, state.agent.relationship);
  }
  const consequences = evaluateConsequences(rng, state);
  const result: DecisionResult = { changes, consequences, narrativeKey: 'decision.transferApproach.stayed' };
  state.lastResult = result;
  commitRng(state, rng);
  return result;
}

/** Answer an agent approach. Passing null keeps him without representation. */
export function answerAgent(state: CareerState, decisionId: string, agentId: string | null): DecisionResult | null {
  const at = state.pendingDecisions.findIndex((d) => d.id === decisionId && d.kind === 'agent');
  if (at === -1) return null;
  const decision = state.pendingDecisions[at]!;
  state.pendingDecisions.splice(at, 1);
  const changes: AppliedChange[] = [];

  if (agentId) {
    const agent = decision.agents?.find((a) => a.id === agentId);
    if (agent) {
      state.agent = agent;
      state.agentOffers = [];
      changes.push({ key: 'change.newAgent', delta: 1, before: 0, after: 0, tone: 'good' });
      pushInbox(state, 'agent', 'inbox.agentSigned', { name: agent.name });
    }
  } else {
    state.agentOffers = [];
    changes.push({ key: 'change.noAgent', delta: 0, before: 0, after: 0, tone: 'neutral' });
  }

  const result: DecisionResult = {
    changes,
    consequences: [],
    narrativeKey: agentId ? 'decision.agentApproach.signed' : 'decision.agentApproach.declined',
  };
  state.lastResult = result;
  return result;
}

/** Carry out one of the player's own moves: a conversation, a gesture, a request. */
export function doPlayerAction(state: CareerState, id: PlayerActionId): DecisionResult | null {
  const rng = mainRng(state);
  const result = performAction(rng, state, id);
  commitRng(state, rng);
  if (result.changes.length === 0 && result.consequences.length === 0) return null;
  state.lastResult = result;
  for (const consequence of result.consequences) {
    pushInbox(state, 'manager', `consequence.${consequence.id}`, consequence.args);
  }
  return result;
}

/** Accept a transfer or loan offer. */
export function acceptOffer(state: CareerState, index: PackIndex, offerId: string): boolean {
  const offer = state.transferOffers.find((o) => o.id === offerId);
  if (!offer) return false;
  const rng = mainRng(state);
  const previousClubId = state.player.clubId;

  joinClub(state, index, offer.clubId, {
    salary: offer.salaryPerWeek,
    years: offer.years,
    role: offer.squadRole,
    ...(offer.isLoan ? { isLoan: true, parentClubId: previousClubId ?? undefined } : {}),
  });

  state.transferOffers = [];
  state.flags['transferRequested'] = false;
  state.player.morale = clamp(state.player.morale + 8, 0, 100);
  commitRng(state, rng);
  return true;
}

export function signAgent(state: CareerState, agentId: string): boolean {
  const agent = state.agentOffers.find((a) => a.id === agentId);
  if (!agent) return false;
  state.agent = agent;
  state.agentOffers = [];
  pushInbox(state, 'agent', 'inbox.agentSigned', { name: agent.name });
  return true;
}

export function setTraining(state: CareerState, plan: Partial<CareerState['training']>): void {
  state.training = { ...state.training, ...plan };
}

export interface WeekPlan {
  /** Stop as soon as one of these happens. */
  stopOn?: TickResult['stopped'][];
  maxWeeks?: number;
}

/** Run weeks until something interesting happens or the budget runs out. */
export function advanceUntil(state: CareerState, index: PackIndex, plan: WeekPlan = {}): TickResult {
  const stopOn = new Set(plan.stopOn ?? ['decision', 'match', 'seasonEnd', 'retired']);
  const maxWeeks = plan.maxWeeks ?? 60;
  let last: TickResult = { state, stopped: 'week', log: [] };
  for (let i = 0; i < maxWeeks; i++) {
    last = advanceWeek(state, index);
    if (stopOn.has(last.stopped)) return last;
    if (state.retired) return last;
  }
  return last;
}

export function actionsAvailableNow(state: CareerState) {
  return availableActions(state);
}

export function currentOvr(state: CareerState): number {
  return overall(state.player.attributes, state.player.primaryPos, state.player.secondaryPos);
}

export function potentialLabel(state: CareerState): string {
  const ovr = currentOvr(state);
  const gap = state.player.potential - ovr;
  if (gap <= 3) return 'limited';
  if (gap <= 9) return 'promising';
  if (gap <= 17) return 'highPotential';
  if (gap <= 26) return 'excitingProspect';
  return 'eliteProspect';
}

export type { TransferOffer, Contract };
