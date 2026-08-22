import { Rng, clamp, hashString, randomSeed } from './rng.js';
import { FORMATIONS, overall, positionGroup, ratingAt, skillProfile } from './positions.js';
import {
  halfTimeEffect,
  halfTimeFrequency,
  instructionsFor,
  managerDemand,
  managerDictates,
  type HalfTimeInstructionId,
} from './halftime.js';
import { indexPack, type DataPack, type PackIndex } from './data.js';
import {
  clubBaseOvr,
  createUserPlayer,
  generatePlayer,
  generateSquad,
  starToPlayer,
  type UserPlayerInput,
} from './generate.js';
import { raiseSponsorOffers, runLifeWeek } from './life.js';
import {
  goalProgress,
  goalVerdict,
  proposedGoal,
  type GoalStake,
} from './season-goal.js';
import {
  developWeek,
  dietCost,
  driftPotential,
  applyMatchCondition,
  applyTrainingCondition,
  FORM_WINDOW_WEEKS,
  updateForm,
} from './development.js';
import {
  capMinutes,
  eligibleForSenior,
  isAvailable,
  pickBestLineup,
  resolveMinutes,
  selectionScore,
  type MinutesOutcome,
  type SelectionContext,
} from './selection.js';
import {
  clubRating,
  simulateQuickResult,
  simulateUserMatch,
  teamRatingFromSquad,
} from './match.js';
import {
  FIRST_MATCH_WEEK,
  LAST_MATCH_WEEK,
  PRESEASON_END_WEEK,
  WEEKS_PER_SEASON,
  applyResult,
  driftClubStrength,
  ensureLeagueSplit,
  initCompetitionSeason,
  positionOf,
  resolveSeasonEnd,
  sortedTable,
  type SeasonEndOutcome,
} from './league.js';
import { createCup, drawRound, isCupFinal, isCupSemi, leagueCupId, recordTieResult, youthCupId, type CupState } from './cup.js';
import { runAbstractMarket, runSquadWindow, type SquadMove } from './market.js';
import { negotiate, type ContractAsk, type NegotiationOutcome } from './negotiate.js';
import {
  applyMilestoneAnswer,
  backgroundMilestone,
  milestoneById,
  milestoneCopyVariant,
  milestoneFor,
  occasionMilestone,
  settleClaim,
  type MilestoneId,
} from './milestones.js';
import {
  availableMentors,
  followAdvice,
  mentorById,
  talkToMentor,
  answerMentorPrompt,
  mentorPromptById,
  mentorReachesOut,
  type MentorReply,
  type MentorTopic,
} from './mentor.js';
import {
  applyQualifierResult,
  campaignFame,
  createCampaign,
  qualified,
  qualifyingTable,
  settleGroup,
  settlePlayoff,
  simulateQualifier,
} from './qualifying.js';
import {
  applyEuroResult,
  createEuroCompetition,
  createEuroWithQualifying,
  drawQualifyingRound,
  qualifiedField,
  resolveQualifyingRound,
  QUALIFYING_WEEKS,
  drawEuroRound,
  euroPrize,
  europeanQualifiers,
  groupStageComplete,
  qualifiersFromGroups,
  qualifiersFromLeaguePhase,
  setPlayoffField,
  LEAGUE_PHASE_SIZE,
  resolveEuroRound,
  EURO_TIERS,
  type EuroState,
  type EuroTier,
} from './europe.js';
import { addInjury, isInjured, rollInjury, rollSetback, tickInjuries, trainingInjuryChance, treatInjury, treatmentsFor, TREATMENTS, type TreatmentChoice } from './injury.js';
import { marketValue } from './value.js';
import {
  deservesCallUp,
  youthClubRating,
  createYouthWorld,
  userYouthCompetitionId,
  youthParentId,
  userYouthCompetition,
  scoringRank,
  youthTablePosition,
  youthMembers,
  buildYouthCups,
  newYouthSeason,
  emptyYouthForm,
  YOUTH_EXCHANGE,
  YOUTH_MAX_AGE,
} from './youth.js';
import { resolveYouthSeason } from './youth-awards.js';
import {
  ageYouthWorld,
  namesInUse,
  stockYouthDivision,
  youthSquad,
  youthStatsFor,
} from './youth-squads.js';
import { decideAwards, awardFame, awardReputation, type AwardResult } from './awards.js';
import { playTournament, tournamentFame, tournamentFor } from './tournament.js';
import { agentCommission, generateAgentOffers } from './agents.js';
import { attendanceFor, pickReferee, pickWeather, type Atmosphere } from './atmosphere.js';
import { associationApproach, pledgeTo, turnDown } from './allegiance.js';
import { buildTeamOfTheWeek } from './totw.js';
import { matchCategory, type MatchCategory } from './category.js';
import { appointManager, generateManager, sackingChance } from './manager.js';
import { advanceTrackedPlayers, followPlayer, isTracked, peerTable, trackHisYear } from './peers.js';
import {
  MATCH_PLANS,
  planEffect,
  planFit,
  plansFor,
  readOpponent,
  recommendedPlan,
  type MatchPlanId,
  type OpponentReport,
} from './tactics.js';
import {
  generateLoanOffers,
  generateOffers,
  offerFromWatchingClub,
  isTransferWindow,
  isWindowApproaching,
  windowIdFor,
  renewalIntent,
  expectedMinutesFor,
} from './transfer.js';
import {
  INTERNATIONAL_WEEKS,
  commitToCountry,
  initNationalTeam,
  levelForAge,
  rollCallUp,
  simulateInternationalMatch,
  updateNationalInterest,
  type CallUpContext,
  type CallUpResult,
  type InternationalMatchOutcome,
} from './national.js';
import { isEligible, isStoryEvent, pickEvent, toPendingDecision, type EventContext } from './events.js';
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
  CategoryTally,
  DecisionResult,
  PendingDecision,
  CareerSeasonRecord,
  CareerState,
  Club,
  Competition,
  Contract,
  InboxMessage,
  MatchEvent,
  MatchImportance,
  MatchResult,
  NewsItem,
  AttributeKey,
  Injury,
  Player,
  Position,
  SeasonStats,
  SquadRole,
  TickResult,
  TransferOffer,
  CompetitionSeasonState,
  Fixture,
  TrainingIntensity,
  TrainingPlan,
  UserMatchLine,
} from './types.js';

export const SCHEMA_VERSION = 3;
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
    seasonStartAttributes: { ...player.attributes },
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
  initCampaign(state, index, rng);
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
    const domestic = index.pack.competitions.find((competition) => competition.country === country.code && competition.tier === 1);
    const first = domestic?.calendar?.firstWeek ?? FIRST_MATCH_WEEK;
    const last = domestic?.calendar?.lastWeek ?? LAST_MATCH_WEEK;
    const cupWeeks = Array.from({ length: 8 }, (_, round) =>
      Math.round(first + ((last - first) * round) / 7));
    const cup = createCup(rng, country.code, clubs, season, cupWeeks);
    drawRound(rng, cup, state.world.week);
    state.world.cups[cup.id] = cup;

    /*
     * The league cup, where the country plays one.
     *
     * Israel's Toto, England's EFL, Scotland's and Portugal's: a smaller field - the
     * top two divisions rather than everybody - and it is over by midwinter, which is
     * what makes it a different competition rather than a second national cup.
     */
    if (country.leagueCupName) {
      const entrants = clubs.filter((entry) => entry.tier <= 2);
      if (entrants.length >= 8) {
        /*
         * A midweek of its own.
         *
         * Both knockouts counted their rounds from the first week of the season, so the
         * national cup and the Toto kept landing on the same date - two cup ties in one
         * week, twice a season, and then a month of nothing. The league cup sits between
         * the national cup's rounds instead.
         */
        const lastRound = Math.round(first + (last - first) * 0.55);
        const leagueCupWeeks = Array.from({ length: 6 }, (_, round) =>
          Math.round(first + 3 + ((lastRound - first) * round) / 5));
        const leagueCup = createCup(
          rng, country.code, entrants, season, leagueCupWeeks, leagueCupId(country.code),
        );
        drawRound(rng, leagueCup, state.world.week);
        state.world.cups[leagueCup.id] = leagueCup;
      }
    }
  }

  loadEuropeanSlots(index);
  initEurope(state, rng);
  rollYouthSeason(state, index, rng);
  const club = userClub(state);
  if (club) {
    state.flags[`trainingCamp:${season}`] = true;
    scheduleTrainingCamp(state, rng, club);
    pushInbox(state, 'manager', 'inbox.trainingCampBegins', { club: club.name });
  }
}

/**
 * The youth league: the clubs of his own division, fielding the sides he would play
 * against on a Sunday morning. It only exists while he is young enough to be in it.
 */
/**
 * A tournament summer means a season of qualifiers first. The campaign is built for the
 * country he is committed to, or the one most likely to call him, so he can follow it
 * whether or not he is in the squad yet.
 */
function initCampaign(state: CareerState, index: PackIndex, rng: Rng): void {
  const season = state.world.season;
  const tournament = tournamentFor(season);
  if (!tournament) {
    state.campaign = undefined;
    return;
  }
  if (state.campaign?.season === season) return;

  const nt = state.nationalTeam;
  const countryCode =
    nt.countryCode ??
    [...nt.eligibleCountries].sort((a, b) => (nt.interest[b] ?? 0) - (nt.interest[a] ?? 0))[0] ??
    state.player.birthCountry;

  const campaign = createCampaign(rng, index, countryCode, tournament, season);
  if (!campaign) return;
  state.campaign = campaign;

  const country = index.countryByCode.get(countryCode);
  pushInbox(state, 'national', `inbox.campaign.begins.${tournament}`, {
    country: country?.name ?? countryCode,
    group: qualifyingTable(campaign)
      .map((row) => index.countryByCode.get(row.countryCode)?.name ?? row.countryCode)
      .join(', '),
  });
}

/**
 * The qualifiers due this week: his country's match, and the other one in the group so
 * the table is a real table rather than his results and three blanks.
 */
function playQualifiers(state: CareerState, index: PackIndex, rng: Rng, calledUp: boolean): void {
  const campaign = state.campaign;
  if (!campaign) return;
  const week = state.world.week;

  for (const fixture of campaign.fixtures) {
    if (fixture.played || fixture.week !== week) continue;
    fixture.result = simulateQualifier(rng, index, fixture.homeCountry, fixture.awayCountry);
    fixture.played = true;
    applyQualifierResult(campaign, fixture);

    const his = fixture.homeCountry === campaign.countryCode || fixture.awayCountry === campaign.countryCode;
    if (!his) continue;

    const country = index.countryByCode.get(campaign.countryCode);
    if (calledUp && country) {
      const simulated = simulateInternationalMatch(rng, state.player, 'senior', country.reputation);
      // A player's goals cannot exceed his team's goals. The fixture result is settled
      // first because it also belongs to the qualifying table, so trim the personal line
      // rather than silently changing a result that has already awarded points.
      const teamGoals = fixture.homeCountry === campaign.countryCode
        ? fixture.result[0]
        : fixture.result[1];
      const outcome = { ...simulated, goals: Math.min(simulated.goals, teamGoals) };
      fixture.userPlayed = outcome.played;
      fixture.userGoals = outcome.goals;
      fixture.userRating = outcome.rating;
      if (outcome.played) {
        const nt = state.nationalTeam;
        nt.caps++;
        nt.goals += outcome.goals;
        tallyNational(state, outcome);
        if (!nt.capturedBySenior) commitToCountry(nt, campaign.countryCode);
        state.player.reputation = clamp(state.player.reputation + 0.8 + outcome.goals * 0.9, 0, 100);
        state.player.fame = clamp(state.player.fame + 1 + outcome.goals * 1.2, 0, 100);
        state.player.condition.fatigue = clamp(state.player.condition.fatigue + outcome.minutes / 9, 0, 100);
      }
      // Being selected is enough for the match to appear. If he remains unused, the
      // match centre shows the national fixture and the bench reason, just as it does
      // for a club match; if he plays, it opens the full live view with instructions.
      recordNationalAppearance(state, nationalMatchResult(
        state,
        index,
        rng,
        `national.qualifier.${campaign.season}.${fixture.week}.${fixture.homeCountry}.${fixture.awayCountry}`,
        'national.qualifier',
        fixture.homeCountry,
        fixture.awayCountry,
        fixture.result,
        campaign.countryCode,
        outcome,
      ));
    }

    const opponent =
      fixture.homeCountry === campaign.countryCode ? fixture.awayCountry : fixture.homeCountry;
    pushInbox(state, 'national', 'inbox.qualifier.result', {
      country: country?.name ?? campaign.countryCode,
      opponent: index.countryByCode.get(opponent)?.name ?? opponent,
      score: `${fixture.result[0]}-${fixture.result[1]}`,
    });
  }

  settleGroup(rng, index, campaign);
  if (campaign.playoff && !campaign.playoff.played && week >= campaign.playoff.week) {
    settlePlayoff(rng, index, campaign);
  }
}

/**
 * The youth pyramid, built once and then kept.
 *
 * A division for every senior tier in his country, and real squads for the one his own
 * club is in. If he is already too old for it there is nothing to build.
 */
function initYouth(state: CareerState, index: PackIndex, rng: Rng): void {
  const club = userClub(state);
  const age = state.world.season - state.player.birthYear;
  if (!club || age > YOUTH_MAX_AGE) {
    state.world.youth = undefined;
    return;
  }

  state.world.youth = createYouthWorld(rng, state, index, club.country);
  const division = userYouthCompetitionId(state);
  if (division) stockYouthDivision(rng, state, index, division);
  // His year: the best of the boys he actually plays against, followed for life.
  trackHisYear(rng, state);
}

/**
 * A new youth season: fresh tables and fixtures for every division, everybody a year
 * older, a new intake where the leavers were, and squads for whichever division his
 * club has ended up in.
 */
function rollYouthSeason(state: CareerState, index: PackIndex, rng: Rng): void {
  const club = userClub(state);
  const age = state.world.season - state.player.birthYear;
  if (!club || age > YOUTH_MAX_AGE) {
    state.world.youth = undefined;
    return;
  }
  if (!state.world.youth) {
    initYouth(state, index, rng);
    return;
  }

  const youth = state.world.youth;
  youth.form = emptyYouthForm();

  for (const competitionId of Object.keys(youth.competitions)) {
    const clubIds = youthMembers(youth, competitionId);
    if (clubIds.length < 4) {
      delete youth.competitions[competitionId];
      continue;
    }
    const parent = index.competitionById.get(youthParentId(competitionId));
    youth.competitions[competitionId] = newYouthSeason(
      rng, competitionId, clubIds, state.world.season, parent?.split,
    );
  }

  // The knockouts start again with everybody in them, the way a cup does.
  youth.cups = buildYouthCups(rng, state, index, club.country);

  ageYouthWorld(rng, state, index);
  const division = userYouthCompetitionId(state);
  if (division) stockYouthDivision(rng, state, index, division);
  for (const [playerId, stats] of Object.entries(youth.stats)) {
    youth.stats[playerId] = { ...stats, season: state.world.season, apps: 0, starts: 0, subApps: 0,
      minutes: 0, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0, motm: 0,
      ratingSum: 0, ratedApps: 0 };
  }
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

  const GROUP_PLACES = LEAGUE_PHASE_SIZE;
  for (const tier of EURO_TIERS) {
    const seeded = (qualified[tier] ?? []).filter((id) => state.world.clubs[id]);
    const qualifiers = (qualified[`${tier}Qual`] ?? []).filter((id) => state.world.clubs[id]);
    if (seeded.length === 0 && qualifiers.length === 0) continue;

    // Thirty-six places. More clubs than that have a claim on them, which is exactly
    // why there is a summer: the seeds are in, everyone else plays for what is left.
    const field = seeded.length + qualifiers.length;
    if (field < 8) continue;
    const places = Math.min(GROUP_PLACES, field);
    state.world.europe[tier] = createEuroWithQualifying(rng, tier, seeded, qualifiers, season, places);
  }
  state.world.europeNext = undefined;
}

/** First season only: seed Europe with the best clubs of every top division. */
function defaultEuropeanEntrants(state: CareerState): Record<string, string[]> {
  // The first season has no table to read, so the strongest clubs in each country take
  // that country's places - the same allocation the real competitions use, which is
  // why there is no three-Israeli-club Champions League.
  const out: Record<string, string[]> = { ucl: [], uel: [], uecl: [], uclQual: [], uelQual: [], ueclQual: [] };
  const index = state.world.competitions;
  void index;

  const byCompetition = new Map<string, Club[]>();
  for (const club of Object.values(state.world.clubs)) {
    if (club.tier !== 1) continue;
    const list = byCompetition.get(club.competitionId) ?? [];
    list.push(club);
    byCompetition.set(club.competitionId, list);
  }

  for (const [competitionId, clubs] of byCompetition) {
    const slots = EUROPEAN_SLOTS.get(competitionId);
    if (!slots) continue;
    const ranked = clubs.sort((a, b) => b.strength - a.strength).map((c) => c.id);
    let cursor = 0;
    const take = (count: number | undefined): string[] => {
      if (!count) return [];
      const picked = ranked.slice(cursor, cursor + count);
      cursor += count;
      return picked;
    };
    out.ucl!.push(...take(slots.ucl));
    out.uclQual!.push(...take(slots.uclQual));
    out.uel!.push(...take(slots.uel));
    out.uelQual!.push(...take(slots.uelQual));
    out.uecl!.push(...take(slots.uecl));
    out.ueclQual!.push(...take(slots.ueclQual));
  }
  return out;
}

/** Filled from the pack the first time it is needed, so allocation stays data-driven. */
const EUROPEAN_SLOTS = new Map<string, NonNullable<Competition['europeanSlots']>>();

function loadEuropeanSlots(index: PackIndex): void {
  if (EUROPEAN_SLOTS.size > 0) return;
  for (const competition of index.pack.competitions) {
    if (competition.europeanSlots) EUROPEAN_SLOTS.set(competition.id, competition.europeanSlots);
  }
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
  opts: {
    asAcademy?: boolean;
    salary?: number;
    years?: number;
    role?: SquadRole;
    isLoan?: boolean;
    parentClubId?: string;
    signingBonus?: number;
    releaseClause?: number | null;
  } = {},
): void {
  const rng = mainRng(state);
  const club = state.world.clubs[clubId];
  if (!club) throw new Error(`joinClub: unknown club ${clubId}`);

  state.player.clubId = clubId;
  state.player.squadRole = opts.role ?? (opts.asAcademy ? 'academy' : 'rotation');
  if (state.player.squadRole !== 'academy') state.flags['calledUpToSeniors'] = true;

  const season = state.world.season;
  const age = season - state.player.birthYear;
  const comp = index.competitionById.get(club.competitionId);

  state.contract = {
    clubId,
    salaryPerWeek: opts.salary ?? (opts.asAcademy ? 200 : 1500),
    startSeason: season,
    endSeason: season + (opts.years ?? (opts.asAcademy ? 3 : 3)),
    squadRole: state.player.squadRole,
    signingBonus: opts.signingBonus ?? 0,
    appearanceBonus: Math.round((opts.salary ?? 500) * 0.2),
    goalBonus: Math.round((opts.salary ?? 500) * 0.3),
    releaseClause: opts.releaseClause ?? null,
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
  // The man who wanted him. A signing is somebody's decision, and that somebody has a
  // name, a way of seeing players and a length of service the player can watch running
  // down when results go badly.
  state.manager = generateManager(rng, index, club, season);
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
  /*
   * Joining a club as a boy puts him straight into its youth side - that club's youth
   * side, in that club's country.
   *
   * Only building the pyramid when there was none left a boy who moved abroad, or into
   * another division, in an age group that did not contain his new club: no youth
   * fixtures, no youth minutes, and a market that then read him as a boy who never
   * plays. The division he has landed in is stocked instead, and a move to another
   * country rebuilds the pyramid around him.
   */
  if (isAcademyPlayer(state)) {
    const division = userYouthCompetitionId(state);
    if (!state.world.youth || !division) initYouth(state, index, rng);
    else stockYouthDivision(rng, state, index, division);
  }
  // Two clubs a season is the cap, the way registration rules work in real football.
  const movedIn = Number(state.flags['movesSeason'] ?? -1) === season
    ? Number(state.flags['movesThisSeason'] ?? 0)
    : 0;
  state.flags['movesSeason'] = season;
  state.flags['movesThisSeason'] = movedIn + 1;
  commitRng(state, rng);

  pushNews(state, 'news.joinedClub', { club: club.name }, 'medium');
  if (age <= 17) pushInbox(state, 'club', 'inbox.welcomeAcademy', { club: club.name });
  if (state.world.week <= PRESEASON_END_WEEK) {
    state.flags[`trainingCamp:${season}`] = true;
    state.flags[`campStartOvr:${season}`] = overall(
      state.player.attributes,
      state.player.primaryPos,
      state.player.secondaryPos,
    );
    scheduleTrainingCamp(state, rng, club);
    pushInbox(state, 'manager', 'inbox.trainingCampBegins', { club: club.name });
  }
}

/**
 * An international selection belongs in the player's history and can become the match
 * the app opens this week, but it must never touch a domestic table or club totals.
 * Deterministic ids make the write idempotent if a saved end-of-week routine is resumed.
 */
function recordNationalAppearance(state: CareerState, result: MatchResult): MatchResult {
  const existing = state.matchLog.find((match) => match.id === result.id);
  if (existing) return existing;
  state.matchLog.unshift(result);
  if (state.matchLog.length > 140) state.matchLog.length = 140;
  state.flags['nationalMatchThisWeek'] = state.world.season * WEEKS_PER_SEASON + state.world.week;
  state.flags['nationalMatchId'] = result.id;
  return result;
}

function nationalMatchResult(
  state: CareerState,
  index: PackIndex,
  rng: Rng,
  id: string,
  competitionId: string,
  homeCountry: string,
  awayCountry: string,
  score: [number, number],
  userCountry: string,
  outcome: InternationalMatchOutcome,
): MatchResult {
  const started = outcome.minutes > 45;
  const attacking = positionGroup(state.player.primaryPos) === 'ATT';
  const line: UserMatchLine = {
    played: outcome.played,
    started,
    minutes: outcome.minutes,
    position: outcome.played ? state.player.primaryPos : null,
    goals: outcome.goals,
    assists: outcome.assists,
    shots: outcome.played
      ? Math.max(outcome.goals, rng.int(attacking ? 1 : 0, attacking ? 5 : 2))
      : 0,
    keyPasses: outcome.played ? rng.int(0, 3) + outcome.assists : 0,
    tackles: outcome.played
      ? rng.int(0, positionGroup(state.player.primaryPos) === 'DEF' ? 5 : 3)
      : 0,
    saves: outcome.played && state.player.primaryPos === 'GK' ? rng.int(1, 7) : 0,
    yellow: outcome.played && rng.chance(0.12) ? 1 : 0,
    red: 0,
    rating: outcome.rating,
    motm: outcome.rating >= 8.5,
    ...(outcome.played && !started ? { cameOnMinute: 90 - outcome.minutes } : {}),
    ...(!outcome.played ? { reasonNotPlayed: 'notSelected' as const } : {}),
  };
  const userHome = homeCountry === userCountry;
  const userGoals = userHome ? score[0] : score[1];
  const opponentGoals = userHome ? score[1] : score[0];
  const events: MatchEvent[] = [
    { minute: 0, type: 'kickOff', byUser: false, ambient: true, detailKey: 'match.live.kickOff' },
    { minute: 45, type: 'halfTime', byUser: false, ambient: true, detailKey: 'match.live.halfTime' },
  ];
  for (let goal = 0; goal < userGoals; goal++) {
    const minute = Math.min(88, 12 + goal * 19 + rng.int(0, 10));
    const byPlayer = outcome.played && goal < outcome.goals;
    events.push({
      minute,
      type: 'goal',
      ...(byPlayer ? { playerId: state.player.id } : {}),
      byUser: byPlayer,
      forUserTeam: true,
      detailKey: byPlayer ? 'match.event.userGoal' : 'match.event.teamGoal',
    });
  }
  for (let goal = 0; goal < opponentGoals; goal++) {
    const minute = Math.min(89, 18 + goal * 22 + rng.int(0, 9));
    events.push({
      minute, type: 'concede', byUser: false, forUserTeam: false,
      detailKey: 'match.event.conceded',
    });
  }
  if (outcome.played && outcome.assists > 0) {
    events.push({
      minute: Math.min(86, 26 + rng.int(0, 30)), type: 'assist', playerId: state.player.id,
      byUser: true, forUserTeam: true, detailKey: 'match.event.assist',
    });
  }
  if (line.yellow > 0) {
    events.push({
      minute: rng.int(20, 78), type: 'yellow', playerId: state.player.id,
      byUser: true, forUserTeam: true, detailKey: 'match.event.yellow',
    });
  }
  events.push(
    { minute: 21, type: 'corner', byUser: false, forUserTeam: true, ambient: true, detailKey: 'match.live.corner' },
    { minute: 67, type: 'freeKick', byUser: false, forUserTeam: false, ambient: true, detailKey: 'match.live.freeKickOpp' },
    { minute: 90, type: 'fullTime', byUser: false, ambient: true, detailKey: 'match.live.fullTime' },
  );
  events.sort((a, b) => a.minute - b.minute);
  // A country's night has a crowd and a man in the middle like anything else.
  const nightRng = new Rng(hashString(id) % 2_000_000 + 1);
  const nationalCrowd = Math.round((22_000 + nightRng.int(0, 38_000)) / 500) * 500;
  // Score snapshots are assigned only after both teams' goals are in chronological
  // order. Assigning each side separately produced impossible broadcasts such as 2-0
  // becoming 1-1 a minute later.
  let runningHome = 0;
  let runningAway = 0;
  for (const event of events) {
    if (event.type !== 'goal' && event.type !== 'concede') continue;
    const forHome = event.forUserTeam === userHome;
    if (forHome) runningHome++;
    else runningAway++;
    event.score = [runningHome, runningAway];
  }
  return {
    id,
    season: state.world.season,
    week: state.world.week,
    competitionId,
    homeClubId: homeCountry,
    awayClubId: awayCountry,
    homeGoals: score[0],
    awayGoals: score[1],
    detailLevel: 1,
    userClubId: userCountry,
    importance: 'normal',
    attendance: nationalCrowd,
    weather: pickWeather(nightRng, state.world.week, competitionId),
    referee: pickReferee(nightRng, index, homeCountry),
    userLine: line,
    events,
  };
}

/** The two friendlies in a camp week: one midweek, one at the weekend. */
export const CAMP_SLOTS = ['a', 'b'] as const;
export type CampSlot = (typeof CAMP_SLOTS)[number];

/** Where a camp fixture is played. The camp ends away at the strongest side of the six. */
export function campFixtureAtHome(week: number, slot: CampSlot): boolean {
  if (week === 2 && slot === 'a') return false;
  if (week === PRESEASON_END_WEEK && slot === 'b') return false;
  return true;
}

/**
 * Put the camp on the calendar when it opens, rather than inventing an opponent at
 * kickoff. That makes every friendly visible in advance and stable across save/reload.
 */
function scheduleTrainingCamp(state: CareerState, rng: Rng, club: Club): void {
  const season = state.world.season;
  if (typeof state.flags[`campStartOvr:${season}`] !== 'number') {
    state.flags[`campStartOvr:${season}`] = overall(
      state.player.attributes,
      state.player.primaryPos,
      state.player.secondaryPos,
    );
  }
  const level = clubRating(club);
  const chosen = new Set<string>();
  /*
   * Who a camp can plausibly call.
   *
   * The last week used to look for a stronger side anywhere in the world, which put an
   * under-16 team from Tel Aviv on the same pitch as Nottingham Forest and Milan. A
   * summer tour abroad is a big club's privilege and a senior squad's business; a youth
   * camp is played against clubs down the road.
   */
  const touring = !isAcademyPlayer(state) && club.reputation >= 70;

  for (let week = 1; week <= PRESEASON_END_WEEK; week++) {
    for (const slot of CAMP_SLOTS) {
      const key = `campOpponent:${season}:${week}:${slot}`;
      // A camp booked under the old one-match-a-week calendar keeps the opponent it
      // already had; only the second fixture of the week is new.
      const legacy = slot === 'a' ? String(state.flags[`campOpponent:${season}:${week}`] ?? '') : '';
      const existing = String(state.flags[key] ?? legacy);
      if (state.world.clubs[existing]) {
        state.flags[key] = existing;
        chosen.add(existing);
        continue;
      }
      const preferred = Object.values(state.world.clubs).filter((candidate) => {
        if (candidate.id === club.id || chosen.has(candidate.id)) return false;
        const gap = clubRating(candidate) - level;
        if (week === 1) return candidate.country === club.country && gap >= -22 && gap <= -5;
        if (week === 2) return candidate.country === club.country && Math.abs(gap) <= 10;
        return (touring || candidate.country === club.country) && gap >= -3 && gap <= 16;
      });
      const fallback = Object.values(state.world.clubs).filter(
        (candidate) => candidate.id !== club.id && !chosen.has(candidate.id),
      );
      const opponent = rng.pick(preferred.length > 0 ? preferred : fallback);
      state.flags[key] = opponent.id;
      chosen.add(opponent.id);
    }
  }

  updateCampAssessment(state);
}

/** Real, position-aware strengths and weaknesses used by both the UI and the coaches. */
function updateCampAssessment(state: CareerState): void {
  const profile = skillProfile(state.player.attributes, state.player.primaryPos)
    .slice()
    .sort((a, b) => b.value - a.value);
  const strongest = profile[0];
  const weakest = profile[profile.length - 1];
  if (strongest) state.flags[`campStrength:${state.world.season}`] = strongest.key;
  if (weakest) {
    state.flags[`campWeakness:${state.world.season}`] = weakest.key;
    state.flags[`campRecommendedFocus:${state.world.season}`] = focusForCampWeakness(weakest.key);
    state.flags[`campRecommendedIntensity:${state.world.season}`] = intensityForCamp(
      state,
      strongest ? strongest.value - weakest.value : 0,
    );
  }
}

/**
 * How hard the staff want him working, which is a medical question before it is a
 * coaching one.
 *
 * The body sets the ceiling: a player carrying an injury, or just back from one, is
 * given a light block whatever his weakness looks like, and a tired or blunt one is
 * held at normal. Only once he is fit does the size of the gap decide how far up the
 * ladder he goes - and the top of it is reserved for a young professional with real
 * ground to make up, because that is the block that breaks people.
 */
function intensityForCamp(state: CareerState, gap: number): TrainingIntensity {
  const player = state.player;
  if (isInjured(player) || state.flags['returnedFromLayoff']) return 'light';
  if (player.condition.fatigue >= 55 || player.condition.sharpness <= 40) return 'normal';

  const age = state.world.season - player.birthYear;
  const professional = player.personality.professionalism >= 62 && player.personality.determination >= 55;
  if (gap >= 24 && age <= 21 && professional) return 'extreme';
  if (gap >= 14) return 'intensive';
  return 'normal';
}

function focusForCampWeakness(skill: ReturnType<typeof skillProfile>[number]['key']): TrainingPlan['focus'] {
  if (skill === 'speed' || skill === 'agility' || skill === 'physical' || skill === 'heading') return 'physical';
  if (skill === 'finishing') return 'finishing';
  if (skill === 'defending') return 'defending';
  if (skill === 'goalkeeping') return 'goalkeeping';
  if (skill === 'vision') return 'mental';
  return 'technical';
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
  // Every name already spoken for in this world, so nobody is generated twice.
  const taken = namesInUse(state);

  if (!state.world.squads[clubId] || state.world.squads[clubId]!.length < 18) {
    const stars = index.starsByClub.get(clubId) ?? [];
    const squad = generateSquad(rng, { club, season, index, stars, taken });
    state.world.squads[clubId] = squad.map((p) => p.id);
    for (const p of squad) state.world.players[p.id] = p;
  }
  // And he is in it himself.
  //
  // Nothing ever put him there: not signing for the club, not being promoted out of the
  // academy. Every screen that asks the world who plays for this club had to remember to
  // add him back by hand, and the ones that did not - the team sheet the match is picked
  // from, the size check above - simply played a man short of what they thought.
  if (!isAcademyPlayer(state)) {
    const list = state.world.squads[clubId]!;
    if (!list.includes(state.player.id)) list.push(state.player.id);
  } else {
    state.world.squads[clubId] = state.world.squads[clubId]!.filter((id) => id !== state.player.id);
  }
  keep.add(clubId);

  const rivals = Object.values(state.world.clubs).filter((c) => c.competitionId === club.competitionId && c.id !== clubId);
  for (const rival of rivals) {
    keep.add(rival.id);
    if (state.world.squads[rival.id]) continue;
    const stars = index.starsByClub.get(rival.id) ?? [];
    const players: Player[] = [];
    const usedIds = new Set<string>();
    for (const star of stars.slice(0, 8)) {
      const player = starToPlayer(rng, index, star, season, rival);
      // Same surname, same club: the id has to separate them or one of them vanishes.
      let id = player.id;
      for (let n = 2; usedIds.has(id); n++) id = `${player.id}_${n}`;
      usedIds.add(id);
      player.id = id;
      players.push(player);
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
          taken,
        }),
      );
    }
    state.world.squads[rival.id] = players.map((p) => p.id);
    for (const p of players) state.world.players[p.id] = p;
  }

  // Drop squads we no longer need so a 20-season save doesn't accumulate thousands of
  // players - except the handful the world has promised to keep, who go on existing
  // wherever they have ended up. Forgetting them is what used to make everybody else in
  // football scenery.
  for (const id of Object.keys(state.world.squads)) {
    if (keep.has(id)) continue;
    for (const pid of state.world.squads[id] ?? []) {
      if (pid !== state.player.id && !isTracked(state, pid)) delete state.world.players[pid];
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

/**
 * How much post he keeps. Big enough that the busiest week of the year - the last day of
 * a season - cannot bury a letter he has not read yet.
 */
const INBOX_LIMIT = 140;

function pushInbox(
  state: CareerState,
  category: InboxMessage['category'],
  titleKey: string,
  args?: Record<string, string | number>,
  decisionId?: string,
  action?: InboxMessage['action'],
): void {
  /*
   * A letter needs an identity of its own.
   *
   * The id was the season, the week and the length of the mailbox - and once the mailbox
   * is full that length stops changing, so two letters written in the same week were
   * given the same id. The screen uses that id as a key, the read marker uses it, and a
   * decision is attached to it: a manager could be sacked and replaced in one week and
   * only one of the two letters would exist as far as anything reading the inbox was
   * concerned. It is a counter now, and counters do not repeat.
   */
  const serial = Number(state.flags['inboxSerial'] ?? 0) + 1;
  state.flags['inboxSerial'] = serial;
  state.inbox.unshift({
    id: `msg_${state.world.season}_${state.world.week}_${serial}`,
    season: state.world.season,
    week: state.world.week,
    category,
    titleKey,
    ...(args ? { args } : {}),
    read: false,
    ...(decisionId ? { decisionId } : {}),
    ...(action ? { action } : {}),
  });
  /*
   * Making room, without throwing away the post he has not opened.
   *
   * The mailbox was a hard eighty and the end of a season pushes far more than eighty
   * messages in a single tick - awards, the window, the summer's business, the new
   * campaign - so the ones written first were shoved off the end before he ever saw
   * them. That is how a manager could be sacked and appointed in the same week without
   * the player being told either thing. Read post goes first now, and only if there is
   * none of that does the oldest letter fall off.
   */
  while (state.inbox.length > INBOX_LIMIT) {
    const oldestRead = [...state.inbox].reverse().find((message) => message.read);
    const drop = oldestRead ?? state.inbox[state.inbox.length - 1]!;
    state.inbox = state.inbox.filter((message) => message.id !== drop.id);
  }
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

/**
 * His share of the senior football his club has played.
 *
 * Youth minutes sit in the same season record - a career page should show the thirty
 * games he played at fifteen - but they are not senior minutes, and everything that
 * reads this is asking about senior football: selection, development, the national
 * coaches, and whether he has outgrown the age group.
 */
export function minutesPct(state: CareerState): number {
  const stats = state.world.seasonStats[state.player.id];
  if (!stats) return 0;
  const club = userClub(state);
  const played = club ? state.world.competitions[club.competitionId]?.table[club.id]?.played ?? 0 : 0;
  if (played === 0) return 0;
  const youthMinutes = state.world.youth?.form.minutes ?? 0;
  const senior = Math.max(0, stats.minutes - youthMinutes);
  return clamp(senior / (played * 90), 0, 1);
}

/**
 * His share of the youth football his club has played, on the same scale as
 * `minutesPct`. A Sunday morning is still ninety minutes of football: it does not count
 * as senior experience, but it very much counts as training.
 */
export function youthMinutesPct(state: CareerState): number {
  const youth = state.world.youth;
  const clubId = state.player.clubId;
  if (!youth || !clubId) return 0;
  const comp = userYouthCompetition(state);
  const played = comp?.table[clubId]?.played ?? 0;
  if (played === 0) return 0;
  return clamp(youth.form.minutes / (played * 90), 0, 1);
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
  const injuriesAddedThisWeek = new Set<string>();

  // A split is created on Monday after the final regular-season round. Doing it before
  // fixture discovery means the first playoff match gets the same real build-up as any
  // other match rather than appearing only when Saturday is simulated.
  for (const competitionState of Object.values(state.world.competitions)) {
    const competition = index.competitionById.get(competitionState.competitionId);
    if (competition) ensureLeagueSplit(rng, competitionState, competition, week);
  }
  // The age groups play the same competition their clubs do, playoff and all: a boy in
  // the Israeli youth league finishes his season the way the seniors finish theirs.
  for (const [competitionId, youthState] of Object.entries(state.world.youth?.competitions ?? {})) {
    const parent = index.competitionById.get(youthParentId(competitionId));
    if (parent?.split) ensureLeagueSplit(rng, youthState, parent, week);
  }

  /*
   * A match he is standing in the middle of comes before the questions the week asks.
   *
   * These gates belong to the Monday: what the occasion means to him, a dilemma tied to
   * the fixture, a club coming back with its answer. On the pass that finishes an
   * answered team talk the week is not on Monday any more, it is in a dressing room at
   * half past four, and stopping it here left the second half unplayed with the break
   * already spent - the app showed a question, and behind it the match he had just been
   * watching had quietly gone back to the first minute. They wait until he is off the
   * pitch.
   */
  const finishingHalfTime = state.pendingHalfTime?.chosen !== undefined
    && !state.matchLog.some((match) => match.id === state.pendingHalfTime!.matchId);

  // 0a. The week before a big one starts on the Monday.
  const scheduledMatch = scheduledUserMatchThisWeek(state, index);
  const weekImportance = announceBigMatch(state, scheduledMatch);

  /*
   * 0a2. The build-up question, before the build-up is over.
   *
   * Asking him what a derby means to him after the derby has been played is not a
   * build-up, it is a post mortem. The occasion is put to him while the fixture is still
   * ahead of him, and the week does not start until he has answered: nothing has been
   * written to the world yet, so it simply runs again once he has.
   */
  if (club && !finishingHalfTime && weekImportance !== 'normal' && scheduledMatch && availableForFixture(state, scheduledMatch)) {
    const occasion = occasionMilestone(weekImportance);
    if (occasion && raiseMilestone(state, occasion, {
      force: true,
      key: `asked:${occasion}:fixture:${scheduledMatch?.key ?? `${state.world.season}:${state.world.week}`}`,
      args: scheduledMatch ? { opponent: scheduledMatch.opponentName } : undefined,
    })) {
      commitRng(state, rng);
      return { state, stopped: 'decision', log };
    }
  }

  // Fixture-bound dilemmas are not random stories to discover after the whistle. They
  // are tied to the actual match on the calendar and block the week until answered.
  if (club && !finishingHalfTime && scheduledMatch && raisePreMatchEvent(state, index, rng, scheduledMatch)) {
    commitRng(state, rng);
    return { state, stopped: 'decision', log };
  }

  /*
   * 0a3. The club that watched him comes back with an answer.
   *
   * Flying out for a trial, or playing in front of a stand full of scouts, used to end
   * there: no letter, no phone call, nothing. Whoever looked at him now makes his mind
   * up in his own time and says so either way - a contract on the table, or a no.
   */
  if (club && !finishingHalfTime && resolveWatchingVerdict(state, index, rng)) {
    commitRng(state, rng);
    return { state, stopped: 'decision', log };
  }

  // 0. Nothing waits for ever. A club that hears nothing back signs someone else and
  // an agent stops calling, otherwise unanswered approaches pile up and quietly choke
  // off every other event in the game.
  expireDecisions(state);

  /*
   * A contract that ran out and was never settled.
   *
   * Renewals are a question now, and a question can be lost - a save restored mid-answer,
   * a harness that drops decisions, a screen that never showed it. Left alone, that is a
   * player at a club on a contract that ended two seasons ago, which is not a state
   * football has. The terms on the table are signed if there are any, and if there are
   * none he is out of contract and the market can have him.
   */
  if (club && state.contract && state.contract.endSeason < season
    && !state.pendingDecisions.some((decision) => decision.eventId === 'contractRenewal')) {
    const salary = Number(state.flags['renewalSalary'] ?? 0);
    if (salary > 0) signRenewal(state, salary, Number(state.flags['renewalYears'] ?? 2));
    else releaseFromClub(state, index, rng, 'withdrawn');
    commitRng(state, rng);
  }

  // 1. The training week happens before selection and the match it is preparing for.
  // The absolute-week marker matters at half time: resuming replays the fixture from
  // its seed, but must not train the player or roll a training injury twice.
  const lightLoad = Boolean(state.flags['reducedLoad']);
  const weekPlan = lightLoad ? { ...state.training, intensity: EASIER[state.training.intensity] } : state.training;
  const absoluteWeek = season * WEEKS_PER_SEASON + week;
  if (Number(state.flags['trainingResolvedWeek'] ?? -1) !== absoluteWeek) {
    const aggWeeks = Number(state.flags['aggravationWeeks'] ?? 0);
    if (aggWeeks > 0) {
      state.flags['aggravationWeeks'] = aggWeeks - 1;
      const weeklyRisk = Number(state.flags['aggravationRisk'] ?? 0) / AGGRAVATION_SPREAD;
      if (weeklyRisk > 0 && rng.chance(weeklyRisk)) {
        // A setback on the one he is carrying, not a second injury off the full table.
        const carrying = player.condition.injuries[0];
        const again = carrying
          ? rollSetback(rng, carrying, season)
          : rollInjury(rng, player, season, 1.4);
        again.aggravated = true;
        addInjury(player, again);
        injuriesAddedThisWeek.add(again.id);
        state.flags['aggravationWeeks'] = 0;
        pushNews(state, 'news.injured', { weeks: again.weeksOut }, 'high');
        reportInjury(state, again, 'aggravated');
      }
    }

    applyTrainingCondition(player, weekPlan);
    const campFocus = String(state.flags[`campRecommendedFocus:${season}`] ?? '');
    const campIntensity = String(state.flags[`campRecommendedIntensity:${season}`] ?? '');
    if (
      week <= PRESEASON_END_WEEK
      && Boolean(state.flags[`trainingCamp:${season}`])
      && weekPlan.focus === campFocus
      // The plan is the focus and the load together. Doing the right work at the wrong
      // intensity is not the block the staff asked for.
      && (!campIntensity || weekPlan.intensity === campIntensity)
    ) {
      // Following the staff's individual plan is noticed and gets more useful coaching.
      state.flags[`campFollowedCoach:${season}:${week}`] = true;
      state.managerTrust = clamp(state.managerTrust + 1, 0, 100);
      state.relationships.manager = state.managerTrust;
    }
    if (!isInjured(player) && rng.chance(trainingInjuryChance(player, weekPlan, season))) {
      const injury = rollInjury(rng, player, season);
      addInjury(player, injury);
      injuriesAddedThisWeek.add(injury.id);
      pushNews(state, 'news.injured', { weeks: injury.weeksOut }, 'high');
      reportInjury(state, injury, 'training');
    }
    state.flags['trainingResolvedWeek'] = absoluteWeek;
  }

  // 2. Domestic and international fixtures. A match he is playing stops at the interval
  // the first time through: nothing has been written to the world at that point, so the
  // week simply starts again once he has been told what the second half looks like.
  const injuriesBeforeMatch = new Set(player.condition.injuries.map((injury) => injury.id));
  let userMatch: MatchResult | null;
  try {
    userMatch = simulateWeekFixtures(state, index, rng, club);
  } catch (error) {
    if (!(error instanceof HalfTimeInterrupt)) throw error;
    commitRng(state, rng);
    return { state, stopped: 'halfTime', log };
  }
  if (userMatch) {
    /*
     * The match of the week, and the one the game will open on.
     *
     * Every match he plays writes itself to lastMatch as it finishes, so a week holding
     * a youth match and a cup tie ended up pointing at whichever was simulated last -
     * and the app, which plays back lastMatch, took him out of the youth match he was
     * watching and into somebody else's. simulateWeekFixtures already decides which of
     * a week's matches is the one that matters; it now gets the last word.
     */
    state.lastMatch = userMatch;
    playedThisWeek += userMatch.userLine?.minutes ?? 0;
    stopped = 'match';
    log.push(`match ${userMatch.homeClubId} ${userMatch.homeGoals}-${userMatch.awayGoals} ${userMatch.awayClubId}`);
  }

  /*
   * Camp plays twice a week, and both matches are his to watch.
   *
   * The week pauses on the whistle of the midweek friendly rather than playing the
   * weekend one behind it. Nothing past this point has run, so continuing simply walks
   * the same week again: training is already marked resolved, the first friendly is
   * marked played, and the second one kicks off. The minutes of both reach development
   * through `campMinutes`, which is read once the week is allowed to finish.
   */
  if (userMatch && week <= PRESEASON_END_WEEK && nextCampSlot(state) !== null) {
    commitRng(state, rng);
    return { state, stopped: 'match', log };
  }
  if (week <= PRESEASON_END_WEEK) {
    const minutesKey = `campMinutes:${season}:${week}`;
    if (state.flags[minutesKey] !== undefined) {
      playedThisWeek = Number(state.flags[minutesKey]);
      delete state.flags[minutesKey];
    }
  }
  for (const injury of player.condition.injuries) {
    if (!injuriesBeforeMatch.has(injury.id)) injuriesAddedThisWeek.add(injury.id);
  }

  // A player who began the week injured remains unavailable for this fixture, then
  // completes that recovery week. A training or match injury starts at its full length.
  const healed = tickInjuries(player, injuriesAddedThisWeek);
  for (const injury of healed) {
    pushInbox(state, 'medical', 'inbox.injuryHealed', { type: `injury.${injury.type}` });
    if (injury.severity === 'serious' || injury.severity === 'major' || injury.severity === 'careerThreatening') {
      state.flags['returnedFromLayoff'] = true;
    }
  }

  // 3. Match recovery and development, once the week's minutes are known.
  const comp = userCompetition(state, index);
  // An academy player is playing youth football we don't simulate match by match,
  // but he is playing: development must not treat him as a benched senior.
  // A boy playing thirty youth matches a year is developing, whatever the senior table
  // says about him. Youth minutes are not senior experience, but they are football.
  const developmentMinutes = isAcademyPlayer(state)
    ? 0.68
    : Math.max(minutesPct(state), youthMinutesPct(state) * 0.85);
  const trainingCtx = {
    training: weekPlan,
    coachQuality: (club?.training ?? 45) + (state.flags[`campFollowedCoach:${season}:${week}`] ? 10 : 0),
    facilities: club?.academy ?? 45,
    minutesPct: developmentMinutes,
    competitiveLevel: comp?.reputation ?? 35,
    inSeason: week >= FIRST_MATCH_WEEK && week <= LAST_MATCH_WEEK,
  };
  applyMatchCondition(player, weekPlan, playedThisWeek);
  const dev = developWeek(rng, player, season, trainingCtx);
  if (Math.round(dev.ovrAfter) > Math.round(dev.ovrBefore)) {
    log.push(`ovr ${dev.ovrBefore} -> ${dev.ovrAfter}`);
  }

  // 3b. The life outside football: what the sponsors pay, what the house costs, and
  // whether anybody new wants him on a poster this week.
  const life = runLifeWeek(state);
  for (const deal of life.expired) {
    pushInbox(state, 'sponsor', 'inbox.sponsorEnded', { kind: `life.sponsor.${deal.kind}` });
  }
  if (!state.retired) {
    const offers = raiseSponsorOffers(rng, state);
    if (offers.length > 0) {
      pushInbox(state, 'sponsor', 'inbox.sponsorOffer', {
        kind: `life.sponsor.${offers[0]!.kind}`,
        weekly: offers[0]!.weekly,
      });
    }
  }

  // 4. Wages, and what he spends on himself.
  if (state.contract) {
    // The agent's commission is real money, taken off the wage every week he is signed.
    const gross = state.contract.salaryPerWeek;
    const commission = agentCommission(state.agent, gross);
    state.finances.balance += gross - commission;
    state.finances.careerEarnings += gross - commission;
    if (commission > 0) state.flags['agentFeesPaid'] = Number(state.flags['agentFeesPaid'] ?? 0) + commission;

    // Eating like a professional is a bill. It is paid out of what he has, and when he
    // cannot cover it he eats a step worse - which is the point of the wage.
    const cost = dietCost(state.training.diet, gross);
    if (cost > 0) {
      if (state.finances.balance >= cost) {
        state.finances.balance -= cost;
        state.flags['dietPaid'] = Number(state.flags['dietPaid'] ?? 0) + cost;
      } else {
        const cheaper: Record<string, CareerState['training']['diet']> = {
          nutritionist: 'professional',
          professional: 'normal',
        };
        const stepped = cheaper[state.training.diet];
        if (stepped) {
          pushInbox(state, 'personal', 'inbox.dietUnaffordable', {
            cost,
            diet: `train.diet.${state.training.diet}`,
            now: `train.diet.${stepped}`,
          });
          state.training = { ...state.training, diet: stepped };
        }
      }
    }
  }

  // 5. National team. Scouting interest is live every week, not only when an
  // international window happens to open. Injuries, recovery sharpness, minutes and
  // form therefore change the number the player sees as they change.
  const nationalCtx = club ? nationalContextFor(state, index, club) : null;
  if (nationalCtx) updateNationalInterest(nationalCtx);
  // And the other federation, if there is one, picks up the phone.
  if (nationalCtx) openAssociationApproach(state, index, rng);
  // The squad for next week's window is named this week, the way squads are.
  if (nationalCtx) announceCallUp(state, index, rng, nationalCtx);
  let nationalMatchThisWeek: MatchResult | null = null;
  if (INTERNATIONAL_WEEKS.includes(week)) {
    const qualifierDue = Boolean(state.campaign?.fixtures.some((fixture) => (
      !fixture.played
      && fixture.week === week
      && (fixture.homeCountry === state.campaign?.countryCode || fixture.awayCountry === state.campaign?.countryCode)
    )));
    const seniorCallUp = club && nationalCtx
      ? handleInternationalWeek(state, index, rng, nationalCtx, qualifierDue)
      : false;
    // Qualifiers run whether or not he is in the squad: his country plays either way,
    // and a table he is not in is still the table that decides his summer.
    playQualifiers(state, index, rng, seniorCallUp);
    const nationalMatchId = String(state.flags['nationalMatchId'] ?? '');
    if (Number(state.flags['nationalMatchThisWeek'] ?? -1) === absoluteWeek) {
      nationalMatchThisWeek = state.matchLog.find((match) => match.id === nationalMatchId) ?? null;
      if (nationalMatchThisWeek) {
        state.lastMatch = nationalMatchThisWeek;
        stopped = 'match';
        log.push(
          `national ${nationalMatchThisWeek.homeClubId} ${nationalMatchThisWeek.homeGoals}-${nationalMatchThisWeek.awayGoals} ${nationalMatchThisWeek.awayClubId}`,
        );
      }
    }
  }

  // 6. Transfer window activity. A player who just moved is not on the market again
  // a fortnight later, so interest only builds up after he has settled.
  const weeksSinceTransfer = season * 52 + week - Number(state.flags['lastTransferWeek'] ?? 0);
  const settled = weeksSinceTransfer >= 20;
  const listed = Boolean(state.flags['transferListed']);
  // Clubs come once per window, not every fortnight, and nobody plays for three clubs
  // in one season: two moves is the limit, the way registration rules work.
  const windowId = windowIdFor(season, week, club?.country);
  const approachedThisWindow = state.flags['offerWindow'] === windowId;
  const movesThisSeason = Number(state.flags['movesThisSeason'] ?? 0);
  const offerChance = listed ? 0.5 : state.flags['transferRequested'] ? 0.42 : 0.28;

  if (
    isTransferWindow(week, club?.country) &&
    club &&
    settled &&
    marketWouldMove(state) &&
    !approachedThisWindow &&
    movesThisSeason < 2 &&
    state.transferOffers.length === 0 &&
    rng.chance(offerChance)
  ) {
    const share = isAcademyPlayer(state) ? youthMinutesPct(state) : recentMinutesShare(state);
    // A young player who cannot get on the pitch is offered a loan instead of a move.
    const loans = generateLoanOffers({ state, index, rng, minutesPct: share });
    const offers = loans.length > 0 && rng.chance(state.flags['wantsLoan'] ? 0.95 : 0.7)
      ? loans
      : generateOffers({ state, index, rng, minutesPct: share });
    if (offers.length > 0) {
      state.flags['offerWindow'] = windowId;
      state.transferOffers = offers;
      // The public story precedes the formal approach. Previously both decisions were
      // queued together, the offer sheet won, and the player could sign before being
      // asked about a "rumour" that was already true.
      const rumourRaised = raiseMilestone(state, 'transferRumour', {
        force: true,
        key: `asked:transferRumour:window:${windowId}`,
        args: { club: state.world.clubs[offers[0]!.clubId]?.name ?? '' },
      });
      if (!rumourRaised) openOfferDecision(state, offers);
      pushNews(state, 'news.transferInterest', { club: state.world.clubs[offers[0]!.clubId]?.name ?? '' }, 'medium');
    }
  }

  /*
   * 6b. Out of contract, and nobody ringing.
   *
   * Every approach above needs a club to approach him at, so a released player fell out
   * of the market entirely: the phone went quiet the day his contract ended and stayed
   * quiet until he was old enough for the game to retire him. A free agent can sign in
   * any week of the year - that is the one advantage of being one - so he is offered
   * something roughly once a month until he takes it.
   */
  const clublessSince = Number(state.flags['clublessSince'] ?? 0);
  if (!club && !state.retired) {
    const absolute = season * 52 + week;
    if (clublessSince === 0) state.flags['clublessSince'] = absolute;
    const lastCall = Number(state.flags['freeAgentCall'] ?? 0);
    if (state.transferOffers.length === 0 && absolute - lastCall >= 4) {
      state.flags['freeAgentCall'] = absolute;
      // Without a club he has no minutes to show and no level to be measured against,
      // so this is the market at its most generous: whoever needs a player.
      const offers = marketWouldMove(state)
        ? generateOffers({ state, index, rng, minutesPct: 0, maxOffers: 4 })
        : [];
      if (offers.length > 0) {
        state.transferOffers = offers;
        openOfferDecision(state, offers);
        pushInbox(state, 'club', 'inbox.freeAgentInterest', {
          club: state.world.clubs[offers[0]!.clubId]?.name ?? '',
          count: offers.length,
        });
      }
    }
  } else if (club && clublessSince !== 0) {
    state.flags['clublessSince'] = 0;
  }

  // 7. Agent offers early in the career.
  const agentSeason = club?.country;
  const agentWindowOpen = isTransferWindow(week, agentSeason) || isWindowApproaching(week, agentSeason);
  if (state.flags['agentSwitchOffer'] && state.agent) {
    // He said he would listen: the old one is gone and the shortlist is on the table.
    state.flags['agentSwitchOffer'] = false;
    state.agent = null;
  }

  if (
    !state.agent &&
    state.agentOffers.length === 0 &&
    player.reputation >= 10 &&
    agentWindowOpen &&
    state.flags['agentWindow'] !== windowId &&
    rng.chance(0.5)
  ) {
    const ovr = overall(player.attributes, player.primaryPos, player.secondaryPos);
    state.agentOffers = generateAgentOffers(rng, index, player, ovr, season - player.birthYear);
    if (state.agentOffers.length > 0) {
      state.flags['agentWindow'] = windowId;
      openAgentDecision(state, state.agentOffers);
    }
  }

  // 7a2. The old player, on the weeks he has a reason. He is not a help page: sometimes
  // he is the one who starts the conversation, and what he asks is the awkward question.
  raiseMentorPrompt(state, rng);

  // 7b. The people who have something to say about a bad month, one at a time.
  reactToBadRun(state, index);

  // 7c. The press, on the weeks the press cares.
  if (club) {
    // Match-specific press reactions belong only to a match the player actually played.
    // The senior side's occasion must never be presented as an academy player's story.
    const playedImportance = userMatch?.userLine?.played ? (userMatch.importance ?? 'normal') : 'normal';
    askTheMedia(state, index, playedImportance);
  }

  // A post-match conversation is only raised when the match log proves its premise.
  // It stays in the inbox so the player still sees the match report first.
  if (userMatch) raisePostMatchEvent(state, index, rng, userMatch);

  // 8. Career events. His life keeps happening at the same rate; what changed is how
  // much of it is allowed to stop him. A season holds a handful of real forks - a move,
  // an operation, a contract - and a great deal of noise around them, and being asked
  // twenty times a year to pick between two paragraphs turns every one of them into
  // noise. So the forks block, the noise goes in the mailbox, and there is a ceiling on
  // how many forks one season can hold.
  const storyPending = state.pendingDecisions.some((d) => d.kind === 'event' && d.blocking !== false);
  const colourPending = state.pendingDecisions.filter((d) => d.kind === 'event' && d.blocking === false).length;
  const storiesThisSeason = Number(state.flags['storiesThisSeason'] ?? 0);

  if (!storyPending && colourPending < 2 && rng.chance(0.36)) {
    const ctx = buildEventContext(state, index);
    const def = pickEvent(rng, index.pack.events.filter((event) => !FIXTURE_BOUND_EVENTS.has(event.id)), ctx, state);
    if (def) {
      const story = isStoryEvent(def);
      // Past the ceiling, the week's question is one he reads rather than one he is
      // stopped for. The story keeps for another season.
      if (!story || storiesThisSeason < STORIES_PER_SEASON) {
        const decision = toPendingDecision(def, ctx.absoluteWeek);
        state.pendingDecisions.push(decision);
        pushInbox(state, def.category === 'media' ? 'media' : def.category, def.textKey, undefined, decision.id);
        if (decision.blocking) {
          state.flags['storiesThisSeason'] = storiesThisSeason + 1;
          stopped = 'decision';
        }
      }
    }
  } else if (state.pendingDecisions.some((d) => d.blocking !== false)) {
    stopped = 'decision';
  }

  /*
   * A match he was on the pitch for is the week.
   *
   * A story raised after the football used to take the week's stopping point away from
   * it, so the app never opened the match centre and the score turned up later in the
   * results list - which is what a pre-season camp, where stories are thick on the
   * ground, looked like from the outside. The question is not lost: it stays in
   * `pendingDecisions` and is put to him the moment he leaves the match.
   */
  if (userMatch?.userLine?.played) stopped = 'match';

  // A selected international fixture is a real match day, not a background message.
  // Preserve it as the week's stopping point even if a later story was also generated;
  // the decision remains queued and the match centre opens first.
  if (nationalMatchThisWeek) {
    state.lastMatch = nationalMatchThisWeek;
    stopped = 'match';
  }

  // 9. The people around him react to the week just played.
  state.socialActions.used = 0;
  if (club) resolveManagerChange(state, index, rng, club);
  driftMorale(state);
  // Form must include today's match before the manager reacts to it. Previously this
  // ran after consequences, so a collapse or recovery reached the team sheet one week
  // late.
  /*
   * The last five matches, and only the recent ones.
   *
   * This used to take the last five he played this season with no window on it, so a
   * bad run he had in September was still the whole of his form line in November if he
   * had not played since - and it kept dragging him further down every idle week,
   * because the same five ratings were re-averaged with nothing newer to answer them.
   * A run that old is not form any more. Six weeks out of the window and it drops, and
   * the idle drift toward the middle takes over, which is what a player who has not
   * kicked a ball in a month and a half actually has: no form, rather than last
   * autumn's.
   */
  const recentRatings = state.matchLog
    .filter((m) => m.userLine?.played && (season * 52 + state.world.week) - (m.season * 52 + m.week) <= FORM_WINDOW_WEEKS)
    .slice(0, 5)
    .map((m) => m.userLine!.rating);
  updateForm(player, recentRatings);
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

  // 10. Market value follows the newly updated form.
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
/** One step down the intensity ladder, for a player who has been told to ease off. */
const EASIER: Record<TrainingIntensity, TrainingIntensity> = {
  extreme: 'intensive',
  intensive: 'normal',
  normal: 'light',
  light: 'light',
};

/**
 * How many of his own stories in a season are allowed to stop him. Transfer approaches
 * and agents stop him on top of these, because a club waiting for an answer cannot be
 * left in a mailbox - which puts a season at seven or eight real forks in total.
 */
const STORIES_PER_SEASON = 5;

/** An aggravation risk is spread over the weeks it takes to trust the leg again. */
const AGGRAVATION_SPREAD = 6;

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

/**
 * Competitive matches behind him, the age group included and the friendlies left out.
 *
 * A boy in his first pre-season has none of them, which is the point: nobody flies a
 * player abroad for a trial on the strength of three camp friendlies he has not played
 * yet.
 */
function careerApps(state: CareerState): number {
  const past = state.seasonHistory.reduce((sum, record) => sum + record.apps, 0);
  const thisSeason = state.matchLog.filter((match) => (
    match.season === state.world.season
    && match.userLine?.played
    && !match.competitionId.startsWith('friendly')
  )).length;
  return past + thisSeason;
}

function buildEventContext(state: CareerState, index: PackIndex): EventContext {
  const club = userClub(state);
  const player = state.player;
  return {
    age: state.world.season - player.birthYear,
    absoluteWeek: state.world.season * 52 + state.world.week,
    seasonWeek: state.world.week,
    minutesPct: minutesPct(state),
    careerApps: careerApps(state),
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
/**
 * The press, on the weeks the press turns up.
 *
 * This is deliberately rare. A debut, a derby, a final, the first game after a move, the
 * week the rumours start - and nothing in between, because a microphone every Thursday is
 * a chore rather than a moment. What he says moves real numbers, and if he makes a claim
 * he then has to go and back it up on the pitch.
 */
/** How long the press leaves him alone between questions. */
const MEDIA_COOLDOWN_WEEKS = 4;

/** The things he is asked about whatever else the week held. */
const MUST_ANSWER = new Set<MilestoneId>(['sentOff', 'badRun', 'goalDrought', 'dropped', 'transferRumour']);

/**
 * Puts a question on the table, once per kind per season.
 *
 * A microphone every week is a chore, so anything the press turns up for of its own
 * accord waits for the cooldown. The handful of nights that belong to the player -
 * his debut, a first cap, a trophy - are not made to queue behind a bad run.
 */
function raiseMilestone(
  state: CareerState,
  id: MilestoneId,
  opts: {
    /** Skip the cooldown: something happened that the press does not wait four weeks for. */
    force?: boolean;
    /**
     * What counts as "already asked". Once a season for most things - nobody asks him
     * twice what a derby means - but a second red card is a second red card, and it gets
     * its own microphone.
     */
    key?: string;
    /** Fixture context used by the copy, so the question names the match it concerns. */
    args?: Record<string, string | number>;
  } = {},
): boolean {
  const askedKey = opts.key ?? `asked:${id}:${state.world.season}`;
  if (state.flags[askedKey]) return false;
  const question = milestoneById(id);
  if (!question) return false;
  if (state.pendingDecisions.some((decision) => decision.eventId.startsWith('milestone:'))) return false;

  const absolute = state.world.season * 52 + state.world.week;
  const last = Number(state.flags['lastMediaWeek'] ?? -999);
  if (!opts.force && absolute - last < MEDIA_COOLDOWN_WEEKS) return false;

  state.flags[askedKey] = true;
  state.flags['lastMediaWeek'] = absolute;
  // A professional debut at a new club is one human moment, not two interviews with
  // different internal IDs. Cover the generic new-shirt question when the debut has
  // already asked what the first appearance meant.
  if (id === 'debut') state.flags[`asked:firstAfterTransfer:${state.world.season}`] = true;

  const club = userClub(state);
  const decisionId = `milestone_${id}_${state.world.season}_${state.world.week}`;
  const copyVariant = milestoneCopyVariant(state, id);
  const copySuffix = copyVariant === 1 ? '' : `.v${copyVariant}`;
  // Derby questions change with the context, so their answers change with them too.
  // Reusing one stock phrase under three different questions produced literal,
  // irrelevant replies even when the underlying attitude/effects were correct.
  const answerCopySuffix = id === 'derby' || id === 'rivalMatch' ? copySuffix : '';
  const answers = question.answers.map((answer, index, all) => all[(index + copyVariant - 1) % all.length]!);
  state.pendingDecisions.push({
    id: decisionId,
    kind: 'event',
    eventId: `milestone:${id}`,
    category: 'media',
    textKey: `milestone.${id}${copySuffix}`,
    textArgs: { club: club?.name ?? '', ...(opts.args ?? {}) },
    options: answers.map((answer) => ({
      id: answer.id,
      labelKey: `milestone.${id}.${answer.id}${answerCopySuffix}`,
      // What it will cost him, said before he says it. He is allowed to be reckless;
      // he is not allowed to be reckless by accident.
      riskKey: `milestone.${id}.${answer.id}.${answer.risk}`,
      effects: [],
    })),
    blocking: true,
    expiresWeek: state.world.season * 52 + state.world.week + 2,
  });
  pushInbox(state, 'media', `milestone.${id}${copySuffix}`, { club: club?.name ?? '', ...(opts.args ?? {}) }, decisionId);
  return true;
}

/**
 * The summer conversation.
 *
 * Not for a boy in the academy - nobody sits a fifteen year old down and asks him for
 * eleven goals - and not for a player without a club. Everyone else gets asked what the
 * season is for, and gets to argue about it.
 */
function askWhatTheSeasonIsFor(state: CareerState, index: PackIndex): void {
  const player = state.player;
  if (state.retired || !player.clubId || isAcademyPlayer(state)) return;
  if (state.seasonGoal && state.seasonGoal.season === state.world.season) return;
  if (state.pendingDecisions.some((d) => d.eventId === 'seasonGoal')) return;

  const ctx = seasonGoalContext(state, index);
  const proposal = proposedGoal(ctx, 'agreed');
  const club = ctx.club;

  const decisionId = `seasonGoal_${state.world.season}`;
  state.pendingDecisions.push({
    id: decisionId,
    kind: 'event',
    eventId: 'seasonGoal',
    category: 'club',
    textKey: 'seasonGoal.ask',
    textArgs: {
      club: club?.name ?? '',
      minutes: Math.round(proposal.minutes * 100),
      contributions: proposal.contributions,
      ...(proposal.tablePosition !== null ? { position: proposal.tablePosition } : {}),
    },
    options: (['agreed', 'bold', 'safe'] as GoalStake[]).map((stake) => ({
      id: stake,
      labelKey: `seasonGoal.stake.${stake}`,
      riskKey: `seasonGoal.stake.${stake}.hint`,
      effects: [],
    })),
    blocking: true,
    expiresWeek: state.world.season * 52 + state.world.week + 6,
  });
}

/** The club, the league it is in and where that league expects it to finish. */
function seasonGoalContext(state: CareerState, index: PackIndex) {
  const club = userClub(state) ?? null;
  const comp = club ? state.world.competitions[club.competitionId] : undefined;
  const leagueSize = comp ? Object.keys(comp.table).length : 0;

  // Where the club belongs, by the strength of everyone else in the division. Last
  // season's finish would be truer, but a promoted club has no last season here.
  let expectedPosition: number | null = null;
  if (club && comp && leagueSize > 1) {
    const rivals = Object.keys(comp.table)
      .map((id) => state.world.clubs[id])
      .filter((c): c is Club => Boolean(c))
      .sort((a, b) => b.strength - a.strength);
    const at = rivals.findIndex((c) => c.id === club.id);
    expectedPosition = at >= 0 ? at + 1 : null;
  }

  return { state, club, expectedPosition, leagueSize };
}

/** He has said what he thinks of the brief; the season now has a target in it. */
export function answerSeasonGoal(
  state: CareerState,
  index: PackIndex,
  decisionId: string,
  optionId: string,
): DecisionResult | null {
  const at = state.pendingDecisions.findIndex((decision) => decision.id === decisionId);
  if (at === -1) return null;
  const stake = (['safe', 'agreed', 'bold'] as GoalStake[]).includes(optionId as GoalStake)
    ? (optionId as GoalStake)
    : 'agreed';

  state.pendingDecisions.splice(at, 1);
  const goal = proposedGoal(seasonGoalContext(state, index), stake);
  state.seasonGoal = goal;

  // Asking for the hard brief is itself a statement, and a manager hears it as one.
  if (stake === 'bold') adjustRelationship(state, 'manager', 3);
  if (stake === 'safe') adjustRelationship(state, 'manager', -2);

  pushInbox(state, 'manager', `seasonGoal.set.${stake}`, {
    minutes: Math.round(goal.minutes * 100),
    contributions: goal.contributions,
    ...(goal.tablePosition !== null ? { position: goal.tablePosition } : {}),
  });

  return { changes: [], consequences: [] };
}

/** What he actually did this season, in the same three terms the brief was written in. */
export function seasonGoalStanding(state: CareerState): ReturnType<typeof goalProgress> | null {
  const goal = state.seasonGoal;
  if (!goal || goal.season !== state.world.season) return null;
  const stats = state.world.seasonStats[state.player.id];
  const club = userClub(state);
  const comp = club ? state.world.competitions[club.competitionId] : undefined;
  const position = club && comp ? positionOf(comp, club.id) : null;

  return goalProgress(goal, {
    minutesPct: minutesPct(state),
    contributions: (stats?.goals ?? 0) + (stats?.assists ?? 0),
    position,
  });
}

/** The last day of the season: what the brief was worth. */
function settleSeasonGoal(state: CareerState, leaguePosition: number | null): void {
  const goal = state.seasonGoal;
  if (!goal || goal.settled || goal.season !== state.world.season) return;

  const stats = state.world.seasonStats[state.player.id];
  const progress = goalProgress(goal, {
    minutesPct: minutesPct(state),
    contributions: (stats?.goals ?? 0) + (stats?.assists ?? 0),
    position: leaguePosition,
  });
  const verdict = goalVerdict(goal, progress);

  adjustRelationship(state, 'manager', verdict.trust);
  state.player.morale = clamp(state.player.morale + verdict.morale, 0, 100);
  state.player.reputation = clamp(state.player.reputation + verdict.reputation, 0, 100);
  goal.settled = true;

  pushInbox(state, 'manager', `seasonGoal.verdict.${verdict.outcome}`, {
    minutes: Math.round(progress.minutesPct * 100),
    target: Math.round(goal.minutes * 100),
    contributions: progress.contributions,
    wanted: goal.contributions,
  });
}

/** The matches he has actually been on the pitch for this season, newest first. */
function recentAppearances(state: CareerState, count: number): UserMatchLine[] {
  return state.matchLog
    .filter((m) => m.season === state.world.season && m.userLine?.played)
    .slice(0, count)
    .map((m) => m.userLine!);
}

/**
 * What happened to him lately that somebody would want a word about.
 *
 * This is the half of the press that is not about the fixture list. A hat-trick, a
 * sending off, a month on the bench, four bad games in a row - the weeks a career is
 * actually decided in, and the ones nobody used to ask him about.
 */
function mediaMomentFor(state: CareerState, index: PackIndex): MilestoneId | null {
  const player = state.player;
  const club = userClub(state);
  /*
   * Only real football counts as something to be asked about.
   *
   * A camp friendly carries the importance 'friendly', which is not 'normal' - so a poor
   * afternoon in a pre-season kickabout in week six read as a poor afternoon on a big
   * night, and the pundits were on him about a match nobody watched. Three goals in a
   * friendly is not a hat-trick either.
   */
  const competitive = state.lastMatch
    && !state.lastMatch.competitionId.startsWith('friendly')
    && state.lastMatch.season === state.world.season;
  const last = competitive ? state.lastMatch?.userLine : undefined;

  if (last?.played) {
    if (last.goals >= 3) return 'hatTrick';
    if (last.red > 0) return 'sentOff';
  }

  // Back from something that kept him out for months.
  if (state.flags['returnedFromLayoff']) {
    state.flags['returnedFromLayoff'] = false;
    return 'injuryReturn';
  }

  // Dropped: he was starting, and now he is not being picked at all.
  const seasonMatches = state.matchLog.filter((m) => m.season === state.world.season && m.userLine);
  const lastFour = seasonMatches.slice(0, 4).map((m) => m.userLine!);
  if (
    lastFour.length === 4 &&
    !lastFour[0]!.played &&
    lastFour[0]!.reasonNotPlayed === 'notSelected' &&
    lastFour.slice(1).every((line) => line.started)
  ) {
    return 'dropped';
  }

  const appearances = recentAppearances(state, 5);

  /*
   * A forward who is not scoring.
   *
   * This asked for five straight blanks from a man whose position group is ATT, and in
   * ten full careers it never once came up: five is most of a drought that a striker in
   * this engine simply does not have, and a wide midfielder who is picked as the number
   * ten all season is never in the group at all. Four matches without a goal or an
   * assist is a drought anybody at the club would have mentioned by now, and the
   * question is asked of whoever is being played up there.
   */
  const group = positionGroup(last?.position ?? player.primaryPos);
  const attacking = group === 'ATT' || positionGroup(player.primaryPos) === 'ATT';
  if (
    attacking &&
    appearances.length >= 4 &&
    appearances.slice(0, 4).every((entry) => entry.goals === 0 && entry.assists === 0)
  ) {
    return 'goalDrought';
  }

  // A poor night on a big night is the one they replay. A poor night in July is not.
  const lastResult = competitive ? state.lastMatch : null;
  if (
    lastResult?.userLine?.played &&
    lastResult.importance &&
    lastResult.importance !== 'normal' &&
    lastResult.importance !== 'friendly' &&
    lastResult.userLine.rating < 6.0
  ) {
    return 'punditCriticism';
  }

  // The remaining stories describe the senior club's table, contract spotlight and
  // upcoming senior opposition. They are not questions for a player still in academy
  // football; his own goals, form, cards and injuries above remain valid media moments.
  if (isAcademyPlayer(state)) return null;

  // The run-in, from the wrong end of the table.
  if (club && state.world.week >= 26) {
    const compState = state.world.competitions[club.competitionId];
    if (compState) {
      const rows = sortedTable(compState);
      const place = rows.findIndex((row) => row.clubId === club.id);
      if (place >= 0 && place >= rows.length - 3 && rows[place]!.played >= 15) return 'relegationFight';
    }
  }

  // A contract running down with nothing signed is a story before it is a decision.
  if (
    state.contract &&
    state.contract.endSeason <= state.world.season &&
    state.world.week >= 20 &&
    player.reputation >= 25
  ) {
    return 'contractStandoff';
  }

  /*
   * Somebody from the other lot had something to say.
   *
   * It used to need a derby still ahead of him on the league fixture list, and the
   * occasion question already asked this season - two rare things at once, in a list
   * that only looks at the league, so it never happened. A rivalry is a rivalry the week
   * before it and the week after it, and the one they played on Sunday counts.
   */
  const nextImportance = upcomingImportance(state, index);
  const lastImportance = state.lastMatch?.season === state.world.season
    ? state.lastMatch.importance ?? 'normal'
    : 'normal';
  const rivalry = (value: MatchImportance) => value === 'derby' || value === 'rival' || value === 'vsFormerClub';
  const alreadyAsked = state.flags[`asked:derby:${state.world.season}`]
    || state.flags[`asked:rivalMatch:${state.world.season}`]
    || state.flags[`asked:againstOldClub:${state.world.season}`];
  if ((rivalry(nextImportance) || rivalry(lastImportance)) && alreadyAsked) {
    return 'rivalDig';
  }

  return null;
}

/** The importance of the fixture he is about to play, if there is one this week. */
function upcomingImportance(state: CareerState, index: PackIndex): MatchImportance {
  const club = userClub(state);
  if (!club || isAcademyPlayer(state)) return 'normal';
  const compState = state.world.competitions[club.competitionId];
  const fixture = compState?.fixtures.find(
    (f) => !f.played && f.week >= state.world.week && (f.homeClubId === club.id || f.awayClubId === club.id),
  );
  if (!fixture) return 'normal';
  return matchImportanceFor(state, index, club.competitionId, fixture.homeClubId, fixture.awayClubId);
}

/**
 * A bad run, and the three people who have something to say about it.
 *
 * Four afternoons under six and a half is the point at which a football club starts
 * talking about a player, and it is never the same voice twice: the manager has a word
 * on the training ground, the crowd lets him know at the ground, and the press asks him
 * about it in front of a camera. They take turns, a fortnight apart, so a bad month is
 * three different kinds of pressure rather than one message repeated.
 */
function reactToBadRun(state: CareerState, index: PackIndex): void {
  const club = userClub(state);
  if (!club || state.retired) return;
  const recent = recentAppearances(state, 4);
  const badRun = recent.length >= 4 && recent.every((line) => line.rating < 6.5);
  // The rota is not reset when the run ends: the next bad month is somebody else's turn,
  // so a career hears from all three rather than from the manager every time.
  if (!badRun) return;
  const absolute = state.world.season * 52 + state.world.week;
  if (absolute - Number(state.flags['badRunSpoke'] ?? -99) < 4) return;
  state.flags['badRunSpoke'] = absolute;

  const average = recent.reduce((sum, line) => sum + line.rating, 0) / recent.length;
  const voice = Number(state.flags['badRunVoice'] ?? 0) % 3;
  state.flags['badRunVoice'] = voice + 1;

  if (voice === 0) {
    // The manager, on the training ground, on the Monday.
    adjustRelationship(state, 'manager', -3);
    pushInbox(state, 'manager', 'inbox.badRun.manager', {
      games: recent.length,
      rating: average.toFixed(1),
    });
    return;
  }
  if (voice === 1) {
    // The ground. Nobody says it to his face and everybody says it.
    adjustRelationship(state, 'fans', -4);
    state.player.morale = clamp(state.player.morale - 3, 0, 100);
    pushInbox(state, 'media', 'inbox.badRun.fans', { club: club.name });
    return;
  }
  // And the press, who would like him to say something about it.
  if (!raiseMilestone(state, 'badRun', { force: true, key: `asked:badRun:${absolute}` })) {
    pushInbox(state, 'media', 'inbox.badRun.press', { games: recent.length });
  }
  void index;
}

/**
 * The two ways a microphone finds him: the fixture list, and his own life. The fixture
 * comes first - a derby is a derby - and what he has been doing fills the other weeks.
 */
function askTheMedia(state: CareerState, index: PackIndex, importance: MatchImportance): void {
  const weeksAtNewClub =
    state.world.season * 52 + state.world.week - Number(state.flags['lastTransferWeek'] ?? -999);
  const concreteOfferOpen = state.pendingDecisions.some((decision) => decision.kind === 'transfer');
  const rumoured = !concreteOfferOpen
    && (state.transferOffers.length > 0 || Boolean(state.flags['transferRequested']));
  // Fixture occasions are raised before training and kick-off. This end-of-week pass is
  // exclusively for reactions to what actually happened and background career news.
  void importance;
  /*
   * The weeks he does not get to walk past.
   *
   * A sending off, four bad games, a month without a goal - these are reactions to
   * something that just happened to him, and holding them behind a four week cooldown
   * meant the one question the player actually wanted to answer was the one the game
   * quietly swallowed. A red card asks every time it happens rather than once a season.
   */
  const momentId = mediaMomentFor(state, index);
  if (momentId) {
    const demanded = MUST_ANSWER.has(momentId);
    let occurrenceKey: string | undefined;
    if (momentId === 'sentOff' && state.lastMatch) {
      const incident = state.lastMatch;
      occurrenceKey = `asked:sentOff:match:${incident.id}`;
      // Saves created before incident-based keys used the week in which the interview
      // appeared. The first interview normally happened in the match week, so honour
      // that marker and do not make an existing career answer the same red once more
      // after upgrading.
      const legacyKey = `asked:sentOff:${incident.season}:${incident.week}`;
      if (state.flags[legacyKey]) state.flags[occurrenceKey] = true;
    }
    const raised = raiseMilestone(state, momentId, {
      force: demanded,
      ...(occurrenceKey ? { key: occurrenceKey } : {}),
    });
    if (raised) return;
  }
  // Only the questions that belong to the week rather than to the fixture: the occasion
  // has already been put to him, before he played it.
  const fallbackId = backgroundMilestone({ weeksAtNewClub, rumoured });
  if (fallbackId) raiseMilestone(state, fallbackId);
}

/**
 * Answering the press. The trade is applied and handed straight back, so what he said
 * is followed by what it cost him; any claim inside it is left for the pitch to settle.
 */
export function answerMedia(
  state: CareerState,
  index: PackIndex,
  decisionId: string,
  optionId: string,
): DecisionResult | null {
  const at = state.pendingDecisions.findIndex((decision) => decision.id === decisionId);
  if (at === -1) return null;
  const decision = state.pendingDecisions[at]!;
  const id = decision.eventId.replace('milestone:', '') as MilestoneId;
  const question = milestoneById(id);
  const answer = question?.answers.find((entry) => entry.id === optionId);
  if (!answer) return null;

  state.pendingDecisions.splice(at, 1);
  const result = applyMilestoneAnswer(state, answer);
  // What he said, so the result sheet can print it back at him.
  result.answerKey = decision.options.find((entry) => entry.id === optionId)?.labelKey;

  // Once he has answered the rumour, the concrete terms can be presented. This keeps
  // the two interactions in chronological order without making the player advance an
  // otherwise empty extra week.
  if (
    id === 'transferRumour'
    && state.transferOffers.length > 0
    && !state.pendingDecisions.some((pending) => pending.kind === 'transfer')
  ) {
    openOfferDecision(state, state.transferOffers);
  }

  // Naming somebody costs nothing at the microphone. It costs later.
  if (answer.grudge) {
    const target = resolveGrudgeTarget(state, index, answer.grudge.against);
    if (target) {
      state.flags['grudgeClubId'] = target;
      state.flags['grudgeUntilWeek'] = state.world.season * 52 + state.world.week + 20;
      pushNews(
        state,
        'news.grudge',
        { player: `${state.player.firstName} ${state.player.lastName}`, club: state.world.clubs[target]?.name ?? '' },
        'medium',
      );
    }
  }

  return result;
}

/**
 * The club he has an open account with, while the account is still open. Saying
 * something about a side in public buys him a fixture with an edge on it, and the edge
 * expires if the fixture never comes.
 */
export function grudgeClubId(state: CareerState): string | null {
  const id = state.flags['grudgeClubId'];
  if (typeof id !== 'string' || id === '') return null;
  const until = Number(state.flags['grudgeUntilWeek'] ?? 0);
  if (state.world.season * 52 + state.world.week > until) return null;
  return state.world.clubs[id] ? id : null;
}

/** The club a public dig lands on: whoever is next, or the club that sold him. */
function resolveGrudgeTarget(state: CareerState, index: PackIndex, against: 'nextOpponent' | 'oldClub'): string | null {
  if (against === 'oldClub') {
    const previous = state.flags['previousClubId'];
    return typeof previous === 'string' && state.world.clubs[previous] ? previous : null;
  }
  const club = userClub(state);
  if (!club) return null;
  const compState = state.world.competitions[club.competitionId];
  const fixture = compState?.fixtures.find(
    (f) => !f.played && f.week >= state.world.week && (f.homeClubId === club.id || f.awayClubId === club.id),
  );
  if (!fixture) return null;
  void index;
  return fixture.homeClubId === club.id ? fixture.awayClubId : fixture.homeClubId;
}

type ScheduledMatchSource = 'league' | 'cup' | 'europe' | 'youth';

interface ScheduledUserMatch {
  source: ScheduledMatchSource;
  competitionId: string;
  homeClubId: string;
  awayClubId: string;
  opponentName: string;
  importance: MatchImportance;
  key: string;
}

/**
 * The match that is genuinely waiting for the player this week.
 *
 * The old build-up only looked in the domestic league table. A cup final or European
 * semi-final therefore became visible to the conversation system only after it had
 * already been simulated. This collects every senior competition before any football
 * is played and chooses the most important fixture when a congested week contains two.
 */
function scheduledUserMatchThisWeek(state: CareerState, index: PackIndex): ScheduledUserMatch | null {
  const club = userClub(state);
  if (!club || state.world.week <= PRESEASON_END_WEEK) return null;
  const week = state.world.week;

  // An academy player reads his own Sunday fixture list. This is deliberately resolved
  // before any senior calendar is inspected: a first-team final belongs to the club,
  // but it is not his match unless he has actually been promoted into that squad.
  if (isAcademyPlayer(state)) {
    const competition = userYouthCompetition(state);
    const fixture = competition?.fixtures.find(
      (entry) => !entry.played
        && entry.week <= week
        && (entry.homeClubId === club.id || entry.awayClubId === club.id),
    );
    if (!competition || !fixture) return null;
    const opponentId = fixture.homeClubId === club.id ? fixture.awayClubId : fixture.homeClubId;
    const opponent = state.world.clubs[opponentId];
    if (!opponent) return null;
    return {
      source: 'youth',
      competitionId: competition.competitionId,
      homeClubId: fixture.homeClubId,
      awayClubId: fixture.awayClubId,
      opponentName: opponent.name,
      importance: matchImportanceFor(
        state,
        index,
        competition.competitionId,
        fixture.homeClubId,
        fixture.awayClubId,
      ),
      key: `${state.world.season}:${week}:${competition.competitionId}:${fixture.homeClubId}:${fixture.awayClubId}`,
    };
  }
  const matches: ScheduledUserMatch[] = [];

  const add = (
    source: ScheduledMatchSource,
    competitionId: string,
    homeClubId: string,
    awayClubId: string,
    importance: MatchImportance,
  ) => {
    if (homeClubId !== club.id && awayClubId !== club.id) return;
    const opponentId = homeClubId === club.id ? awayClubId : homeClubId;
    const opponent = state.world.clubs[opponentId];
    if (!opponent) return;
    matches.push({
      source,
      competitionId,
      homeClubId,
      awayClubId,
      opponentName: opponent.name,
      importance,
      key: `${state.world.season}:${week}:${competitionId}:${homeClubId}:${awayClubId}`,
    });
  };

  const league = state.world.competitions[club.competitionId];
  for (const fixture of league?.fixtures ?? []) {
    if (fixture.played || fixture.week > week) continue;
    add(
      'league',
      club.competitionId,
      fixture.homeClubId,
      fixture.awayClubId,
      matchImportanceFor(state, index, club.competitionId, fixture.homeClubId, fixture.awayClubId),
    );
  }

  for (const cup of Object.values(state.world.cups)) {
    if (cup.finished || cup.country !== club.country) continue;
    for (const tie of cup.ties) {
      if (tie.played || tie.week > week) continue;
      const importance: MatchImportance = isCupFinal(cup, tie)
        ? 'cupFinal'
        : isCupSemi(cup, tie)
          ? 'cupSemi'
          : 'normal';
      add('cup', cup.id, tie.homeClubId, tie.awayClubId, importance);
    }
  }

  for (const competition of Object.values(state.world.europe ?? {})) {
    if (competition.stage === 'done') continue;
    if (competition.stage === 'qualifying') {
      for (const tie of competition.qualifying?.ties ?? []) {
        if (!tie.played && tie.week <= week) {
          add('europe', competition.id, tie.homeClubId, tie.awayClubId, 'europeanNight');
        }
      }
    } else if (competition.stage === 'group') {
      for (const fixture of competition.fixtures) {
        if (!fixture.played && fixture.week <= week) {
          add('europe', competition.id, fixture.homeClubId, fixture.awayClubId, 'europeanNight');
        }
      }
    } else {
      for (const tie of competition.ties) {
        if (tie.played || tie.week > week) continue;
        const importance: MatchImportance = tie.stage === 'final'
          ? 'cupFinal'
          : tie.stage === 'sf'
            ? 'cupSemi'
            : 'europeanNight';
        add('europe', competition.id, tie.homeClubId, tie.awayClubId, importance);
      }
    }
  }

  const sourcePriority: Record<ScheduledMatchSource, number> = { league: 0, cup: 1, europe: 2, youth: 0 };
  return matches.sort((a, b) =>
    importanceWeight(b.importance) - importanceWeight(a.importance)
      || sourcePriority[b.source] - sourcePriority[a.source],
  )[0] ?? null;
}

const FIXTURE_BOUND_EVENTS = new Set([
  'play_final_injured',
  'derby_week_pressure',
  'rival_week_pressure',
  'champions_league_night',
  'penalty_in_last_minute',
  'opponent_targets_you',
  'national_coach_watching',
  'goal_celebration_controversy',
  'derby_goal_celebration',
  'rival_goal_celebration',
  'missed_sitter',
  'own_goal',
]);

function raisePostMatchEvent(
  state: CareerState,
  index: PackIndex,
  rng: Rng,
  match: MatchResult,
): void {
  const line = match.userLine;
  if (!line?.played) return;
  const ids: string[] = [];
  if ((match.importance === 'derby' || match.importance === 'rival') && line.goals > 0) {
    // The same celebration, under the name the fixture actually has: a rivalry that
    // spans two cities is not a derby, and the copy must not claim it is.
    ids.push(match.importance === 'derby' ? 'derby_goal_celebration' : 'rival_goal_celebration');
  }
  if (line.shots >= 3 && line.goals === 0 && line.rating < 6.35) ids.push('missed_sitter');
  if (line.goals > 0 && state.player.fame >= 20) ids.push('goal_celebration_controversy');
  // He put one in his own net. Nobody has to roll for whether that is worth a word.
  const ownGoal = (line.ownGoals ?? 0) > 0;
  if (ownGoal) ids.unshift('own_goal');
  if (ids.length === 0 || (!ownGoal && !rng.chance(0.55))) return;

  const ctx = buildEventContext(state, index);
  const eligible = ids
    .map((id) => index.pack.events.find((event) => event.id === id))
    .filter((event): event is NonNullable<typeof event> => Boolean(event))
    .filter((event) => isEligible(event, ctx, state));
  const def = eligible.find((event) => event.id === 'own_goal')
    ?? rng.weighted(eligible, (event) => event.weight);
  if (!def) return;
  const decision = toPendingDecision(def, ctx.absoluteWeek);
  decision.blocking = false;
  state.pendingDecisions.push(decision);
  pushInbox(state, def.category === 'media' ? 'media' : def.category, def.textKey, undefined, decision.id);
}

/** One contextual dilemma at most, attached to the real fixture and answered first. */
/**
 * Whether this fixture is his to play in.
 *
 * The build-up is for a player who will be involved. A man with six weeks of a
 * hamstring left is not asked what the derby means to him: he is not in the squad, and
 * being asked anyway made the microphone meaningless.
 */
function availableForFixture(state: CareerState, match: ScheduledUserMatch): boolean {
  if (!isAvailable(state.player, match.competitionId)) return false;
  return !isFrozenOut(state);
}

function raisePreMatchEvent(
  state: CareerState,
  index: PackIndex,
  rng: Rng,
  match: ScheduledUserMatch,
): boolean {
  // Youth matches get one coherent pre-match interaction through their occasion
  // milestone. Senior-only dressing-room dilemmas must not leak into the academy.
  if (match.source === 'youth') return false;
  const checkedKey = `preMatchEvent:${match.key}`;
  if (state.flags[checkedKey]) return false;
  state.flags[checkedKey] = true;

  const injuryWeeks = state.player.condition.injuries.reduce(
    (longest, injury) => Math.max(longest, injury.weeksRemaining),
    0,
  );
  const ids: string[] = [];
  if (match.importance === 'cupFinal' && injuryWeeks > 0 && injuryWeeks <= 3) {
    // The one question worth asking a man who is hurt: whether he goes through with it.
    ids.push('play_final_injured');
  } else if (!availableForFixture(state, match)) {
    // Everything else in here assumes he is playing on Saturday.
    return false;
  } else {
    if (match.importance === 'derby') ids.push('derby_week_pressure');
    if (match.importance === 'rival') ids.push('rival_week_pressure');
    if (match.source === 'europe') ids.push('champions_league_night');
    if (match.importance !== 'normal') ids.push('penalty_in_last_minute');
    ids.push('opponent_targets_you', 'national_coach_watching');
  }

  const ctx = buildEventContext(state, index);
  const eligible = ids
    .map((id) => index.pack.events.find((event) => event.id === id))
    .filter((event): event is NonNullable<typeof event> => Boolean(event))
    .filter((event) => isEligible(event, ctx, state));
  if (eligible.length === 0) return false;

  const forcedMedical = eligible.find((event) => event.id === 'play_final_injured');
  if (!forcedMedical && !rng.chance(match.importance === 'normal' ? 0.18 : 0.48)) return false;
  const def = forcedMedical ?? rng.weighted(eligible, (event) => event.weight);
  if (!def) return false;

  const decision = toPendingDecision(def, ctx.absoluteWeek, {
    opponent: match.opponentName,
    competition: match.competitionId,
  });
  decision.id = `${decision.id}_${hashString(match.key)}`;
  decision.blocking = true;
  decision.expiresWeek = ctx.absoluteWeek + 1;
  state.pendingDecisions.push(decision);
  pushInbox(state, def.category === 'media' ? 'media' : def.category, def.textKey, decision.textArgs, decision.id);
  return true;
}

/** Announces the week's fixture if it is worth announcing, and says what kind it is. */
function announceBigMatch(state: CareerState, match: ScheduledUserMatch | null): MatchImportance {
  const club = userClub(state);
  if (!club || !match || match.importance === 'normal') return 'normal';

  const announced = `bigMatch:${match.key}`;
  if (state.flags['lastBigMatch'] === announced) return match.importance;
  state.flags['lastBigMatch'] = announced;

  const level = match.source === 'youth' ? 'youth.' : '';
  // When an interview follows, that interaction already delivers the build-up. A
  // second inbox card had no decision id, so it waited behind the interaction and could
  // surface after the match as if the fixture were still ahead. Keep inbox-only build-up
  // for occasions that have no conversation of their own.
  if (!occasionMilestone(match.importance)) {
    pushInbox(state, match.source === 'youth' ? 'manager' : 'club', `inbox.buildUp.${level}${match.importance}`, {
      opponent: match.opponentName,
    });
  }
  pushNews(state, `news.buildUp.${level}${match.importance}`, {
    club: club.name,
    opponent: match.opponentName,
  }, 'high');
  return match.importance;
}

export function matchImportanceFor(
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

  // Something he said in public. It does not matter whether these two clubs have any
  // history: he gave this fixture a name himself, and now he has to go and play in it.
  if (grudgeClubId(state) === opponentId) return 'rival';

  const previousClubId = state.flags['previousClubId'];
  if (typeof previousClubId === 'string' && previousClubId === opponentId) return 'vsFormerClub';

  // A derby is two clubs from one town. Everything else with history behind it - a
  // classico, a fixture two cities apart that both of them plan their season around -
  // is a rivalry, and calling it a derby in the build-up is the sort of thing a
  // supporter hears immediately.
  if (club.derbies?.includes(opponentId)) return 'derby';
  // Two clubs from the same town is a derby whether or not anybody wrote it down. The
  // derby list only covers the famous fixtures, so without this a player at a smaller
  // club could go a whole career without one.
  if (club.city && opponent.city && club.city === opponent.city) return 'derby';
  if (club.rivals?.includes(opponentId)) return 'rival';

  /*
   * Where the two of them stand.
   *
   * His own league might be an age group, whose table lives in the youth world rather
   * than among the senior competitions - so a boy in an academy used to face the best
   * side in his division with nobody mentioning it. And a table says something long
   * before the run-in: once a third of the season has been played the top of it is the
   * top of it, so facing one of those sides is an occasion in itself, not only when he
   * is up there with them.
   */
  const compState = state.world.competitions[competitionId]
    ?? state.world.youth?.competitions[competitionId];
  if (compState) {
    const rows = sortedTable(compState);
    const roundsIn = Math.max(0, ...Object.values(compState.table).map((row) => row.played));
    if (roundsIn >= 6) {
      const mine = rows.findIndex((row) => row.clubId === club.id);
      const theirs = rows.findIndex((row) => row.clubId === opponentId);
      if (mine >= 0 && theirs >= 0) {
        if (mine < 3 && theirs < 3) return 'titleDecider';
        if (mine >= rows.length - 4 && theirs >= rows.length - 4) return 'relegationSixPointer';
        if (theirs < 3) return 'topSide';
      }
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
    case 'topSide': return 1.2;
    case 'firstProMatch': return 1.2;
    case 'debut': return 1.2;
    default: return 1;
  }
}

function simulateWeekFixtures(state: CareerState, index: PackIndex, rng: Rng, club: Club | null): MatchResult | null {
  const week = state.world.week;
  // Senior football is simulated as club-world football while the player is in the
  // academy. It becomes a user match only after he is genuinely in the senior squad.
  const seniorClub = club && !isAcademyPlayer(state) ? club : null;
  const userCompId = seniorClub?.competitionId ?? null;
  const resumedMatchId = state.pendingHalfTime?.matchId;
  let userResult: MatchResult | null = null;

  // The competitive calendar is locked until camp is complete. A senior player gets
  // three weeks in which training and friendlies give the manager evidence before the
  // first league selection or European qualifier.
  if (week <= PRESEASON_END_WEEK) {
    return simulatePreseasonFriendly(state, index, rng, club);
  }

  for (const compState of Object.values(state.world.competitions)) {
    const competition = index.competitionById.get(compState.competitionId);
    if (!competition) continue;
    const isUserComp = compState.competitionId === userCompId;

    for (const fixture of compState.fixtures) {
      if (fixture.played || fixture.week > week) continue;

      const involvesUser = seniorClub !== null
        && (fixture.homeClubId === seniorClub.id || fixture.awayClubId === seniorClub.id);
      if (involvesUser) {
        const importance = matchImportanceFor(state, index, competition.id, fixture.homeClubId, fixture.awayClubId);
        const result = playUserMatch(state, index, rng, fixture.homeClubId, fixture.awayClubId, competition.id, importance);
        fixture.played = true;
        fixture.result = [result.homeGoals, result.awayGoals];
        applyResult(compState, fixture.homeClubId, fixture.awayClubId, result.homeGoals, result.awayGoals);
        attributeGoals(state, rng, compState, fixture.homeClubId, result.homeGoals, result, fixture);
        attributeGoals(state, rng, compState, fixture.awayClubId, result.awayGoals, result, fixture);
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
        attributeGoals(state, rng, compState, fixture.homeClubId, hg, null, fixture);
        attributeGoals(state, rng, compState, fixture.awayClubId, ag, null, fixture);
        attributeCards(state, rng, compState, fixture.homeClubId);
        attributeCards(state, rng, compState, fixture.awayClubId);
      }
    }
  }

  const youthResult = simulateYouthWeek(state, index, rng, club)
    ?? simulateYouthCupWeek(state, index, rng, club);
  const cupResult = simulateCupWeek(state, index, rng, seniorClub);
  const euroResult = simulateEuroWeek(state, index, rng, seniorClub);

  // Saturday's eleven, in whichever division he is actually playing in.
  if (playsYouthFootball(state)) {
    const youthComp = userYouthCompetitionId(state);
    if (youthComp) recordTeamOfTheWeek(state, index, youthComp, week, true);
  } else if (userCompId) {
    recordTeamOfTheWeek(state, index, userCompId, week, false);
  }
  const resumed = [userResult, youthResult, cupResult, euroResult]
    .find((result) => result?.id === resumedMatchId) ?? null;
  // A European night is the match of the week when there is one; a youth match only
  // counts when there is nothing else. When the player has just answered a team talk,
  // that exact match remains the one shown even if another competition also played.
  return resumed ?? euroResult ?? userResult ?? cupResult ?? youthResult;
}

/**
 * The division's team of the week, and the note that arrives when he is in it.
 *
 * Being told his rating was 7.9 says nothing on its own. Being told that 7.9 was the
 * third best in the division on Saturday is the thing a player actually reads.
 */
function recordTeamOfTheWeek(
  state: CareerState,
  index: PackIndex,
  competitionId: string,
  week: number,
  youth: boolean,
): void {
  const eleven = buildTeamOfTheWeek(state, competitionId, week, youth);
  if (!eleven) return;

  const his = eleven.entries.find((entry) => entry.isUser);
  if (!his) return;
  const total = Number(state.flags['totwCount'] ?? 0) + 1;
  state.flags['totwCount'] = total;
  // Youth divisions are filed under the senior competition's id with a suffix.
  const competition = index.competitionById.get(youthParentId(competitionId));
  pushInbox(state, 'media', total === 1 ? 'inbox.teamOfTheWeek.first' : 'inbox.teamOfTheWeek', {
    competition: competition?.name ?? '',
    rating: his.rating.toFixed(1),
    total,
  });
}

/** The camp fixture this week that has not been played yet, if there is one left. */
export function nextCampSlot(state: CareerState, week = state.world.week): CampSlot | null {
  for (const slot of CAMP_SLOTS) {
    if (!state.flags[`campPlayed:${state.world.season}:${week}:${slot}`]) return slot;
  }
  return null;
}

function simulatePreseasonFriendly(
  state: CareerState,
  index: PackIndex,
  rng: Rng,
  club: Club | null,
): MatchResult | null {
  if (!club) return null;
  const week = state.world.week;
  scheduleTrainingCamp(state, rng, club);
  const slot = nextCampSlot(state);
  if (!slot) return null;
  const opponentId = String(state.flags[`campOpponent:${state.world.season}:${week}:${slot}`] ?? '');
  const opponent = state.world.clubs[opponentId];
  if (!opponent) return null;
  const academyCamp = isAcademyPlayer(state);
  const age = state.world.season - state.player.birthYear;
  const userAtHome = campFixtureAtHome(week, slot);
  const result = playUserMatch(
    state,
    index,
    rng,
    userAtHome ? club.id : opponent.id,
    userAtHome ? opponent.id : club.id,
    academyCamp ? 'friendly.youth' : 'friendly',
    'friendly',
    // Academy signings play the same visible camp schedule with the youth team. The
    // rating tells playUserMatch to use youth squads, while senior signings continue
    // with the first team.
    academyCamp ? youthClubRating(opponent, age) : undefined,
  );
  state.flags[`campPlayed:${state.world.season}:${week}:${slot}`] = true;
  state.flags[`friendlyPlayed:${state.world.season}:${week}`] = true;
  // The week's development runs once, after the second friendly, so the minutes of the
  // first one have to survive the pause in between.
  const minutesKey = `campMinutes:${state.world.season}:${week}`;
  state.flags[minutesKey] = Number(state.flags[minutesKey] ?? 0) + (result.userLine?.minutes ?? 0);
  return result;
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

    if (competition.stage === 'qualifying') {
      const result = playQualifyingWeek(state, index, rng, club, competition);
      if (result) userResult = result;
      continue;
    }

    if (isGroupStage(competition)) {
      for (const fixture of competition.fixtures) {
        if (fixture.played || fixture.week > week) continue;
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
        payEuroPrize(state, competition, 'group');
        if (competition.leaguePhase) {
          // Top eight straight into the last sixteen, ninth to twenty-fourth into a
          // play-off, and everybody below that is out before February.
          const { direct, playoff } = qualifiersFromLeaguePhase(competition);
          if (club) {
            if (direct.includes(club.id)) {
              pushInbox(state, 'club', 'inbox.europe.topEight', { club: club.name });
            } else if (playoff.includes(club.id)) {
              pushInbox(state, 'club', 'inbox.europe.playoff', { club: club.name });
            } else if (competition.leaguePhase[club.id]) {
              pushInbox(state, 'club', 'inbox.europe.knockedOut', { club: club.name });
            }
          }
          if (playoff.length >= 2) {
            setPlayoffField(competition, direct, playoff);
            drawEuroRound(rng, competition, 'playoff');
          } else {
            competition.alive = direct;
            drawEuroRound(rng, competition);
          }
        } else {
          competition.alive = qualifiersFromGroups(competition);
          drawEuroRound(rng, competition);
        }
      }
      continue;
    }

    for (const tie of competition.ties) {
      if (tie.played || tie.week > week) continue;
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


/**
 * A summer week. The qualifiers are single ties, and for a club from a smaller league
 * they are the whole season in ninety minutes: win them and there is a group stage,
 * lose one and the European campaign is over before the league has kicked off.
 */
function playQualifyingWeek(
  state: CareerState,
  index: PackIndex,
  rng: Rng,
  club: Club | null,
  competition: EuroState,
): MatchResult | null {
  const qualifying = competition.qualifying;
  if (!qualifying) return null;
  const week = state.world.week;
  let userResult: MatchResult | null = null;

  for (const tie of qualifying.ties) {
    if (tie.played || tie.week > week) continue;
    const home = state.world.clubs[tie.homeClubId];
    const away = state.world.clubs[tie.awayClubId];
    if (!home || !away) { tie.played = true; continue; }

    if (club && (tie.homeClubId === club.id || tie.awayClubId === club.id)) {
      const result = playUserMatch(state, index, rng, tie.homeClubId, tie.awayClubId, competition.id, 'europeanNight');
      tie.played = true;
      tie.result = [result.homeGoals, result.awayGoals];
      userResult = result;
      continue;
    }

    const [hg, ag] = simulateQuickResult(rng, { homeRating: clubRating(home), awayRating: clubRating(away) });
    tie.played = true;
    tie.result = [hg, ag];
  }

  const places = Math.max(0, (competition.seeded?.length ?? 0) + qualifying.alive.length);
  const groupPlaces = Math.min(LEAGUE_PHASE_SIZE, Math.max(8, places));
  const placesLeft = Math.max(0, groupPlaces - (competition.seeded?.length ?? 0));

  // A competition whose field already fits does not need a summer at all.
  const noQualifyingNeeded = qualifying.ties.length === 0 && qualifying.alive.length <= placesLeft;
  const settled = noQualifyingNeeded || resolveQualifyingRound(rng, competition, placesLeft);
  if (!settled) return userResult;
  if (qualifying.ties.some((tie) => !tie.played)) return userResult;

  // The summer is over: whoever is left joins the seeds and the groups are drawn.
  const field = qualifiedField(competition, groupPlaces);
  const drawn = createEuroCompetition(rng, competition.id, field, competition.season, (id) =>
    state.world.clubs[id]?.strength ?? 50,
  );
  if (drawn) {
    competition.groups = drawn.groups;
    competition.leaguePhase = drawn.leaguePhase;
    competition.fixtures = drawn.fixtures;
    competition.stage = 'group';
    if (club && field.includes(club.id)) {
      pushInbox(state, 'club', `inbox.europe.qualified.${competition.id}`, { club: club.name });
      pushNews(state, `news.europe.qualified`, { club: club.name }, 'high');
    } else if (club && (competition.seeded ?? []).concat(qualifying.alive).length > 0
      && qualifying.ties.some((tie) => tie.homeClubId === club.id || tie.awayClubId === club.id)) {
      pushInbox(state, 'club', 'inbox.europe.knockedOut', { club: club.name });
    }
  } else {
    competition.stage = 'done';
  }
  return userResult;
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


/**
 * A Sunday morning in the youth league. He plays these in full - they are the only
 * football he has - and what he does in them is what gets him seen.
 */
/**
 * The age group's cup football.
 *
 * The boys enter the same knockouts their clubs do. His own ties are played out like
 * any other match he is in; everybody else's are settled on the strength of the two
 * age groups, because a bracket that stops moving is not a cup.
 */
/**
 * The football he is actually getting, when this season has not produced any yet.
 *
 * `minutesPct` divides his minutes by the matches his club has played, so in July it is
 * zero for everybody - a first-team regular reads exactly like a boy who has never been
 * picked. Everything that asks "is he playing?" then gets the wrong answer for the first
 * month of every season: the market offered a starter a loan to get him minutes, and the
 * age group put him back in it on Sunday morning. Until the season has a few matches in
 * it, last season is the honest answer.
 */
export function recentMinutesShare(state: CareerState): number {
  const club = userClub(state);
  const played = club
    ? state.world.competitions[club.competitionId]?.table[club.id]?.played ?? 0
    : 0;
  if (played >= 4) return minutesPct(state);
  const last = state.seasonHistory[state.seasonHistory.length - 1];
  if (!last || last.apps === 0) return minutesPct(state);
  // A season filed under an age group is not senior football, however many matches are
  // in it. Thirty Sunday mornings must not read as a first-team regular's year.
  if (last.competitionId?.endsWith('.youth')) return minutesPct(state);
  // Thirty-four matches is a league season, near enough for a question this coarse.
  return clamp(last.minutes / (34 * 90), 0, 1);
}

/** How long since he last played senior football. Camp friendlies are not football. */
function weeksSinceSeniorMatch(state: CareerState): number {
  const now = state.world.season * WEEKS_PER_SEASON + state.world.week;
  for (const match of state.matchLog) {
    if (!match.userLine?.played) continue;
    if (match.competitionId.endsWith('.youth') || match.competitionId.startsWith('friendly')) continue;
    return now - (match.season * WEEKS_PER_SEASON + match.week);
  }
  return 99;
}

/**
 * Whether he is still a boy playing Sunday morning football.
 *
 * Being under nineteen and short of senior minutes used to be the whole test, which sent
 * a first-division starter back to the age group every August - and, worse, sent a boy
 * who had just taken a loan specifically to play senior football into his new club's
 * youth team, which is the opposite of what he agreed to. A squad role is a promise: the
 * moment a club gives him one above development, he is a senior player and the age group
 * is finished with him whatever the minutes column says this week.
 */
function playsYouthFootball(state: CareerState): boolean {
  const age = state.world.season - state.player.birthYear;
  if (age > YOUTH_MAX_AGE) return false;
  if (isAcademyPlayer(state)) return true;
  // A loan is senior football by definition: it is what he went there for.
  if (state.contract?.isLoan) return false;
  /*
   * Anybody young enough who is not playing is playing for the age group.
   *
   * This used to be gated on his squad role, so the week a promising boy was given a
   * squad number - bench, rotation - he stopped being eligible for the youth team, and
   * if the first-team manager then did not pick him he played no football at all. Top
   * scorer in the age group one month, watching every Saturday the next, with nothing on
   * any screen to explain it. No club on earth does that with a seventeen year old.
   *
   * It is a question about minutes, not about the label on his role - with one guard:
   * a boy who was in the first team last Saturday is not sent to the under-19s the next
   * morning. He goes back when he has actually stopped being used.
   */
  if (weeksSinceSeniorMatch(state) < 3) return false;
  return recentMinutesShare(state) < 0.25;
}

function simulateYouthCupWeek(
  state: CareerState,
  index: PackIndex,
  rng: Rng,
  club: Club | null,
): MatchResult | null {
  const youth = state.world.youth;
  if (!youth?.cups || !club) return null;
  const age = state.world.season - state.player.birthYear;
  const stillYouth = playsYouthFootball(state);
  const week = state.world.week;
  let userResult: MatchResult | null = null;

  for (const cup of Object.values(youth.cups)) {
    if (cup.finished) continue;
    const due = cup.ties.filter((tie) => !tie.played && tie.week <= week);
    if (due.length === 0) continue;

    for (const tie of due) {
      const home = state.world.clubs[tie.homeClubId];
      const away = state.world.clubs[tie.awayClubId];
      if (!home || !away) { tie.played = true; continue; }

      const involvesUser = stillYouth && (tie.homeClubId === club.id || tie.awayClubId === club.id);
      if (involvesUser) {
        const opponent = tie.homeClubId === club.id ? away : home;
        const opponentSquad = youthSquad(state, opponent.id);
        const rating = opponentSquad.length >= 8
          ? teamRatingFromSquad(opponentSquad)
          : youthClubRating(opponent, age);
        const importance: MatchImportance = isCupFinal(cup, tie)
          ? 'cupFinal'
          : isCupSemi(cup, tie) ? 'cupSemi' : 'normal';
        const result = playUserMatch(
          state, index, rng, tie.homeClubId, tie.awayClubId, cup.id, importance, rating,
        );
        recordTieResult(cup, tie, result.homeGoals, result.awayGoals, rng);
        userResult = result;
        if (importance === 'cupFinal' && tie.winner === club.id) {
          state.trophies.push({ season: state.world.season, competitionId: cup.id, kind: 'cup' });
          pushNews(state, 'news.cupWon', { club: club.name }, 'high');
        }
      } else {
        const [homeGoals, awayGoals] = simulateQuickResult(rng, {
          homeRating: youthClubRating(home, age),
          awayRating: youthClubRating(away, age),
        });
        recordTieResult(cup, tie, homeGoals, awayGoals, rng);
      }
    }

    if (!cup.finished && cup.ties.every((tie) => tie.played)) drawRound(rng, cup, week);
  }

  return userResult;
}

function simulateYouthWeek(state: CareerState, index: PackIndex, rng: Rng, club: Club | null): MatchResult | null {
  const youth = state.world.youth;
  if (!youth || !club) return null;
  const age = state.world.season - state.player.birthYear;
  // He plays youth football until he has outgrown it, and keeps playing it after a
  // call-up until he is actually getting senior minutes. A seventeen year old promoted
  // early should be playing on Sunday, not watching on Saturday - but a seventeen year
  // old who has been given a senior shirt is not sent back to the age group.
  const stillYouth = playsYouthFootball(state);
  const week = state.world.week;
  const hisDivision = userYouthCompetitionId(state);
  let userResult: MatchResult | null = null;

  for (const [competitionId, comp] of Object.entries(youth.competitions)) {
    const modelled = competitionId === hisDivision;

    for (const fixture of comp.fixtures) {
      if (fixture.played || fixture.week > week) continue;
      const home = state.world.clubs[fixture.homeClubId];
      const away = state.world.clubs[fixture.awayClubId];
      if (!home || !away) { fixture.played = true; continue; }

      const involvesHim = stillYouth && modelled && (fixture.homeClubId === club.id || fixture.awayClubId === club.id);
      if (involvesHim) {
        const opponent = fixture.homeClubId === club.id ? away : home;
        const opponentSquad = youthSquad(state, opponent.id);
        const rating = opponentSquad.length >= 8
          ? teamRatingFromSquad(opponentSquad)
          : youthClubRating(opponent, age);
        // A youth derby is a derby. The occasion was being worked out for the build-up
        // and then thrown away at kick-off, so the match itself was played as if every
        // Sunday were the same Sunday.
        const importance = matchImportanceFor(
          state, index, competitionId, fixture.homeClubId, fixture.awayClubId,
        );
        const result = playUserMatch(
          state, index, rng,
          fixture.homeClubId, fixture.awayClubId, competitionId, importance,
          rating,
        );
        fixture.played = true;
        fixture.result = [result.homeGoals, result.awayGoals];
        applyResult(comp, fixture.homeClubId, fixture.awayClubId, result.homeGoals, result.awayGoals);
        userResult = result;

        recordYouthMatch(state, comp, result, fixture.homeClubId, fixture.awayClubId, fixture);

        const line = result.userLine;
        if (line?.played) {
          youth.form.apps += 1;
          youth.form.goals += line.goals;
          youth.form.assists += line.assists;
          youth.form.ratingSum += line.rating;
          youth.form.minutes += line.minutes;
        }
        continue;
      }

      // Everybody else's Sunday. In his own division the goals are shared out among
      // real boys, so the scoring chart he is trying to climb is complete; elsewhere
      // a result is all the table needs.
      const homeSquad = modelled ? youthSquad(state, home.id) : [];
      const awaySquad = modelled ? youthSquad(state, away.id) : [];
      const [hg, ag] = simulateQuickResult(rng, {
        homeRating: homeSquad.length >= 8 ? teamRatingFromSquad(homeSquad) : youthClubRating(home, age),
        awayRating: awaySquad.length >= 8 ? teamRatingFromSquad(awaySquad) : youthClubRating(away, age),
      });
      fixture.played = true;
      fixture.result = [hg, ag];
      applyResult(comp, fixture.homeClubId, fixture.awayClubId, hg, ag);

      if (modelled) {
        spreadYouthGoals(state, rng, comp, home.id, hg, fixture);
        spreadYouthGoals(state, rng, comp, away.id, ag, fixture);
      }
    }
  }

  // The first team takes a look when he has earned one.
  const form = youth.form;
  if (stillYouth && form.apps >= 4 && !state.flags['calledUpToSeniors']) {
    const ovr = overall(state.player.attributes, state.player.primaryPos, state.player.secondaryPos);
    if (deservesCallUp(rng, {
      form,
      age,
      ovr,
      clubLevel: clubBaseOvr(club),
      scoringRank: scoringRank(state),
      tablePosition: youthTablePosition(state),
    })) {
      state.flags['calledUpToSeniors'] = true;
      state.player.squadRole = age >= 17 ? 'prospect' : 'futureProspect';
      // Called up in the middle of a season is still called up: he goes on the club's
      // list the same week, not the following July.
      const seniorList = state.world.squads[club.id] ?? (state.world.squads[club.id] = []);
      if (!seniorList.includes(state.player.id)) seniorList.push(state.player.id);
      pushInbox(state, 'manager', 'inbox.youthCallUp', { club: club.name });
      pushNews(state, 'news.youthCallUp', { player: `${state.player.firstName} ${state.player.lastName}`, club: club.name }, 'medium');
      unlock(state, 'firstTeamCallUp', { club: club.name });
    }
  }

  // A boy tearing the division up gets a reporter at training.
  if (stillYouth && form.apps >= 8 && scoringRank(state) > 0 && scoringRank(state) <= 3) {
    raiseMilestone(state, 'youthBreakout');
  }

  return userResult;
}

/**
 * A youth match he played: the goals, assists and cards in it belong to boys with names,
 * so they go on their own records and into the division's charts.
 */
/**
 * Who actually played in an age-group match.
 *
 * Every boy in the squad was credited with ninety minutes of every fixture, so an entire
 * division finished the season on identical appearance counts - which is what made his
 * own year look like eight boys with the same career. A youth coach picks eleven and
 * uses three, the better ones play more often, and the same boy plays the same match
 * however many times the fixture is read.
 */
function youthAppearances(state: CareerState, clubId: string, fixtureKey: string): { id: string; minutes: number }[] {
  const squad = youthSquad(state, clubId);
  if (squad.length === 0) return [];
  const age = state.world.season - state.player.birthYear;
  const club = state.world.clubs[clubId];
  const level = club ? youthClubRating(club, age) : 55;

  /*
   * A little noise per match, fixed by the fixture, so the same eleven is not picked
   * every single week and the same week always picks the same eleven.
   *
   * Seeded from the fixture and applied down the squad list rather than from each boy's
   * id: ids come from a counter that keeps running for the life of the process, so a
   * selection that hashed them picked a different side the second time the same career
   * was played in the same session.
   */
  const rng = new Rng((hashString(fixtureKey) % 2_000_000) + 1);
  const ranked = squad
    .map((player) => ({
      player,
      score: ratingAt(player.attributes, player.primaryPos) - level + rng.gauss(0, 4.5),
    }))
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, 14).map((entry, index) => ({
    id: entry.player.id,
    minutes: index < 11 ? 90 : 25,
  }));
}

function recordYouthMatch(
  state: CareerState,
  comp: CompetitionSeasonState,
  result: MatchResult,
  homeClubId: string,
  awayClubId: string,
  fixture?: Fixture,
): void {
  const youth = state.world.youth;
  if (!youth) return;
  const season = state.world.season;

  for (const event of result.events ?? []) {
    if (!event.playerId) continue;
    const clubId = youth.players[event.playerId]?.clubId ?? state.player.clubId ?? homeClubId;
    if (event.type === 'goal' || event.type === 'penaltyScored') {
      comp.scorers[event.playerId] = (comp.scorers[event.playerId] ?? 0) + 1;
      if (event.playerId !== state.player.id) {
        youthStatsFor(youth, event.playerId, season, clubId, comp.competitionId).goals += 1;
      }
      if (fixture) {
        const assist = (result.events ?? []).find((e) => e.type === 'assist' && e.minute === event.minute);
        fixture.goals = fixture.goals ?? [];
        fixture.goals.push({
          playerId: event.playerId,
          clubId,
          ...(assist?.playerId ? { assistId: assist.playerId } : {}),
        });
      }
    }
    if (event.type === 'assist') {
      comp.assists = comp.assists ?? {};
      comp.assists[event.playerId] = (comp.assists[event.playerId] ?? 0) + 1;
      if (event.playerId !== state.player.id) {
        youthStatsFor(youth, event.playerId, season, clubId, comp.competitionId).assists += 1;
      }
    }
  }

  // The eleven who played it, and the three who came on.
  const key = `${comp.competitionId}:${season}:${fixture?.week ?? state.world.week}:${homeClubId}:${awayClubId}`;
  for (const clubId of [homeClubId, awayClubId]) {
    for (const appearance of youthAppearances(state, clubId, key)) {
      const stats = youthStatsFor(youth, appearance.id, season, clubId, comp.competitionId);
      stats.apps += 1;
      stats.minutes += appearance.minutes;
    }
  }
}

/**
 * Two other academies playing each other. The result came out of a quick simulation,
 * but the goals in it are shared among the boys who would have scored them.
 */
function spreadYouthGoals(
  state: CareerState,
  rng: Rng,
  comp: CompetitionSeasonState,
  clubId: string,
  goals: number,
  fixture?: Fixture,
): void {
  const youth = state.world.youth;
  if (!youth) return;
  const season = state.world.season;
  const squad = youthSquad(state, clubId);

  const key = `${comp.competitionId}:${season}:${fixture?.week ?? state.world.week}:${clubId}`;
  const played = youthAppearances(state, clubId, key);
  for (const appearance of played) {
    const stats = youthStatsFor(youth, appearance.id, season, clubId, comp.competitionId);
    stats.apps += 1;
    stats.minutes += appearance.minutes;
  }
  if (goals <= 0 || squad.length === 0) return;

  for (let i = 0; i < goals; i++) {
    const scorer = rng.weighted(squad, (p) => youthGoalWeight(p));
    if (!scorer) continue;
    comp.scorers[scorer.id] = (comp.scorers[scorer.id] ?? 0) + 1;
    youthStatsFor(youth, scorer.id, season, clubId, comp.competitionId).goals += 1;
    let assistId: string | undefined;

    if (rng.chance(0.62)) {
      const others = squad.filter((p) => p.id !== scorer.id);
      const creator = rng.weighted(others, (p) => youthAssistWeight(p));
      if (creator) {
        comp.assists = comp.assists ?? {};
        comp.assists[creator.id] = (comp.assists[creator.id] ?? 0) + 1;
        youthStatsFor(youth, creator.id, season, clubId, comp.competitionId).assists += 1;
        assistId = creator.id;
      }
    }
    if (fixture) {
      fixture.goals = fixture.goals ?? [];
      fixture.goals.push({ playerId: scorer.id, clubId, ...(assistId ? { assistId } : {}) });
    }
  }
}

function youthGoalWeight(player: Player): number {
  const group = positionGroup(player.primaryPos);
  const base = group === 'ATT' ? 1 : group === 'MID' ? 0.4 : group === 'DEF' ? 0.1 : 0.004;
  return base * (0.5 + player.attributes.finishing / 110);
}

function youthAssistWeight(player: Player): number {
  const group = positionGroup(player.primaryPos);
  const base = group === 'MID' ? 1 : group === 'ATT' ? 0.75 : group === 'DEF' ? 0.3 : 0.02;
  return base * (0.5 + (player.attributes.vision + player.attributes.passing) / 220);
}

/** Spread a club's goals across its modelled players so the scoring charts mean something. */
function attributeGoals(
  state: CareerState,
  rng: Rng,
  compState: CompetitionSeasonState,
  clubId: string,
  goals: number,
  userMatch: MatchResult | null,
  /** The fixture these goals belong to, so a results page can name them. */
  fixture?: Fixture,
): void {
  if (goals <= 0) return;
  const record = (playerId: string, assistId?: string) => {
    if (!fixture) return;
    fixture.goals = fixture.goals ?? [];
    fixture.goals.push({ playerId, clubId, ...(assistId ? { assistId } : {}) });
  };

  if (userMatch && clubId === state.player.clubId) {
    for (const event of userMatch.events ?? []) {
      if (event.type === 'goal' && event.playerId) {
        compState.scorers[event.playerId] = (compState.scorers[event.playerId] ?? 0) + 1;
        const assist = (userMatch.events ?? []).find(
          (e) => e.type === 'assist' && e.minute === event.minute,
        );
        record(event.playerId, assist?.playerId);
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
    let assistId: string | undefined;

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
        assistId = creator.id;
      }
    }
    record(scorer.id, assistId);
  }
}

function simulateCupWeek(state: CareerState, index: PackIndex, rng: Rng, club: Club | null): MatchResult | null {
  const week = state.world.week;
  let userResult: MatchResult | null = null;

  for (const cup of Object.values(state.world.cups)) {
    if (cup.finished) continue;
    const ties = cup.ties.filter((t) => !t.played && t.week <= week);
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
          // A cup is a trophy night too. Only the league used to get the microphone.
          raiseMilestone(state, 'trophyNight', { force: true, key: `asked:trophyNight:${cup.id}:${state.world.season}` });
        }
      } else {
        const [hg, ag] = simulateQuickResult(rng, { homeRating: clubRating(home), awayRating: clubRating(away) });
        recordTieResult(cup, tie, hg, ag, rng);
      }
    }

    // Draw the next round once every tie in this round is settled.
    const currentRoundTies = cup.ties.filter((t) => t.round === cup.round);
    if (currentRoundTies.every((t) => t.played) && cup.alive.length > 1) {
      drawRound(rng, cup, week);
    } else if (currentRoundTies.every((t) => t.played) && cup.alive.length === 1) {
      cup.finished = true;
      cup.winner = cup.alive[0]!;
      state.world.history.cupWinners.push({ season: cup.season, cupId: cup.id, clubId: cup.winner });
    }
  }

  return userResult;
}

/**
 * Thrown out of a match that has reached the interval and is waiting on a team talk.
 *
 * The alternative is threading a "paused" value back through every caller that plays a
 * fixture - league, cup, Europe, youth - and each of them would have to know not to
 * write the result. The throw leaves all of them exactly as they were.
 */
class HalfTimeInterrupt extends Error {
  constructor() {
    super('half time');
    this.name = 'HalfTimeInterrupt';
  }
}

/**
 * The squad list.
 *
 * A call-up used to be rolled in the same tick as the international itself, so the news
 * that he had been picked arrived alongside the match he had already played in - which
 * is not how a footballer finds out. The squad is named the week before the window, he
 * reads it, and then he goes and plays.
 */
function announceCallUp(state: CareerState, index: PackIndex, rng: Rng, ctx: CallUpContext): void {
  const nextWeek = state.world.week + 1;
  if (!INTERNATIONAL_WEEKS.includes(nextWeek)) return;
  const key = `calledUp:${state.world.season}:${nextWeek}`;
  if (state.flags[key]) return;
  state.flags[key] = true;
  if (isInjured(state.player)) return;

  const callUp = rollCallUp(rng, ctx);
  if (!callUp) return;
  const country = index.countryByCode.get(callUp.countryCode);
  if (!country) return;

  state.flags['pendingCallUp'] = `${callUp.countryCode}|${callUp.level}|${callUp.isFirst ? 1 : 0}|${callUp.isSenior ? 1 : 0}|${nextWeek}`;
  if (callUp.isFirst) {
    pushInbox(state, 'national', 'inbox.firstCallUp', { country: country.name, level: `national.level.${callUp.level}` });
    unlock(state, 'firstCallUp', { country: country.name });
    // A first cap at any level is one of the nights that belongs to him; it does not
    // wait behind whatever the press asked about a fortnight ago.
    raiseMilestone(state, 'nationalCallUp', { force: true });
  } else {
    pushInbox(state, 'national', 'inbox.calledUp', { country: country.name, level: `national.level.${callUp.level}` });
  }
}

/** The squad he was named in last week, if the window has come round. */
function takeAnnouncedCallUp(state: CareerState): CallUpResult | null {
  const held = String(state.flags['pendingCallUp'] ?? '');
  if (!held) return null;
  const [code, level, first, senior, week] = held.split('|');
  state.flags['pendingCallUp'] = '';
  if (!code || Number(week) !== state.world.week) return null;
  return {
    countryCode: code,
    level: level as CallUpResult['level'],
    isFirst: first === '1',
    isSenior: senior === '1',
  };
}

/**
 * The other federation rings.
 *
 * A boy with two passports is a boy two associations are competing for, and the
 * competition is one of the few national dramas a career has. It arrives as a decision
 * because it is one: a pledge is not binding in law until he plays a competitive senior
 * match, but it decides who is calling him next month.
 */
function openAssociationApproach(state: CareerState, index: PackIndex, rng: Rng): void {
  if (state.pendingDecisions.some((decision) => decision.eventId === 'nationalApproach')) return;
  const season = state.world.season;
  // One approach a season from any one federation. Being courted every fortnight is not
  // being courted.
  const pitch = associationApproach(state, index);
  if (!pitch) return;
  if (state.flags[`ntApproach:${pitch.countryCode}:${season}`]) return;
  // They do not ring the week they notice him. It builds.
  if (!rng.chance(0.09)) return;

  state.flags[`ntApproach:${pitch.countryCode}:${season}`] = true;
  const decisionId = `ntApproach_${pitch.countryCode}_${season}_${state.world.week}`;
  const args = {
    country: pitch.countryName,
    rival: pitch.rivalName,
    interest: pitch.interest,
    rivalInterest: pitch.rivalInterest,
  };
  state.pendingDecisions.push({
    id: decisionId,
    kind: 'event',
    eventId: 'nationalApproach',
    category: 'national',
    blocking: true,
    textKey: `national.approach.${pitch.reason}`,
    textArgs: args,
    options: [
      {
        id: 'accept',
        labelKey: 'national.approach.accept',
        riskKey: pitch.rivalInterest >= 45 ? 'risk.high' : 'risk.medium',
        effects: [],
      },
      {
        id: 'stay',
        labelKey: pitch.rivalCode ? 'national.approach.stay' : 'national.approach.wait',
        riskKey: 'risk.medium',
        effects: [],
      },
    ],
    expiresWeek: season * 52 + state.world.week + 3,
  });
  pushInbox(state, 'national', 'inbox.national.approach', args, decisionId);

  /*
   * And somebody who has been there says the other thing.
   *
   * A federation making its case is only half of this. The half that makes it a
   * decision is the old international who rings the next day and says it is his
   * country - which is exactly what happens to every dual-national footballer alive.
   */
  if (pitch.rivalCode) {
    const mentor = state.mentor ? mentorById(state.mentor.id) : undefined;
    pushInbox(state, 'national', mentor ? 'inbox.national.mentorCounter' : 'inbox.national.mediaCounter', {
      ...args,
      mentor: mentor?.name ?? '',
    });
  }
}

/**
 * His answer to a federation.
 *
 * Saying yes is a pledge: they call him now and the other one mostly stops watching.
 * Saying no closes that door for a while and is noticed by the one he stayed with.
 */
export function answerNationalApproach(
  state: CareerState,
  index: PackIndex,
  decisionId: string,
  optionId: string,
): DecisionResult | null {
  const at = state.pendingDecisions.findIndex(
    (decision) => decision.id === decisionId && decision.eventId === 'nationalApproach',
  );
  if (at === -1) return null;
  const decision = state.pendingDecisions[at]!;
  const code = decisionId.split('_')[1] ?? '';
  const country = index.countryByCode.get(code);
  state.pendingDecisions.splice(at, 1);

  const before = Math.round(state.nationalTeam.interest[code] ?? 0);
  if (optionId === 'accept') {
    pledgeTo(state, code);
    pushInbox(state, 'national', 'inbox.national.pledged', { country: country?.name ?? code });
    pushNews(state, 'news.national.pledged', {
      player: `${state.player.firstName} ${state.player.lastName}`,
      country: country?.name ?? code,
    }, 'high');
  } else {
    turnDown(state, code);
    pushInbox(state, 'national', 'inbox.national.declined', { country: country?.name ?? code });
  }
  const after = Math.round(state.nationalTeam.interest[code] ?? 0);
  const changes: AppliedChange[] = [{
    key: 'change.nationalInterest',
    delta: after - before,
    before,
    after,
    tone: after >= before ? 'good' : 'bad',
  }];

  const result: DecisionResult = {
    changes,
    consequences: [],
    narrativeKey: `national.approach.${optionId}.outcome`,
    answerKey: `national.approach.${optionId}`,
  };
  state.lastResult = result;
  void decision;
  return result;
}

/**
 * Whether anybody would actually move for him this week.
 *
 * Two things a club does not do: sign a man who is in a cast, and buy a player from a
 * club he has not yet played a match for. Both were happening - an approach in the
 * middle of a fourteen-month injury, and a second club ringing a fortnight after he had
 * signed for the first without kicking a ball for them.
 */
function marketWouldMove(state: CareerState): boolean {
  const weeksOut = state.player.condition.injuries.reduce(
    (worst, injury) => Math.max(worst, injury.weeksRemaining),
    0,
  );
  // A knock is nothing; a lay-off is a reason to wait and see him play again.
  if (weeksOut > 3) return false;

  const club = userClub(state);
  if (!club) return true;
  const played = state.world.seasonStats[state.player.id]?.apps ?? 0;
  const sinceMove = state.world.season * WEEKS_PER_SEASON + state.world.week
    - Number(state.flags['lastTransferWeek'] ?? 0);
  return played >= 3 || sinceMove >= 34;
}

/** A stable seed for one fixture, so its crowd and its weather never change. */
function matchSeedFor(matchId: string): number {
  return (hashString(matchId) % 2_000_000) + 1;
}

/**
 * A cap, on the same record as his club football.
 *
 * International matches never touched the season's numbers - they are not the club's
 * football and must never move a domestic table - but a year in which he played eight
 * times for his country is a year with eight matches in it, and the breakdown is the
 * one place that can say so without pretending they were league games.
 */
function tallyNational(
  state: CareerState,
  outcome: { minutes: number; goals: number; rating: number },
): void {
  const player = state.player;
  const stats = state.world.seasonStats[player.id]
    ?? (state.world.seasonStats[player.id] = emptySeasonStats(state.world.season, player.clubId, null));
  tally(stats, 'national', outcome.minutes, outcome.goals, 0, outcome.rating);
}

/**
 * One appearance, filed under the kind of football it was.
 *
 * The season total is still the season total, but a player who is asked how his year went answers
 * in competitions, not in a single number.
 */
function tally(
  stats: SeasonStats,
  category: MatchCategory,
  minutes: number,
  goals: number,
  assists: number,
  rating: number,
): void {
  stats.byCategory = stats.byCategory ?? {};
  const row = stats.byCategory[category]
    ?? (stats.byCategory[category] = { apps: 0, goals: 0, assists: 0, minutes: 0, ratingSum: 0, ratedApps: 0 });
  row.apps += 1;
  row.minutes += minutes;
  row.goals += goals;
  row.assists += assists;
  if (rating > 0) {
    row.ratingSum += rating;
    row.ratedApps += 1;
  }
}

/** How the first half has gone for him, read off what he has actually done in it. */
function ratingSoFar(events: MatchEvent[], playerId: string): number {
  let rating = 6.4;
  for (const event of events) {
    if (event.playerId !== playerId) continue;
    if (event.type === 'goal' || event.type === 'penaltyScored') rating += 1.1;
    else if (event.type === 'assist') rating += 0.8;
    else if (event.type === 'save' && event.detailKey === 'match.event.userSave') rating += 0.2;
    else if (event.type === 'tackle') rating += 0.15;
    else if (event.type === 'miss') rating -= 0.15;
    else if (event.type === 'penaltyMissed') rating -= 0.9;
    else if (event.type === 'yellow') rating -= 0.15;
    else if (event.type === 'red') rating -= 1.2;
    else if (event.type === 'concede') rating -= 0.3;
  }
  return clamp(Math.round(rating * 10) / 10, 3, 10);
}

/**
 * The second half, once he has answered.
 *
 * Obeying is worth trust; refusing costs it, and the refusal is remembered until the
 * final whistle settles it. Then the week is simply walked again: every fixture that
 * was already played is flagged, so nothing happens twice, and the match that stopped
 * picks up from the seed it was rolled with.
 */
export function resumeHalfTime(
  state: CareerState,
  index: PackIndex,
  instructionId: HalfTimeInstructionId,
): TickResult {
  const held = state.pendingHalfTime;
  if (!held) return advanceWeek(state, index);

  const obeyed = held.demand === null || held.demand === instructionId;
  held.chosen = instructionId;
  held.obeyed = obeyed;

  if (held.demand !== null) {
    // Doing as he is told is the cheapest trust in football. Refusing is not free, and
    // whether it was worth it is decided by the next forty-five minutes.
    adjustRelationship(state, 'manager', obeyed ? 3 : -6);
    state.flags['defiedTheManager'] = obeyed ? 0 : 1;
  } else {
    state.flags['defiedTheManager'] = 0;
  }

  const heldWeek = state.world.season * 52 + state.world.week;
  const result = advanceWeek(state, index);
  /*
   * A team talk he has answered is finished with.
   *
   * Normally the replay of that match clears it. If the week rolled something else
   * instead - a call-up, a postponement, a move - nothing did, and an answered break sat
   * in the save for ever: the match screen showed the report while the rest of the app
   * still believed he was in the dressing room, so it hid the continue button and the
   * career could not be moved on at all.
   *
   * The break that must survive is the one the week is still on its way to play. Usually
   * the replay comes straight back saying it stopped at the interval, but it can also
   * stop before it reaches the match at all - a question tied to the fixture, a club
   * coming back with its answer - and the clock has not moved when it does. Throwing the
   * break away there loses the half he watched and the answer he gave: the match is
   * simulated again from the first minute, and a different first half turns up in the
   * log than the one he was in the dressing room for.
   */
  const stillOnItsWay = result.stopped === 'decision'
    && state.world.season * 52 + state.world.week === heldWeek
    && !state.matchLog.some((match) => match.id === held.matchId);
  if (result.stopped !== 'halfTime' && !stillOnItsWay && state.pendingHalfTime?.chosen !== undefined) {
    state.pendingHalfTime = undefined;
  }
  return result;
}

function playUserMatch(
  state: CareerState,
  index: PackIndex,
  rng: Rng,
  homeClubId: string,
  awayClubId: string,
  competitionId: string,
  importance: MatchImportance,
  /** Set for youth football: the level of the side he is actually facing. */
  youthOpponentRating?: number,
): MatchResult {
  const club = userClub(state)!;
  const player = state.player;
  const youthMatch = youthOpponentRating !== undefined;
  const friendly = competitionId.startsWith('friendly');
  // On a Sunday morning he lines up with the age group, not with the first team.
  const squad = youthMatch ? [...youthSquad(state, club.id), player] : userSquad(state);
  const userIsHome = homeClubId === club.id;
  const opponentId = userIsHome ? awayClubId : homeClubId;
  const opponent = state.world.clubs[opponentId]!;

  const suspension = player.condition.suspensions.find((s) => s.competitionId === competitionId && s.matchesRemaining > 0);
  const clearedForFinal =
    importance === 'cupFinal'
    && isInjured(player)
    && !suspension
    && Number(state.flags['clearedForInjuredFinal'] ?? -1) === state.world.season * 52 + state.world.week;
  // In his own age group he plays; it is senior football an academy player is kept out of.
  const available = youthMatch
    ? isAvailable(player, competitionId)
    : (isAvailable(player, competitionId) || clearedForFinal) && !isAcademyPlayer(state) && !isFrozenOut(state);

  const rotationPressure = clamp(state.matchLog.filter((m) => m.season === state.world.season && m.week >= state.world.week - 2).length / 3, 0, 1);
  const selectionCtx: SelectionContext = {
    formation: clubFormation(club),
    managerTrust: state.managerTrust,
    userId: player.id,
    rotationPressure,
    importantMatch: importance !== 'normal' && importance !== 'friendly',
  };

  // The competition belongs in the id. Two clubs can meet twice in one week - a league
  // match and a cup tie - and without it both matches were the same match as far as the
  // game was concerned, so the team talk raised for one was answered by the other and
  // the interval came round twice.
  const matchId = `m_${state.world.season}_${state.world.week}_${competitionId}_${homeClubId}_${awayClubId}`;
  // A match that was stopped at the break comes back with its team sheet intact: the
  // same eleven, the same minutes, the same seed. Only the second half is still open.
  const held = state.pendingHalfTime?.matchId === matchId ? state.pendingHalfTime : null;

  // A boy who is not old enough for this level is not in the reckoning at all, and one
  // who is only just old enough gets the end of it rather than the start.
  const gate = youthMatch
    ? { allowed: true, maxMinutes: 90 }
    : eligibleForSenior(player, state.world.season, {
      calledUp: Boolean(state.flags['calledUpToSeniors']),
      clubOvr: clubBaseOvr(club),
      managerTrust: state.managerTrust,
      seniorRole: player.squadRole,
    });
  const pickable = available && gate.allowed;

  const lineup = held?.lineup ?? pickBestLineup(
    rng,
    squad.filter((p) => {
      if (p.id === player.id) return pickable;
      if (youthMatch) return true;
      return eligibleForSenior(p, state.world.season, {
        calledUp: true,
        clubOvr: clubBaseOvr(club),
        managerTrust: 70,
      }).allowed;
    }),
    selectionCtx,
  );
  /*
   * Whether he plays, and for how long.
   *
   * The age group used to hand him ninety minutes unconditionally, which meant a boy
   * with a hamstring tear and eight weeks to serve turned out on Sunday and played the
   * whole match. Availability is availability: an injury or a ban keeps him off the
   * pitch in the age group exactly as it does in the first team.
   */
  const minutes = held?.minutes ?? (!pickable
    ? { played: false, started: false, minutes: 0, slot: null }
    : youthMatch
      // A youth coach drops a boy who is playing badly exactly as a first-team manager
      // does. Handing him ninety minutes whatever he did last Sunday made his own form
      // the one thing in the game with no consequence attached to it.
      ? state.flags['formBenchNotified']
        ? ((): MinutesOutcome => {
            const on = rng.int(58, 72);
            return { played: true, started: false, minutes: 90 - on, slot: player.primaryPos, cameOnMinute: on };
          })()
        : { played: true, started: true, minutes: 90, slot: player.primaryPos }
      : (() => {
          const resolved = capMinutes(resolveMinutes(rng, player.id, lineup, player), gate, player);
          if (!friendly && state.flags['formBenchNotified'] && resolved.started) {
            const on = rng.int(62, 78);
            return {
              played: true,
              started: false,
              minutes: 90 - on,
              slot: resolved.slot ?? player.primaryPos,
              cameOnMinute: on,
            };
          }
          // Camp exists to evaluate the whole senior squad. A fit new player is promised
          // a real audition even when he is not yet in the manager's best eleven.
          if (friendly && !resolved.played) {
            return { played: true, started: false, minutes: 30, slot: player.primaryPos, cameOnMinute: 60 };
          }
          return resolved;
        })());

  const opponentStarIds = state.world.squads[opponentId] ?? [];
  const opponentStars = youthMatch
    ? youthSquad(state, opponentId)
    : opponentStarIds.map((id) => state.world.players[id]).filter((p): p is Player => !!p);
  const opponentRating = youthOpponentRating
    ?? (opponentStars.length >= 8 ? teamRatingFromSquad(opponentStars) : clubRating(opponent));

  /*
   * The week's homework, carried onto the pitch.
   *
   * The plan belongs to this fixture and nothing else, so it is looked up by the same
   * key the build-up used. How well it reads against this opponent is worked out here
   * rather than when he chose it: he committed to a job on Thursday, and Saturday is
   * where being right about it pays.
   */
  const planKey = `${state.world.season}:${state.world.week}:${competitionId}:${homeClubId}:${awayClubId}`;
  const chosenPlan = state.matchPlan?.key === planKey
    ? MATCH_PLANS[state.matchPlan.plan as MatchPlanId]
    : undefined;
  const preparedSlot = minutes.slot ?? player.primaryPos;
  const scouted = (chosenPlan || !friendly) && minutes.played
    ? readOpponent({
      club: opponent,
      squad: opponentStars,
      rating: opponentRating,
      ownRating: teamRatingFromSquad(squad),
      home: userIsHome,
      slot: preparedSlot,
      formation: clubFormation(opponent),
    })
    : null;
  const readOfThem = chosenPlan && scouted ? planFit(chosenPlan, scouted) : 0;
  const planMods = chosenPlan && scouted ? planEffect(chosenPlan, readOfThem) : undefined;
  const marker = scouted?.marker ?? null;

  /*
   * The afternoon around the football, rolled from the match's own seed so the report
   * says the same thing every time it is opened, and so a half-time replay does not
   * change the weather.
   */
  const atmosphereRng = new Rng(matchSeedFor(matchId));
  const atmosphere: Atmosphere = held?.atmosphere ?? {
    attendance: attendanceFor(atmosphereRng, state.world.clubs[homeClubId]!, state.world.clubs[awayClubId]!, importance, competitionId),
    weather: pickWeather(atmosphereRng, state.world.week, competitionId),
    referee: pickReferee(atmosphereRng, index, club.country),
  };

  const matchSeed = held?.matchSeed ?? rng.int(1, 2 ** 30);
  const baseCtx = {
    mental: held?.mental
      ?? mentalFactor(state) * occasionFactor(state, importance) * grudgeFactor(state, opponentId, userIsHome),
    penaltyTaker: held?.penaltyTaker ?? Boolean(state.flags['penaltyTaker']),
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
    matchId,
    ...(planMods ? { plan: planMods, planFit: readOfThem, planId: chosenPlan?.id } : {}),
    ...(marker ? { duel: { name: marker.name, rating: marker.rating } } : {}),
    atmosphere,
  };

  // The break is only worth having when he is on the pitch to be told something, and
  // only as often as he wants it: every match, the ones that matter, or never.
  const onPitchAtTheBreak =
    minutes.played && (minutes.cameOnMinute ?? 0) <= 45 && (minutes.offMinute ?? 90) > 45;
  const frequency = halfTimeFrequency(state.flags['halfTimeTalks']);
  const wantsTheRoom = frequency === 'always' || (frequency === 'big' && importance !== 'normal');

  if (!held && onPitchAtTheBreak && wantsTheRoom) {
    const firstHalf = simulateUserMatch(new Rng(matchSeed), { ...baseCtx, stopAtHalfTime: true });
    const group = positionGroup(minutes.slot ?? player.primaryPos);
    const scoreDiff = userIsHome
      ? firstHalf.result.homeGoals - firstHalf.result.awayGoals
      : firstHalf.result.awayGoals - firstHalf.result.homeGoals;
    const soFar = ratingSoFar(firstHalf.events, player.id);
    const dictates = managerDictates(state.managerTrust, player.squadRole);
    const demand = dictates ? managerDemand(rng, scoreDiff, soFar, group) : null;
    const options = instructionsFor(group);
    if (demand && !options.includes(demand)) options.unshift(demand);

    state.pendingHalfTime = {
      matchId,
      competitionId,
      homeClubId,
      awayClubId,
      importance,
      ...(youthOpponentRating !== undefined ? { youthOpponentRating } : {}),
      matchSeed,
      lineup,
      minutes,
      firstHalfEvents: firstHalf.events,
      score: [firstHalf.result.homeGoals, firstHalf.result.awayGoals],
      rating: soFar,
      mental: baseCtx.mental,
      atmosphere,
      penaltyTaker: baseCtx.penaltyTaker,
      demand,
      options,
    };
    // Nothing above this line has touched the world, and the caller has not marked the
    // fixture played yet, so the week can simply be walked again once he has answered.
    throw new HalfTimeInterrupt();
  }

  const outcome = simulateUserMatch(new Rng(matchSeed), {
    ...baseCtx,
    ...(held?.chosen ? { instruction: held.chosen } : {}),
  });
  let instructionFatigue = outcome.fatigueFactor;
  if (held) state.pendingHalfTime = undefined;

  const result = outcome.result;
  // Instructions given while the first half was being watched are replayed into the
  // final simulation before career totals consume it. The same deterministic helper
  // produces the same action minute, line contribution and rating change.
  for (const change of held?.liveInstructions ?? []) {
    const applied = writeLiveInstruction(state, result, change.minute, change.instruction, 44);
    if (applied) {
      instructionFatigue += applied.fatigueDelta / 12;
    }
  }
  if (held?.chosen) result.instruction = held.chosen;
  if (!pickable) {
    result.userLine!.reasonNotPlayed = suspension
      ? 'suspended'
      : isInjured(player)
        ? 'injured'
        : isAcademyPlayer(state) || !gate.allowed
          ? 'notInSquad'
          : 'notSelected';
  }

  // Suspensions tick down on matches the player was banned for.
  if (suspension) {
    suspension.matchesRemaining -= 1;
    player.condition.suspensions = player.condition.suspensions.filter((s) => s.matchesRemaining > 0);
  }

  if (!friendly) settleGrudge(state, opponentId, result);

  // The debut is decided after the fact: it is the first match he actually got on the
  // pitch for, not every match the club played while he watched from outside.
  const seniorDebutAlreadyMade = state.achievements.some(
    (achievement) => achievement.id === 'firstProMatch',
  ) || state.matchLog.some(
    (match) => match.userLine?.played
      && !match.competitionId.startsWith('friendly')
      && !match.competitionId.startsWith('national.')
      && !match.competitionId.endsWith('.youth'),
  );
  if (!friendly && !youthMatch && result.userLine?.played && !seniorDebutAlreadyMade) {
    result.importance = 'firstProMatch';
    pushNews(state, 'news.debut', { player: `${player.firstName} ${player.lastName}`, club: club.name }, 'high');
    unlock(state, 'firstProMatch', { club: club.name });
    unlock(state, 'debut', { club: club.name });
    raiseMilestone(state, 'debut', { force: true });
  }

  if (friendly) {
    applyFriendlyToPlayer(state, rng, result, outcome.injuryRolled);
  } else {
    applyMatchToPlayer(state, index, rng, result, competitionId, outcome.injuryRolled, instructionFatigue);
  }

  // A plan is for one opponent. It does not carry into next Saturday.
  if (state.matchPlan?.key === planKey) state.matchPlan = undefined;

  // Whose shirt he was in. Needed the moment a season is played at two clubs.
  result.userClubId = club.id;
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
/**
 * The fixture he talked his way into, once it has been played.
 *
 * He put his name on this one in public, so it is worth double in both directions: a
 * good afternoon here is remembered for a year, and a bad one is remembered longer.
 * Either way the account is closed - he does not get to keep collecting on one quote.
 */
function settleGrudge(state: CareerState, opponentId: string, result: MatchResult): void {
  if (grudgeClubId(state) !== opponentId) return;
  const line = result.userLine;
  const opponent = state.world.clubs[opponentId];
  state.flags['grudgeClubId'] = '';
  state.flags['grudgeUntilWeek'] = 0;
  if (!line?.played) {
    // He said it and then did not play. That is its own kind of answer.
    state.relationships.fans = clamp(state.relationships.fans - 4, 0, 100);
    state.relationships.media = clamp(state.relationships.media - 3, 0, 100);
    pushInbox(state, 'media', 'inbox.grudge.absent', { club: opponent?.name ?? '' });
    return;
  }

  const swing = line.rating >= 7.0 ? 1 : line.rating < 6.3 ? -1 : 0;
  if (swing === 0) {
    pushInbox(state, 'media', 'inbox.grudge.quiet', { club: opponent?.name ?? '' });
    return;
  }

  const scale = 1 + line.goals * 0.5;
  state.player.reputation = clamp(state.player.reputation + swing * 3 * scale, 0, 100);
  state.player.fame = clamp(state.player.fame + swing * 4 * scale, 0, 100);
  state.relationships.fans = clamp(state.relationships.fans + swing * 9, 0, 100);
  state.relationships.media = clamp(state.relationships.media + swing * 6, 0, 100);
  state.player.morale = clamp(state.player.morale + swing * 7, 0, 100);
  pushInbox(state, 'media', swing > 0 ? 'inbox.grudge.won' : 'inbox.grudge.lost', { club: opponent?.name ?? '' });
  pushNews(
    state,
    swing > 0 ? 'news.grudge.won' : 'news.grudge.lost',
    { player: `${state.player.firstName} ${state.player.lastName}`, club: opponent?.name ?? '' },
    'high',
  );
}

/**
 * Playing at a ground he has given a reason to hate him.
 *
 * Away at the club he named, the noise is personal, and a player who cannot handle
 * that hears every bit of it. At home the same crowd is behind him instead.
 */
function grudgeFactor(state: CareerState, opponentId: string, userIsHome: boolean): number {
  if (grudgeClubId(state) !== opponentId) return 1;
  const nerve = (state.player.personality.pressureHandling - 50) / 50;   // -1 .. 1
  return userIsHome ? 1 + 0.03 + nerve * 0.02 : 1 - 0.07 + nerve * 0.05;
}

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

/**
 * Camp matches are evidence, not official statistics. They can win or lose the coach,
 * build sharpness and cause a real injury, but they do not award money, trigger a
 * professional debut, settle media promises or create league suspensions.
 */
function applyFriendlyToPlayer(
  state: CareerState,
  rng: Rng,
  result: MatchResult,
  injuryRolled: boolean,
): void {
  const line = result.userLine;
  if (!line) return;
  const player = state.player;
  const appsKey = `campApps:${state.world.season}`;
  const ratingKey = `campRatingSum:${state.world.season}`;
  if (line.played) {
    const weight = clamp(line.minutes / 90, 0.2, 1);
    const trustDelta = ((line.rating - 6.4) * 3 + line.goals * 0.5 + line.assists * 0.35 - line.red * 5) * weight;
    state.managerTrust = clamp(state.managerTrust + trustDelta, 0, 100);
    state.relationships.manager = state.managerTrust;
    player.morale = clamp(player.morale + (line.rating - 6.4) * 0.9, 0, 100);
    player.condition.sharpness = clamp(player.condition.sharpness + line.minutes / 18, 0, 100);
    state.flags[appsKey] = Number(state.flags[appsKey] ?? 0) + 1;
    state.flags[ratingKey] = Number(state.flags[ratingKey] ?? 0) + line.rating;
    updateCampAssessment(state);

    if (injuryRolled) {
      const injury = rollInjury(rng, player, state.world.season, 1.05);
      addInjury(player, injury);
      reportInjury(state, injury, 'match');
    }
  }

  /*
   * The coach's review, once a week.
   *
   * A camp week holds two friendlies, and the review is written as one conversation
   * about the week - so it waits for the second of them. The flag for this match has
   * not been written yet, which is what makes the slot being played the one `nextCampSlot`
   * still reports.
   */
  const lastOfWeek = nextCampSlot(state) === CAMP_SLOTS[CAMP_SLOTS.length - 1];
  if (!lastOfWeek) return;

  const weekRatings = state.matchLog
    .filter((match) => (
      match.season === state.world.season
      && match.week === state.world.week
      && match.competitionId.startsWith('friendly')
      && match.userLine?.played
    ))
    .map((match) => match.userLine!.rating);
  if (line.played) weekRatings.push(line.rating);
  if (weekRatings.length > 0) {
    const weekRating = weekRatings.reduce((sum, rating) => sum + rating, 0) / weekRatings.length;
    const recommendedFocus = String(
      state.flags[`campRecommendedFocus:${state.world.season}`] ?? 'balanced',
    ) as TrainingPlan['focus'];
    const recommendedIntensity = String(
      state.flags[`campRecommendedIntensity:${state.world.season}`] ?? 'normal',
    ) as TrainingIntensity;
    pushInbox(state, 'manager', `inbox.trainingCampFeedback.${state.world.week}`, {
      rating: weekRating.toFixed(1),
      strength: `skill.${String(state.flags[`campStrength:${state.world.season}`] ?? '')}`,
      weakness: `skill.${String(state.flags[`campWeakness:${state.world.season}`] ?? '')}`,
      focus: `train.focus.${recommendedFocus}`,
      intensity: `train.intensity.${recommendedIntensity}`,
    }, undefined, {
      type: 'setTrainingFocus',
      focus: recommendedFocus,
      intensity: recommendedIntensity,
    });
  }

  if (state.world.week === PRESEASON_END_WEEK) {
    const apps = Number(state.flags[appsKey] ?? 0);
    const average = apps > 0 ? Number(state.flags[ratingKey] ?? 0) / apps : 0;
    const oldRole = state.player.squadRole;
    const academy = oldRole === 'academy';
    const age = state.world.season - state.player.birthYear;
    const academyPromotion = academy && age >= 16 && average >= 7.15 && state.managerTrust >= 48;
    const oldIndex = SQUAD_ROLE_ORDER.indexOf(oldRole);
    const direction = academy
      ? academyPromotion ? 1 : average < 6.15 || state.managerTrust < 36 ? -1 : 0
      : average >= 7.15 && state.managerTrust >= 48
        ? 1
        : average < 6.15 || state.managerTrust < 36
          ? -1
          : 0;
    const nextIndex = clamp(oldIndex + direction, 0, SQUAD_ROLE_ORDER.length - 1);
    const nextRole: SquadRole = academy
      ? academyPromotion ? 'futureProspect' : 'academy'
      : SQUAD_ROLE_ORDER[nextIndex] ?? oldRole;
    state.player.squadRole = nextRole;
    if (state.contract) state.contract.squadRole = nextRole;
    if (academyPromotion && state.player.clubId) {
      state.flags['calledUpToSeniors'] = true;
      const seniorList = state.world.squads[state.player.clubId]
        ?? (state.world.squads[state.player.clubId] = []);
      if (!seniorList.includes(state.player.id)) seniorList.push(state.player.id);
    }
    state.flags[`campVerdict:${state.world.season}`] = nextRole;
    pushInbox(state, 'manager', 'inbox.trainingCampReport', {
      apps,
      rating: average.toFixed(1),
      trust: Math.round(state.managerTrust),
      strength: `skill.${String(state.flags[`campStrength:${state.world.season}`] ?? '')}`,
      weakness: `skill.${String(state.flags[`campWeakness:${state.world.season}`] ?? '')}`,
      focus: `train.focus.${String(state.flags[`campRecommendedFocus:${state.world.season}`] ?? 'balanced')}`,
      intensity: `train.intensity.${String(state.flags[`campRecommendedIntensity:${state.world.season}`] ?? 'normal')}`,
    });
    const verdict = academy
      ? academyPromotion ? 'academyPromoted' : direction < 0 ? 'academyDevelopment' : 'academyConfirmed'
      : direction > 0 ? 'promoted' : direction < 0 ? 'demoted' : 'confirmed';
    pushInbox(state, 'manager', `inbox.trainingCampVerdict.${verdict}`, {
      rating: average.toFixed(1),
    });
  }
}

type LiveInstructionAction = {
  type: MatchEvent['type'];
  stat?: 'shots' | 'keyPasses' | 'tackles';
  rating: number;
  ambient?: boolean;
};

/** The concrete action the next phase of play should show for each instruction. */
function liveInstructionAction(id: HalfTimeInstructionId): LiveInstructionAction {
  switch (id) {
    case 'shootFromDistance': return { type: 'miss', stat: 'shots', rating: -0.05 };
    case 'playAlone': return { type: 'miss', stat: 'shots', rating: -0.08 };
    case 'pushForward': return { type: 'miss', stat: 'shots', rating: -0.03 };
    case 'takeThemOn': return { type: 'keyPass', stat: 'keyPasses', rating: 0.1 };
    case 'createForOthers':
    case 'passMore': return { type: 'keyPass', stat: 'keyPasses', rating: 0.12 };
    case 'holdShape':
    case 'defendMore': return { type: 'tackle', stat: 'tackles', rating: 0.12 };
    case 'pressHigher':
    case 'chaseEverything': return { type: 'tackle', stat: 'tackles', rating: 0.14 };
    case 'saveLegs': return { type: 'chance', rating: 0.02, ambient: true };
  }
}

/**
 * Write one visible, measurable response to an instruction into a match.
 *
 * The main simulation already contains the ordinary football. This adds the action the
 * player deliberately changed: another long shot, an extra progressive pass, or an
 * extra defensive contest. It changes his real line and rating, not just the caption.
 */
function writeLiveInstruction(
  state: CareerState,
  match: MatchResult,
  minute: number,
  instructionId: HalfTimeInstructionId,
  maxMinute = 89,
): { ratingDelta: number; fatigueDelta: number } | null {
  const line = match.userLine;
  if (!line?.played || !line.position) return null;
  const entered = line.cameOnMinute ?? 0;
  const left = Math.min(line.offMinute ?? 90, maxMinute + 1);
  if (minute < entered || minute >= left - 1) return null;
  if (!instructionsFor(positionGroup(line.position)).includes(instructionId)) return null;

  const changes = match.instructionChanges ?? (match.instructionChanges = []);
  const previous = changes[changes.length - 1];
  if (previous && (minute - previous.minute < 5 || previous.instruction === instructionId)) return null;

  const available = Math.max(1, left - minute - 1);
  const offset = 1 + (hashString(`${match.id}:${minute}:${instructionId}:${changes.length}`) % Math.min(8, available));
  const eventMinute = Math.min(left - 1, minute + offset);
  const action = liveInstructionAction(instructionId);
  const before = line.rating;
  if (action.stat) line[action.stat] += 1;
  line.rating = clamp(Math.round((line.rating + action.rating) * 100) / 100, 3, 10);
  match.events ??= [];
  match.events.push({
    minute: eventMinute,
    type: action.type,
    playerId: state.player.id,
    byUser: true,
    forUserTeam: true,
    detailKey: `match.live.instruction.${instructionId}`,
    ...(action.ambient ? { ambient: true } : {}),
  });
  match.events.sort((a, b) => a.minute - b.minute);
  changes.push({ minute, instruction: instructionId });
  match.instruction = instructionId;

  const remainingShare = clamp((left - minute) / 90, 0, 1);
  const fatigueDelta = (halfTimeEffect(instructionId).fatigue - 1) * remainingShare * 10;
  return { ratingDelta: line.rating - before, fatigueDelta };
}

/**
 * Give the player an instruction while the live clock is running.
 *
 * A first-half match is still pending, so the action is carried into the final result.
 * A completed simulation is corrected in place together with every career total that
 * already consumed its rating. Either path has real statistical and physical impact.
 */
export function applyLiveInstruction(
  state: CareerState,
  matchId: string,
  minute: number,
  instructionId: HalfTimeInstructionId,
): boolean {
  const at = clamp(Math.floor(minute), 0, 89);
  const held = state.pendingHalfTime?.matchId === matchId ? state.pendingHalfTime : null;
  if (held) {
    const preview: MatchResult = {
      id: held.matchId,
      season: state.world.season,
      week: state.world.week,
      competitionId: held.competitionId,
      homeClubId: held.homeClubId,
      awayClubId: held.awayClubId,
      homeGoals: held.score[0],
      awayGoals: held.score[1],
      detailLevel: 1,
      importance: held.importance,
      userLine: {
        played: true,
        started: held.minutes.started,
        minutes: Math.min(45, held.minutes.minutes),
        position: held.minutes.slot,
        goals: 0,
        assists: 0,
        shots: 0,
        keyPasses: 0,
        tackles: 0,
        saves: 0,
        yellow: 0,
        red: 0,
        rating: held.rating,
        motm: false,
        ...(held.minutes.cameOnMinute !== undefined ? { cameOnMinute: held.minutes.cameOnMinute } : {}),
      },
      events: held.firstHalfEvents,
      instructionChanges: held.liveInstructions ?? [],
    };
    const applied = writeLiveInstruction(state, preview, at, instructionId, 44);
    if (!applied) return false;
    held.firstHalfEvents = preview.events ?? held.firstHalfEvents;
    held.rating = preview.userLine?.rating ?? held.rating;
    held.liveInstructions = preview.instructionChanges ?? [];
    return true;
  }

  const match = state.matchLog.find((entry) => entry.id === matchId);
  if (!match) return false;
  const applied = writeLiveInstruction(state, match, at, instructionId);
  if (!applied || !match.userLine) return false;

  const player = state.player;
  const weight = clamp(match.userLine.minutes / 90, 0.2, 1);
  player.condition.fatigue = clamp(player.condition.fatigue + applied.fatigueDelta, 0, 100);
  const nationalMatch = match.competitionId.startsWith('national.')
    || match.competitionId === 'friendly.national';
  if (nationalMatch) {
    // International form belongs to the player and his country. It must not rewrite
    // the club season's rating total or imply that his club manager watched a national
    // coach's instruction as a test of loyalty.
    player.reputation = clamp(player.reputation + applied.ratingDelta * 0.45 * weight, 0, 100);
    player.morale = clamp(player.morale + applied.ratingDelta * 1.4, 0, 100);
  } else if (match.competitionId.startsWith('friendly')) {
    const ratingKey = `campRatingSum:${state.world.season}`;
    state.flags[ratingKey] = Number(state.flags[ratingKey] ?? 0) + applied.ratingDelta;
    state.managerTrust = clamp(state.managerTrust + applied.ratingDelta * 3 * weight, 0, 100);
    player.morale = clamp(player.morale + applied.ratingDelta * 0.9, 0, 100);
    updateCampAssessment(state);
    // The coach's camp review is written when the simulation finishes, before the
    // player watches and changes his instructions. Keep that review synced with what
    // he actually did on the pitch.
    const feedback = state.inbox.find(
      (message) => message.week === match.week
        && message.season === match.season
        && message.titleKey === `inbox.trainingCampFeedback.${match.week}`,
    );
    if (feedback) {
      const recommendedFocus = String(
        state.flags[`campRecommendedFocus:${state.world.season}`] ?? 'balanced',
      ) as TrainingPlan['focus'];
      const recommendedIntensity = String(
        state.flags[`campRecommendedIntensity:${state.world.season}`] ?? 'normal',
      ) as TrainingIntensity;
      feedback.args = {
        ...feedback.args,
        rating: match.userLine.rating.toFixed(1),
        strength: `skill.${String(state.flags[`campStrength:${state.world.season}`] ?? '')}`,
        weakness: `skill.${String(state.flags[`campWeakness:${state.world.season}`] ?? '')}`,
        focus: `train.focus.${recommendedFocus}`,
        intensity: `train.intensity.${recommendedIntensity}`,
      };
      feedback.action = {
        type: 'setTrainingFocus',
        focus: recommendedFocus,
        intensity: recommendedIntensity,
      };
    }
  } else {
    const stats = state.world.seasonStats[player.id];
    if (stats) stats.ratingSum += applied.ratingDelta;
    if (match.competitionId.endsWith('.youth') && state.world.youth?.form) {
      state.world.youth.form.ratingSum += applied.ratingDelta;
    }
    state.managerTrust = clamp(state.managerTrust + applied.ratingDelta * 1.1 * weight, 0, 100);
    player.morale = clamp(player.morale + applied.ratingDelta * 1.6, 0, 100);
  }
  if (!nationalMatch) state.relationships.manager = state.managerTrust;
  if (state.lastMatch?.id === match.id) state.lastMatch = match;
  return true;
}

function applyMatchToPlayer(
  state: CareerState,
  index: PackIndex,
  rng: Rng,
  result: MatchResult,
  competitionId: string,
  injuryRolled: boolean,
  /** What the second half's instruction did to his legs. 1 is an ordinary afternoon. */
  fatigueFactor = 1,
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
    // And the same ninety minutes against the shirt he was actually wearing.
    recordSpell(stats, player.clubId, competitionId, line);
    // And under the competition it was played in.
    tally(stats, matchCategory(competitionId), line.minutes, line.goals, line.assists, line.rating);

    // Forty-five minutes chasing every lost cause costs more than forty-five minutes of
    // keeping the ball. Whatever he was told at the break is paid for in his legs.
    if (fatigueFactor !== 1) {
      const extra = (fatigueFactor - 1) * (line.minutes / 90) * 12;
      player.condition.fatigue = clamp(player.condition.fatigue + extra, 0, 100);
    }

    // Manager trust follows performance, weighted by how much of the game he played.
    const weight = clamp(line.minutes / 90, 0.2, 1);
    const delta = ((line.rating - 6.6) * 2.2 + (line.motm ? 2 : 0)) * weight - line.red * 6;
    state.managerTrust = clamp(state.managerTrust + delta * 0.5, 0, 100);
    state.relationships.manager = state.managerTrust;
    player.morale = clamp(player.morale + (line.rating - 6.4) * 1.6, 0, 100);
    player.reputation = clamp(player.reputation + line.goals * 0.35 + line.assists * 0.2 + (line.motm ? 0.5 : 0), 0, 100);
    player.fame = clamp(player.fame + line.goals * 0.4 + (line.motm ? 0.6 : 0), 0, 100);

    if (stats.goals >= 1 && !state.achievements.some((a) => a.id === 'firstGoal')) {
      unlock(state, 'firstGoal');
      raiseMilestone(state, 'firstGoal', { force: true });
    }
    // The first one he made rather than scored, and the hundredth time he walked out.
    if (line.assists >= 1 && !state.achievements.some((a) => a.id === 'firstAssist')) {
      unlock(state, 'firstAssist');
      raiseMilestone(state, 'firstAssist', { force: true });
    }
    if (careerApps(state) >= 100 && !state.achievements.some((a) => a.id === 'apps100')) {
      unlock(state, 'apps100');
      raiseMilestone(state, 'hundredthApp', { force: true });
    }
    if (line.goals >= 3) unlock(state, 'hatTrick');

    // Cards and suspensions, using the competition's own rules.
    const competition = index.competitionById.get(competitionId);
    const rules = competition?.cards ?? { yellowSuspensionThreshold: 5, resetAfterMatchday: 0, secondYellowSuspension: 1, redSuspension: 3 };
    // Most leagues wipe yellow-card totals after a given matchday; the rule was in the
    // data and never applied.
    const compState = state.world.competitions[competitionId];
    const matchday = compState
      ? compState.fixtures.filter((f) => f.played && f.week <= state.world.week).length / Math.max(1, compState.clubIds.length / 2)
      : 0;
    if (rules.resetAfterMatchday > 0 && matchday >= rules.resetAfterMatchday && !state.flags[`cardsReset:${competitionId}:${state.world.season}`]) {
      state.flags[`cardsReset:${competitionId}:${state.world.season}`] = true;
      player.condition.yellowCards[competitionId] = 0;
    }

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
      addInjury(player, injury);
      reportInjury(state, injury, 'match');
    }

    // Going against the manager at the break is settled the same way everything else
    // in this game is: by what happened next.
    if (state.flags['defiedTheManager']) {
      state.flags['defiedTheManager'] = 0;
      if (line.rating >= 7.2) {
        adjustRelationship(state, 'manager', 9);
        player.personality.determination = clamp(player.personality.determination + 1.2, 1, 99);
        pushInbox(state, 'manager', 'inbox.halfTime.vindicated', {});
      } else if (line.rating < 6.4) {
        adjustRelationship(state, 'manager', -7);
        pushInbox(state, 'manager', 'inbox.halfTime.toldYouSo', {});
      }
    }

    // Anything he promised in front of a camera is settled by what he just did, and
    // what it cost or paid is put in front of him rather than filed away.
    const settled = settleClaim(rng, state, line.rating);
    if (settled) {
      pushInbox(state, 'media', settled.carried ? 'inbox.claimBackedUp' : 'inbox.claimFailed', {});
      state.lastResult = settled.result;
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

/**
 * File the afternoon under the club he played it for.
 *
 * Everything that reads a season - the hub card, the career page, the club he is at now -
 * was reading one number for a season that may have been played in two shirts.
 */
function recordSpell(
  stats: SeasonStats,
  clubId: string | null,
  competitionId: string,
  line: UserMatchLine,
): void {
  if (!clubId) return;
  stats.spells = stats.spells ?? [];
  let spell = stats.spells.find((entry) => entry.clubId === clubId);
  if (!spell) {
    spell = {
      clubId,
      competitionId,
      apps: 0,
      goals: 0,
      assists: 0,
      minutes: 0,
      ratingSum: 0,
      ratedApps: 0,
    };
    stats.spells.push(spell);
  }
  // A league is what he mostly played in that shirt, not the last cup tie he was in.
  if (!competitionId.startsWith('friendly') && !competitionId.includes('cup')) {
    spell.competitionId = competitionId;
  }
  spell.apps++;
  spell.minutes += line.minutes;
  spell.goals += line.goals;
  spell.assists += line.assists;
  if (line.rating > 0) {
    spell.ratingSum += line.rating;
    spell.ratedApps++;
  }
}

/**
 * Telling him what has happened to him, and asking what he wants done about it.
 *
 * An injury used to be one line in the mailbox with a number of weeks in it. What a
 * player actually gets is a diagnosis - what it is, how bad it is, roughly how long -
 * and then a conversation with the medical room in which somebody offers him a choice
 * that is really a choice about risk. That conversation is here, and the answer is
 * rolled rather than scripted: the same call on the same injury can have him back early,
 * on time, or worse off than he started.
 */
function reportInjury(state: CareerState, injury: Injury, how: 'match' | 'training' | 'aggravated'): void {
  pushInbox(state, 'medical', `inbox.injury.${how}`, {
    type: `injury.${injury.type}`,
    severity: `severity.${injury.severity}`,
    weeks: injury.weeksOut,
  });
  openTreatmentDecision(state, injury);
}

function openTreatmentDecision(state: CareerState, injury: Injury): void {
  if (state.pendingDecisions.some((decision) => decision.eventId === 'treatmentChoice')) return;
  const options = treatmentsFor(injury);
  if (options.length === 0) return;
  const absoluteWeek = state.world.season * 52 + state.world.week;
  state.flags['treatingInjury'] = injury.id;
  const decisionId = `treatment_${injury.id}`;
  state.pendingDecisions.push({
    id: decisionId,
    kind: 'event',
    eventId: 'treatmentChoice',
    category: 'medical',
    blocking: true,
    textKey: 'treatment.ask',
    textArgs: {
      type: `injury.${injury.type}`,
      severity: `severity.${injury.severity}`,
      weeks: injury.weeksOut,
    },
    options: options.map((id) => ({
      id,
      labelKey: `treatment.${id}`,
      riskKey: id === 'surgery' ? 'risk.low' : id === 'longRest' ? 'risk.low' : id === 'conservative' ? 'risk.medium' : 'risk.high',
      effects: [],
    })),
    expiresWeek: absoluteWeek + 2,
  });
  pushInbox(state, 'medical', 'inbox.treatmentAsked', {
    type: `injury.${injury.type}`,
    weeks: injury.weeksOut,
  }, decisionId);
}

/**
 * His answer to the medical room. What it costs him in weeks, what it leaves behind, and
 * how much of the injury he is still carrying when he comes back.
 */
export function answerTreatment(
  state: CareerState,
  decisionId: string,
  optionId: string,
): DecisionResult | null {
  const at = state.pendingDecisions.findIndex(
    (decision) => decision.id === decisionId && decision.eventId === 'treatmentChoice',
  );
  if (at === -1) return null;
  const choice = optionId as TreatmentChoice;
  if (!TREATMENTS[choice]) return null;
  state.pendingDecisions.splice(at, 1);

  const injuryId = String(state.flags['treatingInjury'] ?? '');
  const injury = state.player.condition.injuries.find((entry) => entry.id === injuryId)
    ?? state.player.condition.injuries[0];
  if (!injury) return null;

  const rng = mainRng(state);
  const club = userClub(state);
  const result = treatInjury(rng, injury, choice, club?.academy ?? 50);
  state.flags['treatingInjury'] = '';
  state.flags['aggravationRisk'] = result.aggravationRisk;
  state.flags['aggravationWeeks'] = AGGRAVATION_SPREAD;

  const changes: AppliedChange[] = [];
  track(changes, 'change.weeksOut', result.weeksBefore, result.weeksAfter, false);

  // What he does not get back. A leg that was rushed is a slower leg.
  if (result.recoveryQuality < 1) {
    const legs: AttributeKey[] = ['pace', 'acceleration', 'agility', 'stamina'];
    for (const key of legs) {
      const before = state.player.attributes[key];
      state.player.attributes[key] = clamp(before * result.recoveryQuality, 1, 99);
      track(changes, `change.attr.${key}`, before, state.player.attributes[key]);
    }
  }
  // And a proper rest can send him back out sharper than he came off.
  if (choice === 'longRest') {
    const before = state.player.condition.fatigue;
    state.player.condition.fatigue = clamp(before - 18, 0, 100);
    track(changes, 'change.fatigue', before, state.player.condition.fatigue, false);
  }

  pushInbox(state, 'medical', `inbox.treatment.${result.outcome}`, {
    treatment: `treatment.${choice}`,
    weeks: result.weeksAfter,
  });
  commitRng(state, rng);

  return {
    changes,
    consequences: [],
    narrativeKey: `treatment.${choice}.${result.outcome}`,
    answerKey: `treatment.${choice}`,
  };
}

function nationalContextFor(state: CareerState, index: PackIndex, club: Club): CallUpContext {
  const player = state.player;
  const season = state.world.season;
  const age = season - player.birthYear;
  const comp = index.competitionById.get(club.competitionId);
  const youthForm = state.world.youth?.form;
  const injuredWeeks = player.condition.injuries.reduce(
    (longest, injury) => Math.max(longest, injury.weeksRemaining),
    0,
  );
  return {
    player,
    age,
    season,
    minutesPct: minutesPct(state),
    clubReputation: club.reputation,
    leagueReputation: comp?.reputation ?? 35,
    index,
    nt: state.nationalTeam,
    youthMinutesPct: youthMinutesPct(state),
    youthRating: youthForm && youthForm.apps > 0 ? youthForm.ratingSum / youthForm.apps : 0,
    youthGoals: youthForm?.goals ?? 0,
    injuredWeeks,
    sharpness: player.condition.sharpness,
    fitness: player.fitness,
    form: player.form,
  };
}

function handleInternationalWeek(
  state: CareerState,
  index: PackIndex,
  rng: Rng,
  nationalCtx: CallUpContext,
  qualifierDue = false,
): boolean {
  const player = state.player;
  const season = state.world.season;
  if (isInjured(player)) return false;

  // The squad was named last week, if it was named at all.
  const callUp = takeAnnouncedCallUp(state) ?? rollCallUp(rng, nationalCtx);
  if (!callUp) return false;

  const country = index.countryByCode.get(callUp.countryCode);
  if (!country) return false;

  const nt = state.nationalTeam;
  nt.level = callUp.level;
  nt.callUpHistory.push({ season, level: callUp.level, countryCode: callUp.countryCode });

  // A senior qualifying week uses this selection for the qualifier below; it must not
  // also invent one or two friendlies and count three caps in one week. A youth call-up
  // still has its own age-group fixture while the senior side plays its qualifier.
  if (qualifierDue && callUp.isSenior) return true;

  const opponents = index.pack.countries.filter((candidate) => (
    candidate.code !== country.code
    && candidate.confederation === country.confederation
    && Math.abs(candidate.reputation - country.reputation) <= 18
  ));
  const fallback = index.pack.countries.filter((candidate) => candidate.code !== country.code);
  const matches = rng.int(1, 2);
  for (let i = 0; i < matches; i++) {
    const outcome = simulateInternationalMatch(rng, player, callUp.level, country.reputation);
    if (outcome.played && !callUp.isSenior) {
      nt.youthCaps = (nt.youthCaps ?? 0) + 1;
      nt.youthGoals = (nt.youthGoals ?? 0) + outcome.goals;
      if (nt.youthCaps === 1) {
        pushNews(state, 'news.youthDebut', {
          player: `${player.firstName} ${player.lastName}`,
          country: country.name,
          level: `national.level.${callUp.level}`,
        }, 'medium');
      }
    }
    if (outcome.played && callUp.isSenior) {
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
    if (outcome.played) {
      player.reputation = clamp(player.reputation + 0.6 + outcome.goals * 0.8, 0, 100);
      player.fame = clamp(player.fame + 0.8 + outcome.goals * 1.1, 0, 100);
      player.condition.fatigue = clamp(player.condition.fatigue + outcome.minutes / 9, 0, 100);
      tallyNational(state, outcome);
    }

    const opponent = rng.pick(opponents.length > 0 ? opponents : fallback);
    const quick = simulateQuickResult(rng, {
      homeRating: country.reputation,
      awayRating: opponent.reputation,
    });
    const score: [number, number] = [Math.max(quick[0], outcome.goals), quick[1]];
    recordNationalAppearance(state, nationalMatchResult(
      state,
      index,
      rng,
      `friendly.national.${season}.${state.world.week}.${callUp.level}.${i}.${country.code}.${opponent.code}`,
      'friendly.national',
      country.code,
      opponent.code,
      score,
      country.code,
      outcome,
    ));
  }
  return callUp.isSenior;
}

/**
 * Who is picking the side this week.
 *
 * Three ways the answer changes: a career saved before managers had names gets one
 * quietly, the story in the pack about a sacking now actually sacks him, and a season
 * going badly enough gets him sacked without any story at all. In every case the trust
 * the player had built is mostly gone, and the new man's opinion of him has to be earned
 * from what he does next.
 */
function resolveManagerChange(state: CareerState, index: PackIndex, rng: Rng, club: Club): void {
  // A career from before the dugout was modelled, or a club change that predates it.
  if (!state.manager || state.manager.clubId !== club.id) {
    state.manager = generateManager(rng, index, club, state.world.season);
    return;
  }

  const told = Boolean(state.flags['managerSacked']);
  if (!told) {
    const compState = state.world.competitions[club.competitionId];
    const rows = compState ? sortedTable(compState) : [];
    const size = rows.length;
    const place = size > 1 ? rows.findIndex((row) => row.clubId === club.id) : -1;
    const byStrength = size > 1
      ? Object.keys(compState!.table)
        .map((id) => state.world.clubs[id])
        .filter((entry): entry is Club => Boolean(entry))
        .sort((a, b) => b.strength - a.strength)
        .findIndex((entry) => entry.id === club.id)
      : -1;
    const chance = sackingChance({
      weeksInCharge: (state.world.season - state.manager.since) * 52 + state.world.week,
      seasonWeek: state.world.week,
      tablePlace: place >= 0 ? place / Math.max(1, size - 1) : null,
      expectedPlace: byStrength >= 0 ? byStrength / Math.max(1, size - 1) : null,
      boardMood: state.relationships.board,
    });
    if (chance <= 0 || !rng.chance(chance)) return;
  }
  state.flags['managerSacked'] = false;

  const outgoing = state.manager;
  const trustBefore = state.managerTrust;
  const arrival = appointManager(rng, state, index, club);
  pushInbox(state, 'club', 'inbox.manager.sacked', { manager: outgoing.name, club: club.name });
  pushInbox(state, 'manager', `inbox.manager.arrived.${arrival.style}`, {
    manager: arrival.name,
    club: club.name,
  });
  pushNews(state, 'news.manager.arrived', { club: club.name, manager: arrival.name }, 'high');
  // He is not being told a number, but he is being told which way it went.
  if (state.managerTrust < trustBefore - 6) {
    pushInbox(state, 'manager', 'inbox.manager.startingAgain', { manager: arrival.name });
  } else if (state.managerTrust > trustBefore + 6) {
    pushInbox(state, 'manager', 'inbox.manager.likesYou', { manager: arrival.name });
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

  // The youth pyramid settles on its own terms: its own champions, its own promotion,
  // its own honours, none of it decided by what the first teams did.
  settleYouthSeason(state, index, rng);

  // Who plays in Europe next season, decided from the final tables before promotion
  // and relegation shuffle anybody between divisions.
  decideEuropeanQualification(state, index);

  applyPromotionRelegation(state, index, outcomes);

  /*
   * The summer in the dugout.
   *
   * Relegation is nearly always the end of a manager, a long stay ends of its own accord
   * eventually - a better job, a board that wants a new voice - and either way the man
   * who picks the side in August is not always the man who picked it in May.
   */
  if (club && state.manager?.clubId === club.id) {
    const size = Object.keys(state.world.competitions[club.competitionId]?.table ?? {}).length;
    const relegated = leaguePosition !== null && leaguePosition >= Math.max(1, size - 2);
    // A man who takes a club well past where its money says it belongs is a man other
    // clubs ring in May. Losing a manager to a better job is not the same story as
    // losing one to the sack, but the player wakes up to the same new voice in August.
    const expected = size > 1
      ? Object.keys(state.world.competitions[club.competitionId]!.table)
        .map((id) => state.world.clubs[id])
        .filter((entry): entry is Club => Boolean(entry))
        .sort((a, b) => b.strength - a.strength)
        .findIndex((entry) => entry.id === club.id) + 1
      : null;
    const overachieved = expected !== null && leaguePosition !== null && expected - leaguePosition >= Math.max(3, size * 0.25);
    const tenure = season - state.manager.since;
    const chance = relegated ? 0.72
      : overachieved ? 0.3
      : clamp(0.2 + tenure * 0.09, 0.2, 0.5);
    if (rng.chance(chance)) state.flags['managerSacked'] = true;
  }

  // Eighteen: the youth team is finished with him one way or the other.
  handleComingOfAge(state, index, rng);

  // The summer: a World Cup or a Euro, if his country is at one and he is in the squad.
  playSummerTournament(state, index, rng);

  // Individual honours, decided before the world ages and the season rolls over.
  applyAwards(state, index, rng);

  if (trophies.length > 0) raiseMilestone(state, 'trophyNight', { force: true });

  // A season spent mostly on Sunday mornings is a youth season, and the career page
  // should say so rather than filing thirty youth appearances under the first division.
  const youthApps = state.world.youth?.form.apps ?? 0;
  const youthDivision = userYouthCompetitionId(state);
  if (youthDivision && youthApps > 0 && youthApps * 2 >= stats.apps) {
    stats.competitionId = youthDivision;
  }

  /*
   * The season is over, and somebody says it out loud.
   *
   * A year of football used to end with the calendar quietly rolling over: the last
   * fixture was played, the next screen was pre-season, and nothing in between marked
   * that anything had finished. What he did, where the club came, and the name of the
   * thing that just ended.
   */
  const finishedIn = club ? index.competitionById.get(club.competitionId) : undefined;
  pushInbox(state, 'club', 'inbox.seasonOver', {
    season: `${season}/${String((season + 1) % 100).padStart(2, '0')}`,
    competition: finishedIn?.name ?? '',
    club: club?.name ?? '',
    position: leaguePosition ?? 0,
    apps: stats.apps,
    goals: stats.goals,
    assists: stats.assists,
  });
  pushNews(state, 'news.seasonOver', {
    season: `${season}/${String((season + 1) % 100).padStart(2, '0')}`,
    club: club?.name ?? '',
  }, 'high');

  // What the summer's conversation was worth, before the season is filed away.
  settleSeasonGoal(state, leaguePosition);

  // Career record for the season.
  const record: CareerSeasonRecord = {
    ...stats,
    ...(stats.spells && stats.spells.length > 1 ? { spells: stats.spells.map((spell) => ({ ...spell })) } : {}),
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

  // The summer window, at both resolutions: the whole world trades money for strength,
  // and the clubs we know by name actually buy and sell people.
  runAbstractMarket(rng, state, index);
  reportWindow(state, index, runSquadWindow(rng, state, index));

  // The careers of the people the world is keeping: a season each, recorded, and a
  // summer in which somebody comes for them or lets them go.
  advanceTrackedPlayers(rng, state, index);

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

  settleSideBets(state, rng);

  // Roll the clock forward.
  state.world.season += 1;
  state.world.week = 1;
  state.flags['movesThisSeason'] = 0;
  state.flags['offerWindow'] = '';
  state.flags['agentWindow'] = '';
  state.flags['storiesThisSeason'] = 0;
  // A brief to an agent, and a body being managed, both last a season and no longer.
  for (const brief of ['aimHigh', 'aimMinutes', 'exploringMove', 'openToLowerLeague', 'wantsLoan', 'reducedLoad']) {
    state.flags[brief] = false;
  }
  state.world.seasonStats = {};
  player.condition.yellowCards = {};
  player.condition.suspensions = [];
  state.transferOffers = [];
  initSeason(state, index, rng);
  initCampaign(state, index, rng);
  ensureModelledSquads(state, index, rng);
  askWhatTheSeasonIsFor(state, index);
  state.world.seasonStats[player.id] = emptySeasonStats(state.world.season, player.clubId, userClub(state)?.competitionId ?? null);
  state.flags['seasonStartOvr'] = overall(player.attributes, player.primaryPos, player.secondaryPos);
  state.seasonStartAttributes = { ...player.attributes };

  // A new season, named, with the division he is about to play in.
  const newClub = userClub(state);
  const newCompetition = newClub ? index.competitionById.get(newClub.competitionId) : undefined;
  pushInbox(state, 'club', 'inbox.seasonBegins', {
    season: `${state.world.season}/${String((state.world.season + 1) % 100).padStart(2, '0')}`,
    competition: newCompetition?.name ?? '',
    club: newClub?.name ?? '',
    age: state.world.season - player.birthYear,
  });
  pushNews(state, 'news.seasonBegins', {
    season: `${state.world.season}/${String((state.world.season + 1) % 100).padStart(2, '0')}`,
    competition: newCompetition?.name ?? '',
  }, 'high');

  checkRetirement(state, rng);
}

/**
 * Where the player stands in the squad now. Academy players get promoted once they
 * are close enough to the first team's level, or once they are simply too old for
 * youth football - and a club that rates them will push them up sooner.
 */
/**
 * Money he put somewhere other than the bank, settled once a year. The family business
 * either works or it does not, and holding out for a better boot deal either brings a
 * bigger one or a season with no sponsor at all.
 */
function settleSideBets(state: CareerState, rng: Rng): void {
  if (state.flags['investment']) {
    state.flags['investment'] = false;
    const roll = rng.next();
    if (roll < 0.34) {
      // The half million went out of the door when he signed; none of it comes back.
      pushInbox(state, 'personal', 'inbox.investmentFailed', { amount: 500_000 });
    } else if (roll < 0.72) {
      const back = Math.round(rng.range(0.55, 0.95) * 500_000);
      state.finances.balance += back;
      state.finances.careerEarnings += back;
      pushInbox(state, 'personal', 'inbox.investmentFlat', { amount: back });
    } else {
      const back = Math.round(rng.range(1.6, 3.4) * 500_000);
      state.finances.balance += back;
      state.finances.careerEarnings += back;
      pushInbox(state, 'personal', 'inbox.investmentPaidOff', { amount: back });
    }
  }

  if (state.flags['sponsorHoldOut']) {
    state.flags['sponsorHoldOut'] = false;
    // The bigger the name, the more sense holding out made.
    if (rng.chance(clamp(0.3 + state.player.reputation / 200, 0.3, 0.85))) {
      const deal = Math.round((60_000 + state.player.reputation * 9_000) * rng.range(1.1, 1.9));
      state.finances.balance += deal;
      state.finances.careerEarnings += deal;
      state.player.fame = clamp(state.player.fame + 3, 0, 100);
      pushInbox(state, 'personal', 'inbox.sponsorBetterDeal', { amount: deal });
    } else {
      pushInbox(state, 'personal', 'inbox.sponsorWalkedAway', {});
    }
  }
}

/**
 * The first professional contract.
 *
 * What a club pays a seventeen year old it has just promoted: mostly a function of what
 * the club can afford, with something on top for a boy who is already close to the level
 * of the side. It is not a negotiation - nobody negotiates his first deal - but it is
 * real money, and every screen that spends money uses it from here on.
 */
function signFirstProfessionalDeal(state: CareerState, club: Club, gap: number): void {
  const season = state.world.season;
  const weekly = Math.round(clamp(260 + club.finances * 20 + Math.max(0, gap + 12) * 55, 320, 14000));
  state.contract = {
    clubId: club.id,
    salaryPerWeek: weekly,
    startSeason: season,
    endSeason: season + 3,
    squadRole: state.player.squadRole,
    signingBonus: Math.round(weekly * 4),
    appearanceBonus: Math.round(weekly * 0.2),
    goalBonus: Math.round(weekly * 0.3),
    releaseClause: null,
  };
  state.finances.balance += state.contract.signingBonus;
  state.finances.careerEarnings += state.contract.signingBonus;
  pushInbox(state, 'club', 'inbox.firstProContract', {
    club: club.name,
    wage: weekly,
    years: 3,
  });
}

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
      const list = state.world.squads[club.id] ?? (state.world.squads[club.id] = []);
      if (!list.includes(player.id)) list.push(player.id);
      state.managerTrust = clamp(state.managerTrust + 6, 0, 100);
      /*
       * And the paperwork that goes with it.
       *
       * Being taken out of the academy changed his squad role and nothing else, so a boy
       * promoted to the first team went on earning scholarship money for years - which
       * he then discovered on the one screen that spends it, where a nutritionist cost
       * more than he earned. A club that puts a boy in its squad signs him first.
       */
      signFirstProfessionalDeal(state, club, gap);
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

/**
 * The youth season, settled and told.
 *
 * Titles, movement between the youth divisions, and the three individual honours - all
 * of it recorded in the same history the senior game writes into, so a career screen
 * shows the golden boot he won at seventeen next to the one he won at twenty-six.
 */
function settleYouthSeason(state: CareerState, index: PackIndex, rng: Rng): void {
  const youth = state.world.youth;
  if (!youth) return;
  const season = state.world.season;
  const club = userClub(state);
  const his = youth.userCompetitionId;

  const outcome = resolveYouthSeason(rng, state, index);

  for (const { competitionId, clubId } of outcome.champions) {
    if (!club || clubId !== club.id || competitionId !== his) continue;
    state.trophies.push({ season, competitionId, kind: 'league' });
    unlock(state, 'youthLeagueChampion', { competition: competitionId });
    pushInbox(state, 'club', 'inbox.youth.champions', { club: club.name });
    pushNews(state, 'news.youth.champions', { club: club.name }, 'high');
  }

  if (club) {
    for (const { clubIds } of outcome.promoted) {
      if (!clubIds.includes(club.id)) continue;
      pushInbox(state, 'club', 'inbox.youth.promoted', { club: club.name });
      pushNews(state, 'news.youth.promoted', { club: club.name }, 'medium');
    }
    for (const { clubIds } of outcome.relegated) {
      if (!clubIds.includes(club.id)) continue;
      pushInbox(state, 'club', 'inbox.youth.relegated', { club: club.name });
      pushNews(state, 'news.youth.relegated', { club: club.name }, 'medium');
    }
  }

  state.world.history.awards = state.world.history.awards ?? [];
  for (const winner of outcome.awards) {
    state.world.history.awards.push({
      season,
      award: winner.award,
      playerId: winner.playerId,
      playerName: winner.playerName,
      ...(winner.detail !== undefined ? { detail: winner.detail } : {}),
    });

    if (winner.playerId !== state.player.id) continue;
    state.awards = state.awards ?? [];
    state.awards.push({
      season,
      award: winner.award,
      competitionId: winner.competitionId,
      ...(winner.detail !== undefined ? { detail: winner.detail } : {}),
    });
    unlock(state, winner.award, winner.detail !== undefined ? { detail: winner.detail } : undefined);
    pushInbox(state, 'media', `inbox.award.${winner.award}`,
      winner.detail !== undefined ? { detail: winner.detail } : undefined);
    pushNews(state, `news.award.${winner.award}`, {
      player: `${state.player.firstName} ${state.player.lastName}`,
      ...(winner.detail !== undefined ? { detail: winner.detail } : {}),
    }, 'high');
    state.player.reputation = clamp(state.player.reputation + 3, 0, 100);
    state.player.fame = clamp(state.player.fame + 4, 0, 100);
  }
}

/**
 * Coming of age. At eighteen a player is out of the youth league whatever happens: his
 * club either takes him into the senior squad, or he has to find one that will play
 * him. Sitting in an academy at nineteen is not a career, it is a waiting room.
 */
function handleComingOfAge(state: CareerState, index: PackIndex, rng: Rng): void {
  const player = state.player;
  const ageNextSeason = state.world.season + 1 - player.birthYear;
  if (ageNextSeason < 18 || !isAcademyPlayer(state)) return;

  const club = userClub(state);
  const form = state.world.youth?.form ?? emptyYouthForm();
  const ovr = overall(player.attributes, player.primaryPos, player.secondaryPos);
  const kept = club
    ? deservesCallUp(rng, {
      form,
      age: ageNextSeason,
      ovr,
      clubLevel: clubBaseOvr(club),
      scoringRank: scoringRank(state),
      tablePosition: youthTablePosition(state),
    })
    : false;

  if (kept && club) {
    // The club has seen enough: he trains with the first team from July.
    player.squadRole = 'prospect';
    const senior = state.world.squads[club.id] ?? (state.world.squads[club.id] = []);
    if (!senior.includes(player.id)) senior.push(player.id);
    state.flags['calledUpToSeniors'] = true;
    signFirstProfessionalDeal(state, club, overall(player.attributes, player.primaryPos, player.secondaryPos) - clubBaseOvr(club));
    pushInbox(state, 'club', 'inbox.promotedToFirstTeam', { club: club.name });
    pushNews(state, 'news.promotedToFirstTeam', { player: `${player.firstName} ${player.lastName}`, club: club.name }, 'medium');
    unlock(state, 'promotedToFirstTeam', { club: club.name });
    return;
  }

  // Not wanted upstairs: clubs that will actually play him are put on the table.
  const offers = generateOffers({ state, index, rng, minutesPct: 0.05, maxOffers: 4 });
  if (offers.length > 0) {
    state.transferOffers = offers;
    openOfferDecision(state, offers);
    pushInbox(state, 'club', 'inbox.mustLeaveAcademy', { club: club?.name ?? '' });
  } else {
    // Nobody came: he stays another year, which is its own kind of answer.
    pushInbox(state, 'club', 'inbox.noOffersAtEighteen', { club: club?.name ?? '' });
    player.morale = clamp(player.morale - 8, 0, 100);
  }
}

function playSummerTournament(state: CareerState, index: PackIndex, rng: Rng): void {
  const player = state.player;
  const nt = state.nationalTeam;
  const season = state.world.season;
  const id = tournamentFor(season);
  if (!id) return;
  if (nt.level !== 'senior' || !nt.countryCode) return;

  const country = index.countryByCode.get(nt.countryCode);
  if (!country) return;

  // Qualifying is a season of matches, not a dice roll. A country that finished third in
  // its group is not at the tournament however good it looks on paper.
  const campaign = state.campaign;
  if (campaign && campaign.season === season) {
    state.player.fame = clamp(state.player.fame + campaignFame(campaign) * 0.4, 0, 100);
    state.campaignHistory = state.campaignHistory ?? [];
    state.campaignHistory.push(campaign);
    if (!qualified(campaign)) {
      pushInbox(state, 'national', `inbox.tournament.missed.${id}`, { country: country.name });
      pushNews(state, 'news.tournament.missed', { country: country.name }, 'medium');
      return;
    }
  } else {
    // A career that started mid-cycle has no campaign to read, so the old measure stands
    // for that one summer.
    const qualifyOdds = clamp(0.2 + (country.reputation - 55) / 70, 0.1, 0.95);
    if (!rng.chance(qualifyOdds)) {
      pushInbox(state, 'national', `inbox.tournament.missed.${id}`, { country: country.name });
      return;
    }
  }

  const result = playTournament(rng, id, player, country.code, country.reputation, season, minutesPct(state), index);
  state.tournaments = state.tournaments ?? [];
  state.tournaments.push(result);

  result.matches.forEach((match, matchIndex) => {
    if (!match.userPlayed) return;
    recordNationalAppearance(state, {
      id: `national.${id}.${season}.${match.stage}.${matchIndex}`,
      season,
      week: 52 + matchIndex,
      competitionId: `national.${id}`,
      homeClubId: country.code,
      awayClubId: match.opponent,
      homeGoals: match.goalsFor,
      awayGoals: match.goalsAgainst,
      detailLevel: 1,
      userClubId: country.code,
      importance: match.stage === 'final' ? 'cupFinal' : 'normal',
      userLine: {
        played: true,
        started: (match.userMinutes ?? 90) > 45,
        minutes: match.userMinutes ?? 90,
        position: player.primaryPos,
        goals: match.userGoals,
        assists: match.userAssists ?? 0,
        shots: 0,
        keyPasses: 0,
        tackles: 0,
        saves: 0,
        yellow: 0,
        red: 0,
        rating: match.userRating,
        motm: match.userRating >= 8.5,
      },
    });
  });

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
  const next: Record<string, string[]> = {
    ucl: [], uel: [], uecl: [], uclQual: [], uelQual: [], ueclQual: [],
  };

  for (const compState of Object.values(state.world.competitions)) {
    const competition = index.competitionById.get(compState.competitionId);
    if (!competition?.europeanSlots) continue;

    const order = sortedTable(compState).map((row) => row.clubId);
    const cup = Object.values(state.world.cups).find((c) => c.country === competition.country);
    const cupWinner = cup?.winner ?? null;
    const slots = competition.europeanSlots;

    let cursor = 0;
    const take = (count: number | undefined): string[] => {
      if (!count) return [];
      const picked = order.slice(cursor, cursor + count).filter(Boolean);
      cursor += count;
      return picked;
    };

    next.ucl!.push(...take(slots.ucl));
    next.uclQual!.push(...take(slots.uclQual));
    next.uel!.push(...take(slots.uel));
    next.uelQual!.push(...take(slots.uelQual));
    next.uecl!.push(...take(slots.uecl));
    next.ueclQual!.push(...take(slots.ueclQual));

    // The cup winner takes a Europa League place, or a qualifying place if the country
    // has none to give away.
    if (cupWinner && !Object.values(next).some((list) => list.includes(cupWinner))) {
      if (slots.uel) next.uel!.push(cupWinner);
      else if (slots.uelQual) next.uelQual!.push(cupWinner);
      else if (slots.ueclQual) next.ueclQual!.push(cupWinner);
    }
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
/**
 * What the window means for him. A signing at another club is a line in the paper; a
 * signing at his own, in his position and better than he is, is next season.
 */
function reportWindow(state: CareerState, index: PackIndex, moves: SquadMove[]): void {
  const player = state.player;
  const clubId = player.clubId;
  if (!clubId) return;
  const club = state.world.clubs[clubId];
  if (!club) return;

  const ovr = overall(player.attributes, player.primaryPos, player.secondaryPos);
  const mine = moves.filter((move) => move.clubId === clubId);

  // The biggest piece of business anywhere gets reported, wherever it happened.
  const headline = moves
    .filter((move) => move.direction === 'in' && move.fee > 0)
    .sort((a, b) => b.fee - a.fee)[0];
  if (headline) {
    const buyer = state.world.clubs[headline.clubId];
    pushNews(
      state,
      'news.windowHeadline',
      { player: headline.playerName, club: buyer?.name ?? '', fee: headline.fee },
      'medium',
    );
  }

  for (const move of mine) {
    if (move.direction === 'out') {
      pushInbox(state, 'club', 'inbox.teammateLeft', { player: move.playerName, club: club.name });
      continue;
    }

    // A rival for his shirt, or just a name on the teamsheet.
    const samePosition = move.position === player.primaryPos || player.secondaryPos.includes(move.position);
    if (samePosition && move.rating >= ovr) {
      pushInbox(state, 'club', 'inbox.rivalSigned', {
        player: move.playerName,
        pos: `position.${move.position}`,
        fee: move.fee,
      });
      pushNews(state, 'news.rivalSigned', { player: move.playerName, club: club.name }, 'high');
      // Somebody bought to play in his position is a career he will be compared with for
      // as long as they are at the same club, so the world starts keeping this one too.
      followPlayer(state, move.playerId);
      // He is not dropped by decree, but he is behind somebody now.
      state.managerTrust = clamp(state.managerTrust - 4, 0, 100);
    } else if (move.fee > 0) {
      pushInbox(state, 'club', 'inbox.clubSigned', { player: move.playerName, fee: move.fee });
    }
  }
}

function advanceModelledPlayers(state: CareerState, index: PackIndex, rng: Rng): void {
  const season = state.world.season;
  // Names already spoken for, so the summer's replacements are not the second Dor Tuito
  // in the same dressing room.
  const taken = namesInUse(state);
  for (const [clubId, ids] of Object.entries(state.world.squads)) {
    const club = state.world.clubs[clubId];
    if (!club) continue;
    const replacements: string[] = [];

    for (const id of ids) {
      const p = state.world.players[id];
      // He develops week by week like nobody else does, so the summer pass skips him -
      // but skipping him used to drop him off the list entirely, and by the second
      // season he was not in his own club's squad at all. Screens that ask the world who
      // plays for this club had to put him back by hand; the ones that forgot, and the
      // squad size checks, quietly had him missing.
      if (!p) continue;
      if (p.isUser) {
        replacements.push(id);
        continue;
      }
      const age = season - p.birthYear;

      if (age >= 34 && rng.chance((age - 33) * 0.28)) {
        // Retire and replace with a younger player at a similar level - except once in
        // a while, when a club that has no business producing one produces a player
        // far better than the level around him. Rare, and the reason scouts exist.
        if (isTracked(state, id)) p.retired = true;
        else delete state.world.players[id];
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
          taken,
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
      /*
       * Coming back is meeting a stranger.
       *
       * A loan return moves him between clubs without going through the signing that
       * would give him a manager, so the man who picks the side at his parent club was
       * being conjured silently the following week - and the trust he had built with the
       * manager he had just spent a season impressing came back with him, which is not
       * how walking into somebody else's dressing room works.
       */
      const homeManager = appointManager(rng, state, index, parent);
      pushInbox(state, 'manager', 'inbox.manager.backFromLoan', {
        manager: homeManager.name,
        club: parent.name,
      });
    }
    return;
  }

  const yearsLeft = contract.endSeason - season;
  if (yearsLeft > 0) return;

  const ovr = overall(player.attributes, player.primaryPos, player.secondaryPos);
  // Holding out for more is a real bet: the club is slower to offer, and pays more if
  // they still want him.
  const heldOut = Boolean(state.flags['holdingOut']);
  let intent = renewalIntent(rng, ovr, clubBaseOvr(club), season - player.birthYear, actualMinutes, state.managerTrust);
  if (heldOut && intent === 'extend' && rng.chance(0.35)) intent = 'release';
  state.flags['holdingOut'] = false;

  if (intent === 'extend') {
    /*
     * The club wants to keep him. Nobody used to ask him about it.
     *
     * A renewal was applied to the save and announced afterwards - the one contract in a
     * career the player could not negotiate was his own, while every offer from a rival
     * club came with a table and three ways to answer it. The terms are put to him now,
     * and pushing for more is a real bet: they can improve it, they can hold, and a club
     * that was lukewarm can decide it has better uses for the wage.
     */
    const raise = 1 + clamp(performanceScore, -0.2, 0.8);
    const offered = Math.round(contract.salaryPerWeek * raise * rng.range(1.05, 1.4) * (heldOut ? 1.35 : 1));
    openRenewalDecision(state, offered, rng.int(2, 4), actualMinutes);
  } else {
    state.contract = null;
    // Where he was, so the market still knows what level of player it is looking at
    // once he no longer has a club to be judged by.
    state.flags['lastClubLevel'] = clubBaseOvr(club);
    state.flags['lastLeagueReputation'] = index.competitionById.get(club.competitionId)?.reputation ?? 40;
    state.flags['lastTier'] = club.tier;
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
/**
 * The terms his own club has put on the table, and the three ways a player answers.
 *
 * The contract he has runs to the end of this season either way, so nothing is decided
 * by leaving it a week - but the club does not wait for ever, and a renewal nobody
 * answered is taken as a signature rather than as an insult.
 */
function openRenewalDecision(state: CareerState, salary: number, years: number, minutes: number): void {
  const club = userClub(state);
  if (!club || state.pendingDecisions.some((decision) => decision.eventId === 'contractRenewal')) return;
  const absoluteWeek = state.world.season * 52 + state.world.week;
  state.flags['renewalSalary'] = salary;
  state.flags['renewalYears'] = years;
  state.flags['renewalMinutes'] = Math.round(minutes * 100);
  const decisionId = `renewal_${state.world.season}`;
  state.pendingDecisions.push({
    id: decisionId,
    kind: 'event',
    eventId: 'contractRenewal',
    category: 'club',
    blocking: true,
    textKey: 'contract.renewal',
    textArgs: { club: club.name, salary, years },
    options: [
      { id: 'sign', labelKey: 'contract.renewal.sign', riskKey: 'risk.low', effects: [] },
      { id: 'pushForMore', labelKey: 'contract.renewal.pushForMore', riskKey: 'risk.medium', effects: [] },
      { id: 'runItDown', labelKey: 'contract.renewal.runItDown', riskKey: 'risk.high', effects: [] },
    ],
    expiresWeek: absoluteWeek + 4,
  });
  pushInbox(state, 'club', 'inbox.contractOffered', { club: club.name, salary, years }, decisionId);
}

/** Sign the terms currently on the table, whoever decided it: him, or the clock. */
function signRenewal(state: CareerState, salary: number, years: number): void {
  const contract = state.contract;
  if (!contract || salary <= 0) return;
  state.contract = {
    ...contract,
    salaryPerWeek: salary,
    startSeason: state.world.season + 1,
    endSeason: state.world.season + years,
    squadRole: state.player.squadRole,
  };
  state.flags['renewalSalary'] = 0;
  state.flags['renewalYears'] = 0;
  pushInbox(state, 'club', 'inbox.contractExtended', { club: userClub(state)?.name ?? '', comp: '' });
}

/** Being let go, from either end of the conversation. */
function releaseFromClub(state: CareerState, index: PackIndex, rng: Rng, reason: 'refused' | 'withdrawn'): void {
  const club = userClub(state);
  if (!club) return;
  state.flags['lastClubLevel'] = clubBaseOvr(club);
  state.flags['lastLeagueReputation'] = index.competitionById.get(club.competitionId)?.reputation ?? 40;
  state.flags['lastTier'] = club.tier;
  state.contract = null;
  state.player.clubId = null;
  state.player.squadRole = 'fringe';
  pushInbox(state, 'club', reason === 'refused' ? 'inbox.contractRefused' : 'inbox.contractWithdrawn', {
    club: club.name,
  });
  pushNews(state, 'news.released', { club: club.name }, 'high');
  state.transferOffers = generateOffers({ state, index, rng, minutesPct: 0.3, maxOffers: 5 });
}

/**
 * His answer to his own club.
 *
 * Signing is signing. Pushing for more is worth something when he has had a season worth
 * pushing on and the manager rates him, and it costs him the offer when he has not.
 * Running it down is the oldest play in football: he leaves in the summer for nothing,
 * and everything after that is somebody else's decision.
 */
export function answerContractRenewal(
  state: CareerState,
  index: PackIndex,
  decisionId: string,
  optionId: string,
): DecisionResult | null {
  const at = state.pendingDecisions.findIndex(
    (decision) => decision.id === decisionId && decision.eventId === 'contractRenewal',
  );
  if (at === -1) return null;
  state.pendingDecisions.splice(at, 1);

  const rng = mainRng(state);
  const changes: AppliedChange[] = [];
  const salary = Number(state.flags['renewalSalary'] ?? state.contract?.salaryPerWeek ?? 0);
  const years = Number(state.flags['renewalYears'] ?? 2);
  const minutes = Number(state.flags['renewalMinutes'] ?? 0) / 100;

  if (optionId === 'sign') {
    signRenewal(state, salary, years);
    commitRng(state, rng);
    return {
      changes: [{ key: 'change.contractSigned', delta: 1, before: 0, after: salary, tone: 'good' }],
      consequences: [],
      answerKey: 'contract.renewal.sign',
    };
  }

  if (optionId === 'runItDown') {
    adjustRelationship(state, 'board', -12, changes);
    adjustRelationship(state, 'fans', -6, changes);
    adjustRelationship(state, 'manager', -8, changes);
    releaseFromClub(state, index, rng, 'refused');
    const consequences = evaluateConsequences(rng, state);
    commitRng(state, rng);
    return { changes, consequences, answerKey: 'contract.renewal.runItDown' };
  }

  // Pushing for more. What he is worth to them is the case he has: games played, the
  // manager's opinion, and a name they would have to replace.
  const leverage = clamp(
    (minutes - 0.4) * 1.4 + (state.managerTrust - 50) / 60 + (state.player.reputation - 45) / 70,
    -1,
    1,
  );
  const roll = rng.next() + leverage * 0.35;
  if (roll > 0.72) {
    const improved = Math.round(salary * rng.range(1.15, 1.4));
    signRenewal(state, improved, Math.max(years, 3));
    adjustRelationship(state, 'board', -3, changes);
    changes.push({ key: 'change.money', delta: improved - salary, before: salary, after: improved, tone: 'good' });
    commitRng(state, rng);
    return { changes, consequences: [], answerKey: 'contract.renewal.pushForMore' };
  }
  if (roll < 0.18) {
    adjustRelationship(state, 'board', -8, changes);
    releaseFromClub(state, index, rng, 'withdrawn');
    const consequences = evaluateConsequences(rng, state);
    commitRng(state, rng);
    return { changes, consequences, answerKey: 'contract.renewal.pushForMore' };
  }
  // They held. The same terms, and a board that remembers being asked.
  signRenewal(state, salary, years);
  adjustRelationship(state, 'board', -5, changes);
  pushInbox(state, 'club', 'inbox.contractHeld', { club: userClub(state)?.name ?? '' });
  commitRng(state, rng);
  return { changes, consequences: [], answerKey: 'contract.renewal.pushForMore' };
}

function checkRetirement(state: CareerState, rng: Rng): void {
  const player = state.player;
  const age = state.world.season - player.birthYear;

  // He has already said it out loud, in an interview or to the club. Saying it is the
  // decision; the season just has to finish first.
  if (state.flags['wantsRetirement'] || state.flags['farewellSeason']) {
    retire(state);
    return;
  }
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
    blocking: true,
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

/**
 * Answering the one question the event engine cannot answer.
 *
 * Retiring applies no stat change, so `resolveDecision` had nothing to do with it and
 * the app store carried the logic instead: a headless run - a test, a probe, a scheduled
 * career - could put the question in front of him and had no way to answer it. It lives
 * here now, and the screen calls it like every other answer.
 */
export function answerRetirement(
  state: CareerState,
  decisionId: string,
  optionId: string,
): DecisionResult | null {
  const at = state.pendingDecisions.findIndex(
    (decision) => decision.id === decisionId && decision.eventId === 'retirement_choice',
  );
  if (at === -1) return null;
  state.pendingDecisions.splice(at, 1);

  if (optionId === 'retire') {
    retire(state);
    return {
      changes: [],
      consequences: [],
      answerKey: 'decision.retirement.retire',
    };
  }

  // One more season is a decision too: he has to mean it, and the club can see he does.
  const changes: AppliedChange[] = [];
  const before = state.player.personality.determination;
  state.player.personality.determination = clamp(before + 1.2, 1, 99);
  track(changes, 'change.personality.determination', before, state.player.personality.determination);
  const moraleBefore = state.player.morale;
  state.player.morale = clamp(moraleBefore + 4, 0, 100);
  track(changes, 'change.morale', moraleBefore, state.player.morale);
  pushInbox(state, 'club', 'inbox.playingOn', { age: state.world.season - state.player.birthYear });
  return { changes, consequences: [], answerKey: 'decision.retirement.continue' };
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
  // What he did about the day after the last day, while he still had a career to
  // organise it around.
  if (state.flags['coachingBadges']) {
    pushInbox(state, 'personal', 'inbox.retirementCoaching', {});
    unlock(state, 'coachingBadges');
  } else if (state.flags['noFallbackPlan']) {
    pushInbox(state, 'personal', 'inbox.retirementNoPlan', {});
  }

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
  /*
   * A career includes the season he is in the middle of.
   *
   * Seasons were only added up when they were filed away in May, so a boy in his first
   * year opened his own career page and read zero matches, zero goals, no rating - while
   * the match report from Saturday was two screens away. What he has done this season is
   * still what he has done.
   */
  const h = state.seasonHistory;
  const live = state.world.seasonStats[state.player.id];
  const running = live && !h.some((record) => record.season === live.season) ? live : undefined;
  const matches = h.reduce((s, r) => s + r.apps, 0) + (running?.apps ?? 0);
  const goals = h.reduce((s, r) => s + r.goals, 0) + (running?.goals ?? 0);
  const assists = h.reduce((s, r) => s + r.assists, 0) + (running?.assists ?? 0);
  const ratedApps = h.reduce((s, r) => s + r.ratedApps, 0) + (running?.ratedApps ?? 0);
  const ratingSum = h.reduce((s, r) => s + r.ratingSum, 0) + (running?.ratingSum ?? 0);
  const ovrNow = currentOvr(state);
  const peakOvr = Math.max(h.reduce((m, r) => Math.max(m, r.ovrEnd), 0), ovrNow);
  const peakValue = Math.max(h.reduce((m, r) => Math.max(m, r.valueEnd), 0), state.marketValue);
  const score = state.careerScore ?? computeCareerScore(state);

  return {
    seasons: h.length + (running ? 1 : 0),
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


/**
 * A whole career, competition by competition.
 *
 * Every season carries its own breakdown, and the current one is still being written, so
 * both go in. Camp friendlies are not in any of it: they never were on his record and
 * they should not be in the numbers he judges himself by.
 */
export function careerBreakdown(state: CareerState): Partial<Record<MatchCategory, CategoryTally>> {
  const out: Partial<Record<MatchCategory, CategoryTally>> = {};
  const seasons: (SeasonStats | undefined)[] = [
    ...state.seasonHistory,
    state.world.seasonStats[state.player.id],
  ];
  for (const season of seasons) {
    for (const [category, row] of Object.entries(season?.byCategory ?? {})) {
      if (category === 'friendly' || !row) continue;
      const into = out[category as MatchCategory]
        ?? (out[category as MatchCategory] = { apps: 0, goals: 0, assists: 0, minutes: 0, ratingSum: 0, ratedApps: 0 });
      into.apps += row.apps;
      into.goals += row.goals;
      into.assists += row.assists;
      into.minutes += row.minutes;
      into.ratingSum += row.ratingSum;
      into.ratedApps += row.ratedApps;
    }
  }
  return out;
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

/**
 * What the career was worth, on a scale that can tell two careers apart.
 *
 * The old one paid fifty-five points of a hundred for peak rating alone, flat, from the
 * first point: an ordinary professional who peaked at sixty-two banked thirty-four of
 * them before he had kicked a ball, and twelve careers out of twelve came out as "world
 * class" or better with seven of them "one of the greatest". A grade everybody gets is
 * not a grade.
 *
 * Ability is now paid on a curve that starts at the level of a first-team regular and
 * only reaches full marks at the very top, and the other five terms are capped low
 * enough that a long, decent, honest career lands where it belongs - a professional, or
 * a club legend - and a hundred has to be earned in every column at once.
 */
export function computeCareerScore(state: CareerState): number {
  const h = state.seasonHistory;
  const matches = h.reduce((s, r) => s + r.apps, 0);
  const goals = h.reduce((s, r) => s + r.goals, 0);
  const assists = h.reduce((s, r) => s + r.assists, 0);
  const peakOvr = h.reduce((m, r) => Math.max(m, r.ovrEnd), 0);
  const trophies = state.trophies.length;
  const caps = state.nationalTeam.caps;
  const awards = (state.awards ?? []).length;

  // 55 is a first-team footballer; 95 is the best player in the world.
  const ability = clamp((peakOvr - 55) / 40, 0, 1) ** 1.35;

  const score =
    46 * ability +
    Math.min(14, matches / 45) +
    Math.min(12, (goals + assists) / 30) +
    Math.min(14, trophies * 1.1) +
    Math.min(8, caps / 12) +
    Math.min(6, awards * 1.5 + state.player.fame / 30);

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
    if (decision.eventId === 'contractRenewal') {
      // The club took silence for agreement rather than tearing the offer up, which is
      // what a club does with a player it has just decided it wants to keep.
      signRenewal(state, Number(state.flags['renewalSalary'] ?? 0), Number(state.flags['renewalYears'] ?? 2));
    }
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
/**
 * The verdict of the club that has been looking at him.
 *
 * Returns true when it has put something in front of him that stops the week. A no is
 * not nothing - it goes in his mail, with the club's name on it, because being turned
 * down by a club he flew out to see is part of the career.
 */
function resolveWatchingVerdict(state: CareerState, index: PackIndex, rng: Rng): boolean {
  const clubId = String(state.flags['watchingClubId'] ?? '');
  const due = Number(state.flags['watchingVerdictWeek'] ?? 0);
  if (!clubId || due === 0) return false;
  if (state.world.season * 52 + state.world.week < due) return false;

  const club = state.world.clubs[clubId];
  const wasTrial = Boolean(state.flags['watchingWasTrial']);
  const impression = Number(state.flags['watchingImpression'] ?? 0);
  state.flags['watchingClubId'] = '';
  state.flags['watchingVerdictWeek'] = 0;
  state.flags['watchingImpression'] = 0;
  state.flags['watchingWasTrial'] = false;
  if (!club) return false;

  // A verdict cannot land on top of a move he is already being asked about.
  if (state.pendingDecisions.some((decision) => decision.kind === 'transfer')) return false;

  const share = isAcademyPlayer(state) ? youthMinutesPct(state) : recentMinutesShare(state);
  const offer = offerFromWatchingClub({ state, index, rng, club, minutesPct: share, impression });
  if (!offer) {
    pushInbox(state, 'transfer', wasTrial ? 'inbox.trialRejected' : 'inbox.scoutingNothing', {
      club: club.name,
    });
    return false;
  }

  state.transferOffers = [offer];
  pushInbox(
    state,
    'transfer',
    offer.isLoan ? 'inbox.watchedLoanOffer'
      : offer.joinAs === 'academy' ? 'inbox.watchedAcademyOffer'
      : 'inbox.watchedOffer',
    { club: club.name },
  );
  openOfferDecision(state, state.transferOffers);
  return true;
}

function openOfferDecision(state: CareerState, offers: TransferOffer[]): void {
  const absoluteWeek = state.world.season * 52 + state.world.week;
  const anyLoan = offers.some((o) => o.isLoan);
  const decision: PendingDecision = {
    id: `offer_${absoluteWeek}`,
    kind: 'transfer',
    blocking: true,
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
    blocking: true,
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
    // Migration guard for careers saved under the old ordering: after a signature no
    // unanswered rumour about that move remains valid.
    const staleRumours = new Set(
      state.pendingDecisions
        .filter((pending) => pending.eventId === 'milestone:transferRumour')
        .map((pending) => pending.id),
    );
    state.pendingDecisions = state.pendingDecisions.filter((pending) => !staleRumours.has(pending.id));
    state.inbox = state.inbox.filter((message) => !message.decisionId || !staleRumours.has(message.decisionId));
    acceptOffer(state, index, offer.id);
    changes.push({ key: 'change.newClub', delta: 1, before: 0, after: 0, tone: 'good' });
    const result: DecisionResult = {
      changes,
      consequences: [],
      narrativeKey: offer.isLoan ? 'decision.loanApproach.joined' : 'decision.transferApproach.joined',
    };
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
  return result;
}

/** Carry out one of the player's own moves: a conversation, a gesture, a request. */
export function doPlayerAction(state: CareerState, id: PlayerActionId): DecisionResult | null {
  const rng = mainRng(state);
  const result = performAction(rng, state, id);
  commitRng(state, rng);
  if (result.changes.length === 0 && result.consequences.length === 0) return null;
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
  // The club he is leaving, remembered by name: the fixture list will bring it back.
  if (previousClubId) state.flags['previousClubId'] = previousClubId;

  /*
   * Which door he walks in through.
   *
   * A boy can be signed by another club's academy or by its first team, and the two are
   * different careers. Signing him into an academy as a "rotation player" put a
   * fifteen year old in a senior squad he could not legally play in; the offer says
   * which side of the club wants him and the move follows it.
   */
  const joiningAcademy = offer.joinAs === 'academy';

  joinClub(state, index, offer.clubId, {
    salary: offer.salaryPerWeek,
    years: offer.years,
    role: joiningAcademy ? 'academy' : offer.squadRole,
    ...(joiningAcademy ? { asAcademy: true } : {}),
    ...(offer.signingBonus ? { signingBonus: offer.signingBonus } : {}),
    ...(offer.releaseClause ? { releaseClause: offer.releaseClause } : {}),
    ...(offer.isLoan ? { isLoan: true, parentClubId: previousClubId ?? undefined } : {}),
  });

  // The bonus is paid on the day he signs, which is the day a young player finally has
  // money of his own.
  if (offer.signingBonus) {
    state.finances.balance += offer.signingBonus;
    state.finances.careerEarnings += offer.signingBonus;
  }

  state.transferOffers = [];
  state.flags['transferRequested'] = false;
  state.player.morale = clamp(state.player.morale + 8, 0, 100);
  commitRng(state, rng);
  return true;
}

/**
 * Ask a club for better terms before signing. One ask at a time: they answer, the offer
 * on the table changes or it does not, and their patience is a little shorter than it was.
 * Push a lukewarm club too far and the offer is withdrawn - which is the risk that makes
 * asking mean anything.
 */
export function askForTerms(
  state: CareerState,
  index: PackIndex,
  offerId: string,
  ask: ContractAsk,
): NegotiationOutcome | null {
  const offer = state.transferOffers.find((entry) => entry.id === offerId);
  if (!offer) return null;
  const club = state.world.clubs[offer.clubId];
  if (!club) return null;

  const rng = mainRng(state);
  const outcome = negotiate(
    {
      rng,
      offer,
      agent: state.agent,
      ovr: overall(state.player.attributes, state.player.primaryPos, state.player.secondaryPos),
      clubLevel: clubBaseOvr(club),
      form: state.player.form,
      reputation: state.player.reputation,
      rivalOffers: Math.max(0, state.transferOffers.length - 1),
    },
    ask,
  );
  commitRng(state, rng);

  const replace = (list: TransferOffer[]) =>
    outcome.withdrawn
      ? list.filter((entry) => entry.id !== offerId)
      : list.map((entry) => (entry.id === offerId ? outcome.offer : entry));

  state.transferOffers = replace(state.transferOffers);
  for (const decision of state.pendingDecisions) {
    if (decision.offers) decision.offers = replace(decision.offers);
  }

  if (outcome.withdrawn) {
    pushInbox(state, 'transfer', 'inbox.termsWithdrawn', { club: club.name });
    // A decision with nothing left on the table is not a decision.
    state.pendingDecisions = state.pendingDecisions.filter(
      (decision) => decision.kind !== 'transfer' || (decision.offers?.length ?? 0) > 0,
    );
  }
  return outcome;
}

/** The old players who would take his call, given who he is and how known he is. */
export function mentorChoices(state: CareerState) {
  return availableMentors(state);
}

/**
 * Asking one of them to take an interest. He can change his mind later, but the bond
 * starts again from nothing when he does - these are relationships, not equipment slots.
 */
export function chooseMentor(state: CareerState, mentorId: string): boolean {
  const mentor = mentorById(mentorId);
  if (!mentor) return false;
  if (state.mentor?.id === mentorId) return true;

  state.mentor = { id: mentorId, bond: 12, lastTalkWeek: -99, talks: 0, followed: 0 };
  // Six different men agreeing to take an interest should not send the same message.
  // What he says yes with is the first thing the player learns about him.
  pushInbox(state, 'personal', `mentor.intro.${mentor.voice}`, { mentor: mentor.name });
  return true;
}

/**
 * The mentor getting in touch first.
 *
 * It arrives as a question in his inbox rather than as a sheet that stops his week -
 * nothing about it is urgent, and the point of it is that somebody thought to ask.
 */
function raiseMentorPrompt(state: CareerState, rng: Rng): void {
  const held = state.mentor;
  if (!held) return;
  if (state.pendingDecisions.some((decision) => decision.eventId.startsWith('mentorPrompt:'))) return;

  const mentor = mentorById(held.id);
  if (!mentor) return;

  const ratings = state.matchLog
    .filter((m) => m.season === state.world.season && m.userLine?.played)
    .slice(0, 3)
    .map((m) => m.userLine!.rating);
  const recentRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

  const id = mentorReachesOut(rng, state, {
    recentRating,
    minutesPct: minutesPct(state),
    rumoured: state.transferOffers.length > 0 || Boolean(state.flags['transferRequested']),
  });
  if (!id) return;

  const prompt = mentorPromptById(id);
  if (!prompt) return;

  const absolute = state.world.season * 52 + state.world.week;
  state.flags['mentorAskedWeek'] = absolute;
  const asked = String(state.flags['mentorAsked'] ?? '').split(',').filter(Boolean);
  if (!asked.includes(id)) asked.push(id);
  state.flags['mentorAsked'] = asked.join(',');

  const decisionId = `mentorPrompt_${id}_${state.world.season}_${state.world.week}`;
  state.pendingDecisions.push({
    id: decisionId,
    kind: 'event',
    eventId: `mentorPrompt:${id}`,
    category: 'personal',
    textKey: `mentorPrompt.${id}`,
    textArgs: { mentor: mentor.name },
    options: prompt.answers.map((answer) => ({
      id: answer.id,
      labelKey: `mentorPrompt.${id}.${answer.id}`,
      // These effects are a preview for the shared decision sheet. The mentor resolver
      // applies the same answer itself so bond can remain a mentor concept rather than
      // being forced into the generic event engine.
      effects: [
        { kind: 'custom' as const, key: answer.bond >= 0 ? 'mentorBondUp' : 'mentorBondDown', value: answer.bond },
        ...(answer.morale ? [{ kind: 'morale' as const, value: answer.morale }] : []),
        ...Object.entries(answer.personality ?? {}).map(([key, value]) => ({
          kind: 'personality' as const, key, value,
        })),
        ...Object.entries(answer.attributes ?? {}).map(([key, value]) => ({
          kind: 'attribute' as const, key, value,
        })),
      ],
    })),
    // He is not standing in the doorway. It waits in the inbox until the player opens it.
    blocking: false,
  });
  pushInbox(state, 'personal', `mentorPrompt.${id}`, { mentor: mentor.name }, decisionId);
}

/**
 * Answering him. Not a decision the event engine can resolve - it moves the relationship
 * and a little of the player's character, and it hands back what it moved.
 */
export function answerMentor(state: CareerState, decisionId: string, optionId: string): DecisionResult | null {
  const at = state.pendingDecisions.findIndex((decision) => decision.id === decisionId);
  if (at === -1) return null;
  const decision = state.pendingDecisions[at]!;
  const id = decision.eventId.replace('mentorPrompt:', '') as import('./mentor.js').MentorPromptId;
  const prompt = mentorPromptById(id);
  const answer = prompt?.answers.find((entry) => entry.id === optionId);
  if (!answer) return null;

  state.pendingDecisions.splice(at, 1);

  const changes: AppliedChange[] = [];
  const player = state.player;
  const before = {
    bond: state.mentor?.bond ?? 0,
    morale: player.morale,
    personality: { ...player.personality },
    attributes: { ...player.attributes },
  };

  answerMentorPrompt(state, answer);

  track(changes, 'change.mentorBond', before.bond, state.mentor?.bond ?? 0);
  track(changes, 'change.morale', before.morale, player.morale);
  for (const key of Object.keys(answer.personality ?? {})) {
    const trait = key as keyof typeof player.personality;
    track(changes, `change.personality.${trait}`, before.personality[trait], player.personality[trait]);
  }
  for (const key of Object.keys(answer.attributes ?? {})) {
    const attribute = key as keyof typeof player.attributes;
    track(changes, `change.attr.${attribute}`, before.attributes[attribute], player.attributes[attribute]);
  }

  const result: DecisionResult = {
    changes,
    consequences: [],
    answerKey: decision.options.find((entry) => entry.id === optionId)?.labelKey,
  };
  return result;
}

/** A conversation with him. Returns what he said, or null if it is too soon to ask again. */
export function askMentor(state: CareerState, topic: MentorTopic): MentorReply | null {
  const rng = mainRng(state);
  const reply = talkToMentor(rng, state, topic, minutesPct(state));
  commitRng(state, rng);
  return reply;
}

/** Doing what he suggested: the brief goes to the agent and he notices that it did. */
export function takeMentorAdvice(state: CareerState, reply: MentorReply): void {
  followAdvice(state, reply);
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


/**
 * The man he is actually competing with.
 *
 * Selection was decided by a score with nobody's name on it, so a player could lose his
 * place all season and never learn who to. The manager's list is not secret: everyone in
 * a dressing room knows exactly who is ahead of them and by how much. This is that man,
 * scored by the same formula the team sheet uses, so what the player is told is what the
 * engine actually does on Saturday.
 */
export interface ShirtRival {
  playerId: string;
  name: string;
  position: Position;
  ovr: number;
  /** His score minus the player's. Positive means the shirt is currently not his. */
  gap: number;
  ahead: boolean;
}

export function shirtRival(state: CareerState): ShirtRival | null {
  const club = userClub(state);
  if (!club || isAcademyPlayer(state)) return null;
  const player = state.player;
  const squad = userSquad(state).filter((mate) => mate.id !== player.id);
  if (squad.length === 0) return null;

  const ctx: SelectionContext = {
    formation: clubFormation(club),
    managerTrust: state.managerTrust,
    userId: player.id,
    rotationPressure: 0.3,
    importantMatch: false,
  };
  const slot = player.primaryPos;
  const mine = selectionScore(player, slot, ctx);

  let best: { mate: Player; score: number } | null = null;
  for (const mate of squad) {
    // Only men who could actually take this shirt: his own position, or one they play.
    const plays = mate.primaryPos === slot || mate.secondaryPos.includes(slot);
    if (!plays) continue;
    if (!isAvailable(mate)) continue;
    const score = selectionScore(mate, slot, ctx);
    if (!best || score > best.score) best = { mate, score };
  }
  if (!best) return null;

  return {
    playerId: best.mate.id,
    name: `${best.mate.firstName} ${best.mate.lastName}`,
    position: slot,
    ovr: ratingAt(best.mate.attributes, slot),
    gap: Math.round((best.score - mine) * 10) / 10,
    ahead: best.score > mine,
  };
}

/**
 * Everything he can find out about Saturday before Saturday.
 *
 * The report is only as good as what the world actually models - his own division man by
 * man, his age group man by man, and everybody else as a number - which is exactly how
 * scouting works when nobody at the club has seen the opposition.
 */
export interface MatchPreparation {
  /** The fixture the plan belongs to. */
  key: string;
  competitionId: string;
  opponentName: string;
  importance: MatchImportance;
  report: OpponentReport;
  /** Every job he could do, with how well it reads against this side. */
  options: { id: MatchPlanId; fit: number }[];
  /** What the staff would pick. */
  recommended: MatchPlanId;
  /** What he has picked, if he has. */
  chosen: MatchPlanId | null;
}

function opponentSquadFor(state: CareerState, opponentId: string, youth: boolean): Player[] {
  if (youth) return youthSquad(state, opponentId);
  return (state.world.squads[opponentId] ?? [])
    .map((id) => state.world.players[id])
    .filter((entry): entry is Player => Boolean(entry));
}

/** The shape he is likely to be picked in, so the report can name the man opposite him. */
function likelySlot(state: CareerState): Position {
  return state.player.primaryPos;
}

export function matchPreparation(state: CareerState, index: PackIndex): MatchPreparation | null {
  const club = userClub(state);
  if (!club || state.retired) return null;
  const match = scheduledUserMatchThisWeek(state, index);
  if (!match) return null;
  if (!availableForFixture(state, match)) return null;

  const opponentId = match.homeClubId === club.id ? match.awayClubId : match.homeClubId;
  const opponent = state.world.clubs[opponentId];
  if (!opponent) return null;

  const youth = match.source === 'youth';
  const age = state.world.season - state.player.birthYear;
  const squad = opponentSquadFor(state, opponentId, youth);
  const ownSquad = youth ? [...youthSquad(state, club.id), state.player] : userSquad(state);
  const rating = squad.length >= 6
    ? teamRatingFromSquad(squad)
    : youth ? youthClubRating(opponent, age) : clubRating(opponent);

  const slot = likelySlot(state);
  const report = readOpponent({
    club: opponent,
    squad,
    rating,
    ownRating: ownSquad.length > 0 ? teamRatingFromSquad(ownSquad) : clubRating(club),
    home: match.homeClubId === club.id,
    slot,
    formation: clubFormation(opponent),
  });

  const group = positionGroup(slot);
  const options = plansFor(group)
    .map((plan) => ({ id: plan.id, fit: planFit(plan, report) }))
    .sort((a, b) => b.fit - a.fit);
  const held = state.matchPlan?.key === match.key ? (state.matchPlan.plan as MatchPlanId) : null;

  return {
    key: match.key,
    competitionId: match.competitionId,
    opponentName: match.opponentName,
    importance: match.importance,
    report,
    options,
    recommended: recommendedPlan(group, report),
    chosen: held && MATCH_PLANS[held] ? held : null,
  };
}

/**
 * Deciding how he is going to play it. One plan per fixture: he can change his mind up
 * to kick-off, and it is gone the moment the match is over.
 */
export function setMatchPlan(state: CareerState, index: PackIndex, plan: MatchPlanId): boolean {
  const preparation = matchPreparation(state, index);
  if (!preparation) return false;
  if (!preparation.options.some((option) => option.id === plan)) return false;
  state.matchPlan = { key: preparation.key, plan };
  return true;
}

/**
 * The boys from his year, and where they got to. The one comparison a footballer cannot
 * help making, and until now the one the game could not show him.
 */
export function peers(state: CareerState) {
  return peerTable(state);
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
