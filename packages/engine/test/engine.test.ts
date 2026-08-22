import { describe, expect, it } from 'vitest';
import { Rng, clamp, interpolate } from '../src/rng.js';
import { FORMATIONS, overall, positionGroup, ratingAt, skillProfile, skillRating, tacticalFit } from '../src/positions.js';
import { createEuroCompetition, qualifiersFromLeaguePhase } from '../src/europe.js';
import { playTournament, tournamentFor } from '../src/tournament.js';
import { ageFactor, developWeek, headroom, updateCondition } from '../src/development.js';
import { availableActions, evaluateConsequences, isFrozenOut, performAction } from '../src/social.js';
import { isEligible } from '../src/events.js';
import { buildAttributes, generatePlayer } from '../src/generate.js';
import { CAMEO_MINUTES, eligibleForSenior, pickLineup, selectionScore } from '../src/selection.js';
import { applyResult, buildFixtures, ensureLeagueSplit, sortedTable, initCompetitionSeason } from '../src/league.js';
import { deserialize, serialize } from '../src/save.js';
import { YOUTH_MAX_AGE, countryLeagues, userYouthCompetition, userYouthCompetitionId, youthCompetitionId } from '../src/youth.js';
import { YOUTH_SQUAD_SIZE, generateYouthSquad, youthSquad } from '../src/youth-squads.js';
import { HALF_TIME_INSTRUCTIONS, instructionsFor, managerDemand, managerDictates } from '../src/halftime.js';
import { simulateUserMatch, type UserMatchContext } from '../src/match.js';
import { MILESTONES, applyMilestoneAnswer, milestoneById, milestoneCopyVariant } from '../src/milestones.js';
import {
  MENTORS,
  MENTOR_COOLDOWN_WEEKS,
  MENTOR_PROMPTS,
  mentorPromptById,
  mentorReachesOut,
  mentorTopics,
  talkToMentor,
} from '../src/mentor.js';
import type { MilestoneId } from '../src/milestones.js';
import { generateOffers, isTransferWindow, offerFromWatchingClub } from '../src/transfer.js';
import { clubBaseOvr } from '../src/generate.js';
import { indexPack, validatePack } from '../src/data.js';
import { initNationalTeam, levelForAge, updateNationalInterest } from '../src/national.js';
import { appointManager, sackingChance } from '../src/manager.js';
import { MATCH_PLANS, planEffect, planFit, type OpponentReport } from '../src/tactics.js';
import { TRACKED_LIMIT, TRACKED_PEERS, emptyCareer, recordSeason } from '../src/peers.js';
import {
  SCHEMA_VERSION,
  applyLiveInstruction,
  advanceWeek,
  answerContractRenewal,
  answerMedia,
  answerOffer,
  careerStatus,
  computeCareerScore,
  createCareer,
  matchPreparation,
  minutesPct,
  peers,
  recentMinutesShare,
  setMatchPlan,
  shirtRival,
  grudgeClubId,
  resumeHalfTime,
  currentOvr,
  doPlayerAction,
  getAcademyOffers,
  joinClub,
  acceptOffer,
  matchImportanceFor,
  mentalFactor,
  setTraining,
  userSquad,
} from '../src/career.js';
import { DEFAULT_INPUT, loadPack, playWeek, startedCareer } from './helpers.js';
import type { CompetitionSeasonState, MatchResult, Player, Position, TrainingPlan, TransferOffer } from '../src/types.js';

const TRAINING: TrainingPlan = { intensity: 'normal', focus: 'balanced', diet: 'normal' };

describe('rng', () => {
  it('is reproducible from a seed', () => {
    const a = new Rng(1234);
    const b = new Rng(1234);
    const drawsA = Array.from({ length: 50 }, () => a.next());
    const drawsB = Array.from({ length: 50 }, () => b.next());
    expect(drawsA).toEqual(drawsB);
  });

  it('produces different streams for different seeds', () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });

  it('restores from a saved state', () => {
    const rng = new Rng(99);
    rng.next();
    rng.next();
    const state = rng.getState();
    const expected = [rng.next(), rng.next(), rng.next()];
    const restored = Rng.fromState(state);
    expect([restored.next(), restored.next(), restored.next()]).toEqual(expected);
  });

  it('forks independent streams', () => {
    const parent = new Rng(7);
    const left = parent.fork('left');
    const right = parent.fork('right');
    expect(left.next()).not.toBe(right.next());
  });

  it('keeps weighted picks inside the collection and respects zero weights', () => {
    const rng = new Rng(5);
    const items = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) {
      const picked = rng.weighted(items, (item) => (item === 'c' ? 0 : 1));
      expect(picked).not.toBe('c');
      expect(items).toContain(picked);
    }
    expect(rng.weighted(items, () => 0)).toBeNull();
  });

  it('interpolates between breakpoints and clamps outside them', () => {
    const points = [[0, 0], [10, 10]] as const;
    expect(interpolate(points, 5)).toBeCloseTo(5);
    expect(interpolate(points, -3)).toBe(0);
    expect(interpolate(points, 99)).toBe(10);
  });
});

describe('ratings', () => {
  it('rates the same attributes differently by position', () => {
    const rng = new Rng(11);
    const attrs = buildAttributes(rng, 'ST', 80);
    expect(ratingAt(attrs, 'ST')).toBeGreaterThan(ratingAt(attrs, 'CB'));
  });

  it('hits the requested rating closely', () => {
    const rng = new Rng(3);
    for (const target of [35, 55, 75, 90]) {
      for (const pos of ['GK', 'CB', 'CM', 'ST'] as const) {
        const attrs = buildAttributes(rng, pos, target);
        expect(Math.abs(ratingAt(attrs, pos) - target)).toBeLessThanOrEqual(2);
      }
    }
  });

  it('uses the best of primary and secondary positions for OVR', () => {
    const rng = new Rng(21);
    const attrs = buildAttributes(rng, 'CAM', 70);
    const withSecondary = overall(attrs, 'CB', ['CAM']);
    expect(withSecondary).toBeGreaterThan(ratingAt(attrs, 'CB'));
  });

  it('scores tactical fit highest in the natural position', () => {
    const player = { primaryPos: 'CAM' as const, secondaryPos: ['CM' as const] };
    expect(tacticalFit(player, 'CAM')).toBe(1);
    expect(tacticalFit(player, 'CM')).toBeGreaterThan(tacticalFit(player, 'CB'));
    expect(tacticalFit(player, 'GK')).toBeLessThan(0.5);
  });
});

describe('development', () => {
  it('keeps an immutable week-one attribute baseline for season progress', () => {
    const { state } = startedCareer({ seed: 6001 });
    const opening = state.player.attributes.finishing;
    expect(state.seasonStartAttributes?.finishing).toBe(opening);

    state.player.attributes.finishing += 2;

    expect(state.seasonStartAttributes?.finishing).toBe(opening);
  });

  const makePlayer = (age: number, potential: number, ovrTarget: number): Player => {
    const pack = loadPack();
    const index = indexPack(pack);
    const rng = new Rng(42);
    const player = generatePlayer(rng, index, {
      clubId: null, pos: 'CM', age, targetOvr: ovrTarget, season: 2025, countryCode: 'ENG',
    });
    player.potential = potential;
    return player;
  };

  /**
   * A striker in a plain league match: ten teammates, an opponent of ordinary strength,
   * ninety minutes. Built from the pack rather than from a career so the test measures
   * the match engine and nothing else.
   */
  const strikerContext = (user: Player): UserMatchContext => {
    const pack = loadPack();
    const index = indexPack(pack);
    const rng = new Rng(5);
    const home = pack.clubs.find((entry) => entry.competitionId === 'en.1')!;
    const away = pack.clubs.find((entry) => entry.competitionId === 'en.1' && entry.id !== home.id)!;
    const teammates = ['GK', 'CB', 'CB', 'LB', 'RB', 'CM', 'CM', 'CAM', 'LW', 'RW'].map((pos) =>
      generatePlayer(rng, index, {
        clubId: home.id, pos: pos as Position, age: 26, targetOvr: 68, season: 2030, countryCode: 'ENG',
      }));
    const opponentStars = ['GK', 'CB', 'CB', 'LB', 'RB', 'CM', 'CM', 'CAM', 'ST'].map((pos) =>
      generatePlayer(rng, index, {
        clubId: away.id, pos: pos as Position, age: 26, targetOvr: 66, season: 2030, countryCode: 'ENG',
      }));
    const squad = [...teammates, user];
    return {
      season: 2030,
      week: 20,
      competitionId: 'en.1',
      homeClub: home,
      awayClub: away,
      userIsHome: true,
      userClubSquad: squad,
      opponentStars,
      opponentRating: 66,
      user,
      lineup: pickLineup(new Rng(11), squad, {
        formation: '4-3-3', managerTrust: 70, userId: user.id, rotationPressure: 0, importantMatch: false,
      }),
      minutes: { played: true, started: true, minutes: 90, slot: 'ST' },
      importance: 'normal',
      matchId: 'training_effect',
      mental: 1,
      penaltyTaker: false,
    };
  };

  /*
   * Training has to reach the scoreboard, not just the attribute screen.
   *
   * Both halves of that chain are asserted here: a season on finishing puts real points
   * on the attribute compared with a season spent elsewhere, and the striker those
   * points belong to converts more of his chances. Break either link and a training
   * plan becomes decoration.
   */
  it('turns a season of finishing work into goals', () => {
    const season = 2030;
    const trainFor = (focus: TrainingPlan['focus']): Player => {
      const player = generatePlayer(new Rng(42), indexPack(loadPack()), {
        clubId: null, pos: 'ST', age: 19, targetOvr: 62, season, countryCode: 'ENG',
      });
      player.potential = 88;
      const rng = new Rng(77);
      for (let week = 0; week < 52; week++) {
        developWeek(rng, player, season, {
          training: { intensity: 'normal', focus, diet: 'normal' },
          coachQuality: 55, facilities: 55, minutesPct: 0.6, competitiveLevel: 55, inSeason: true,
        });
      }
      return player;
    };

    const sharpshooter = trainFor('finishing');
    const defender = trainFor('defending');
    expect(sharpshooter.attributes.finishing).toBeGreaterThan(defender.attributes.finishing + 8);

    // The same striker, the same chances, one attribute apart: the finishing he was
    // trained on has to be worth goals.
    const goalsWith = (finishing: number): number => {
      const player = structuredClone(sharpshooter);
      player.attributes.finishing = finishing;
      const ctx = strikerContext(player);
      let goals = 0;
      for (let seed = 1; seed <= 300; seed++) goals += simulateUserMatch(new Rng(seed), ctx).line.goals;
      return goals;
    };

    const trained = goalsWith(sharpshooter.attributes.finishing);
    const untrained = goalsWith(defender.attributes.finishing);
    expect(trained).toBeGreaterThan(untrained);
  });

  it('improves a young player who plays regularly', () => {
    const player = makePlayer(18, 85, 55);
    const rng = new Rng(1);
    const before = currentOvrOf(player);
    for (let w = 0; w < 40; w++) {
      developWeek(rng, player, 2025, {
        training: TRAINING, coachQuality: 70, facilities: 70, minutesPct: 0.8, competitiveLevel: 60, inSeason: true,
      });
    }
    expect(currentOvrOf(player)).toBeGreaterThan(before);
  });

  it('develops a benched teenager far more slowly than a regular starter', () => {
    const starter = makePlayer(18, 85, 55);
    const benched = makePlayer(18, 85, 55);
    const rngA = new Rng(9);
    const rngB = new Rng(9);
    for (let w = 0; w < 40; w++) {
      developWeek(rngA, starter, 2025, {
        training: TRAINING, coachQuality: 70, facilities: 70, minutesPct: 0.9, competitiveLevel: 60, inSeason: true,
      });
      developWeek(rngB, benched, 2025, {
        training: TRAINING, coachQuality: 70, facilities: 70, minutesPct: 0.02, competitiveLevel: 60, inSeason: true,
      });
    }
    expect(currentOvrOf(starter)).toBeGreaterThan(currentOvrOf(benched));
  });

  it('never lets a player pass his potential', () => {
    const player = makePlayer(19, 62, 60);
    const rng = new Rng(4);
    for (let w = 0; w < 400; w++) {
      developWeek(rng, player, 2025, {
        training: { intensity: 'extreme', focus: 'balanced', diet: 'nutritionist' },
        coachQuality: 99, facilities: 99, minutesPct: 1, competitiveLevel: 95, inSeason: true,
      });
    }
    expect(currentOvrOf(player)).toBeLessThanOrEqual(player.potential);
  });

  it('declines an old player', () => {
    const player = makePlayer(35, 90, 80);
    const rng = new Rng(8);
    const before = currentOvrOf(player);
    for (let w = 0; w < 40; w++) {
      developWeek(rng, player, 2025, {
        training: TRAINING, coachQuality: 70, facilities: 70, minutesPct: 0.7, competitiveLevel: 60, inSeason: true,
      });
    }
    expect(currentOvrOf(player)).toBeLessThan(before);
  });

  it('peaks later for goalkeepers than outfielders', () => {
    expect(ageFactor(33, 'GK')).toBeGreaterThan(ageFactor(33, 'ST'));
  });

  it('has no headroom once potential is reached', () => {
    expect(headroom(80, 80)).toBe(0);
    expect(headroom(60, 90)).toBeGreaterThan(0);
  });
});

function currentOvrOf(player: Player): number {
  return overall(player.attributes, player.primaryPos, player.secondaryPos);
}

describe('selection', () => {
  it('prefers the better player for a slot', () => {
    const pack = loadPack();
    const index = indexPack(pack);
    const rng = new Rng(15);
    const good = generatePlayer(rng, index, { clubId: 'c', pos: 'CM', age: 25, targetOvr: 80, season: 2025, countryCode: 'ENG' });
    const poor = generatePlayer(rng, index, { clubId: 'c', pos: 'CM', age: 25, targetOvr: 55, season: 2025, countryCode: 'ENG' });
    good.form = poor.form;
    good.fitness = poor.fitness;
    good.morale = poor.morale;
    const ctx = { formation: '4-3-3', managerTrust: 50, userId: 'user', rotationPressure: 0, importantMatch: false };
    expect(selectionScore(good, 'CM', ctx)).toBeGreaterThan(selectionScore(poor, 'CM', ctx));
  });

  it('never plays a goalkeeper outfield or an outfielder in goal', () => {
    const { state } = startedCareer();
    const squad = userSquad(state);
    const lineup = pickLineup(new Rng(2), squad.length > 0 ? squad : [], {
      formation: '4-3-3', managerTrust: 50, userId: state.player.id, rotationPressure: 0, importantMatch: false,
    });
    for (const starter of lineup.starters) {
      const player = squad.find((p) => p.id === starter.playerId)!;
      if (starter.slot === 'GK') expect(player.primaryPos).toBe('GK');
      else expect(player.primaryPos).not.toBe('GK');
    }
  });

  it('excludes injured and suspended players', () => {
    const { state } = startedCareer();
    const squad = userSquad(state);
    const victim = squad.find((p) => p.primaryPos !== 'GK')!;
    victim.condition.injuries.push({
      id: 'x', type: 'hamstring', severity: 'moderate', weeksOut: 4, weeksRemaining: 4, season: 2025,
    });
    const lineup = pickLineup(new Rng(3), squad, {
      formation: '4-3-3', managerTrust: 50, userId: state.player.id, rotationPressure: 0, importantMatch: false,
    });
    expect(lineup.starters.some((s) => s.playerId === victim.id)).toBe(false);
    expect(lineup.bench).not.toContain(victim.id);
  });
});

describe('league', () => {
  it('builds a double round robin where everyone plays everyone home and away', () => {
    const rng = new Rng(6);
    const clubs = ['a', 'b', 'c', 'd', 'e', 'f'];
    const fixtures = buildFixtures(rng, clubs, 2);
    expect(fixtures).toHaveLength((clubs.length * (clubs.length - 1)));
    for (const club of clubs) {
      const games = fixtures.filter((f) => f.homeClubId === club || f.awayClubId === club);
      expect(games).toHaveLength((clubs.length - 1) * 2);
      const home = games.filter((f) => f.homeClubId === club).length;
      expect(home).toBe(clubs.length - 1);
    }
  });

  it('handles an odd number of clubs with byes', () => {
    const rng = new Rng(16);
    const clubs = ['a', 'b', 'c', 'd', 'e'];
    const fixtures = buildFixtures(rng, clubs, 2);
    for (const club of clubs) {
      const games = fixtures.filter((f) => f.homeClubId === club || f.awayClubId === club);
      expect(games).toHaveLength(8);
    }
  });

  it('keeps every fixture inside its competition calendar and outside break weeks', () => {
    const calendar = { firstWeek: 9, lastWeek: 47, breakWeeks: [20, 21, 32] };
    const fixtures = buildFixtures(new Rng(31), ['a', 'b', 'c', 'd', 'e', 'f'], 2, calendar);
    for (const fixture of fixtures) {
      expect(fixture.week).toBeGreaterThanOrEqual(calendar.firstWeek);
      expect(fixture.week).toBeLessThanOrEqual(calendar.lastWeek);
      expect(calendar.breakWeeks).not.toContain(fixture.week);
    }
  });

  it('applies a head-to-head tie-break before overall goal difference when configured', () => {
    const state: CompetitionSeasonState = {
      competitionId: 'test', season: 2026, clubIds: ['a', 'b'], currentRound: 2,
      table: {
        a: { clubId: 'a', played: 4, won: 3, drawn: 1, lost: 0, goalsFor: 5, goalsAgainst: 4, points: 10 },
        b: { clubId: 'b', played: 4, won: 3, drawn: 1, lost: 0, goalsFor: 12, goalsAgainst: 3, points: 10 },
      },
      fixtures: [
        { round: 1, week: 7, homeClubId: 'a', awayClubId: 'b', played: true, result: [1, 0] },
        { round: 2, week: 8, homeClubId: 'b', awayClubId: 'a', played: true, result: [0, 0] },
      ],
      scorers: {},
      leagueRules: { pointsForWin: 3, pointsForDraw: 1, tieBreakers: ['headToHead', 'goalDifference', 'id'] },
      finished: false,
    };
    expect(sortedTable(state).map((row) => row.clubId)).toEqual(['a', 'b']);
  });

  it('keeps the table arithmetic consistent', () => {
    const pack = loadPack();
    const competition = pack.competitions.find((c) => c.id === 'en.1')!;
    const clubIds = pack.clubs.filter((c) => c.competitionId === 'en.1').map((c) => c.id);
    const state = initCompetitionSeason(new Rng(1), competition, clubIds, 2025);
    const rng = new Rng(2);
    for (const fixture of state.fixtures) {
      const hg = rng.int(0, 4);
      const ag = rng.int(0, 4);
      applyResult(state, fixture.homeClubId, fixture.awayClubId, hg, ag);
    }
    const table = sortedTable(state);
    const totalPlayed = table.reduce((s, r) => s + r.played, 0);
    expect(totalPlayed).toBe(state.fixtures.length * 2);
    for (const row of table) {
      expect(row.points).toBe(row.won * 3 + row.drawn);
      expect(row.played).toBe(row.won + row.drawn + row.lost);
    }
    const goalsFor = table.reduce((s, r) => s + r.goalsFor, 0);
    const goalsAgainst = table.reduce((s, r) => s + r.goalsAgainst, 0);
    expect(goalsFor).toBe(goalsAgainst);
  });

  it('runs Ligat HaAl as 26 regular matches, a double top playoff and a single bottom playoff', () => {
    const pack = loadPack();
    const competition = pack.competitions.find((entry) => entry.id === 'il.1')!;
    const clubIds = pack.clubs.filter((club) => club.competitionId === competition.id).map((club) => club.id);
    const state = initCompetitionSeason(new Rng(71), competition, clubIds, 2026);

    expect(competition.split).toEqual({ regularRounds: 2, regularLastWeek: 34, upperTeams: 6, upperRounds: 2, lowerRounds: 1 });
    expect(state.fixtures).toHaveLength(14 * 13);
    expect(Math.max(...state.fixtures.map((fixture) => fixture.week))).toBeLessThanOrEqual(34);

    for (const fixture of state.fixtures) {
      fixture.played = true;
      fixture.result = [1, 0];
      applyResult(state, fixture.homeClubId, fixture.awayClubId, 1, 0);
    }
    expect(ensureLeagueSplit(new Rng(72), state, competition)).toBe(true);
    expect(state.splitGroups?.upper).toHaveLength(6);
    expect(state.splitGroups?.lower).toHaveLength(8);

    const upper = new Set(state.splitGroups!.upper);
    const lower = new Set(state.splitGroups!.lower);
    const playoff = state.fixtures.filter((fixture) => fixture.phase !== 'regular');
    // Top six meet twice more (5 rounds x 2), the lower eight meet once (7 rounds).
    expect(playoff).toHaveLength(6 * 5 + 8 * 7 / 2);
    expect(playoff.every((fixture) => (
      upper.has(fixture.homeClubId) && upper.has(fixture.awayClubId)
    ) || (
      lower.has(fixture.homeClubId) && lower.has(fixture.awayClubId)
    ))).toBe(true);

    for (const clubId of upper) {
      expect(state.fixtures.filter((fixture) => (
        fixture.homeClubId === clubId || fixture.awayClubId === clubId
      ))).toHaveLength(36);
    }
    for (const clubId of lower) {
      expect(state.fixtures.filter((fixture) => (
        fixture.homeClubId === clubId || fixture.awayClubId === clubId
      ))).toHaveLength(33);
    }

    // Group membership remains the primary ordering rule after the split.
    const firstLower = state.splitGroups!.lower[0]!;
    state.table[firstLower]!.points = 999;
    expect(sortedTable(state).slice(0, 6).every((row) => upper.has(row.clubId))).toBe(true);
  });

  it('splits the youth division the way its senior league splits', () => {
    const { state, index } = startedCareer({ seed: 21 });
    const season = state.world.season;
    // The last look at his division before the season rolls over and rebuilds it.
    let split = false;
    let playoffPlayed = 0;
    let playoffTotal = 0;
    let regularRounds = 0;
    let hisMatches = 0;

    for (let i = 0; i < 52 && state.world.season === season; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
      const division = userYouthCompetitionId(state);
      const comp = division ? state.world.youth?.competitions[division] : null;
      if (!comp || state.world.season !== season) continue;
      const playoff = comp.fixtures.filter((fixture) => fixture.phase && fixture.phase !== 'regular');
      split = Boolean(comp.splitGroups);
      playoffPlayed = playoff.filter((fixture) => fixture.played).length;
      playoffTotal = playoff.length;
      regularRounds = new Set(
        comp.fixtures.filter((fixture) => (fixture.phase ?? 'regular') === 'regular').map((f) => f.round),
      ).size;
      hisMatches = comp.table[state.player.clubId!]?.played ?? 0;
    }

    // His division belongs to a league that splits, so his season has to end in a
    // playoff and not stop dead when the regular rounds run out.
    expect(split).toBe(true);
    expect(playoffTotal).toBeGreaterThan(0);
    expect(playoffPlayed).toBe(playoffTotal);
    expect(hisMatches).toBeGreaterThan(regularRounds);
  });

  it('gives a season saved before the playoff its playoff, from the week he is in', () => {
    const pack = loadPack();
    const competition = pack.competitions.find((entry) => entry.id === 'il.1')!;
    const clubIds = pack.clubs.filter((club) => club.competitionId === competition.id).map((club) => club.id);
    const state = initCompetitionSeason(new Rng(91), competition, clubIds, 2026);

    // A save from before the split: no phase markers, rounds spread over the whole
    // calendar, and every one of them already played.
    for (const fixture of state.fixtures) {
      delete fixture.phase;
      fixture.played = true;
      fixture.result = [1, 1];
      applyResult(state, fixture.homeClubId, fixture.awayClubId, 1, 1);
    }

    const currentWeek = 42;
    expect(ensureLeagueSplit(new Rng(92), state, competition, currentWeek)).toBe(true);
    expect(state.splitGroups?.upper).toHaveLength(6);
    expect(state.splitGroups?.lower).toHaveLength(8);

    const playoff = state.fixtures.filter((fixture) => fixture.phase && fixture.phase !== 'regular');
    expect(playoff).toHaveLength(6 * 5 + 8 * 7 / 2);
    // Nothing is scheduled into a week that has already been played.
    for (const fixture of playoff) {
      expect(fixture.week).toBeGreaterThan(currentWeek);
      expect(fixture.week).toBeLessThan(52);
    }
    // The rounds he did play are the regular season now, not an unlabelled remnant.
    expect(state.fixtures.filter((fixture) => fixture.phase === 'regular')).toHaveLength(14 * 13);
  });

  it('runs Liga Leumit as 30 regular matches followed by two groups of eight', () => {
    const pack = loadPack();
    const competition = pack.competitions.find((entry) => entry.id === 'il.2')!;
    const clubIds = pack.clubs.filter((club) => club.competitionId === competition.id).map((club) => club.id);
    const state = initCompetitionSeason(new Rng(81), competition, clubIds, 2026);

    expect(clubIds).toHaveLength(16);
    expect(state.fixtures).toHaveLength(16 * 15);
    for (const fixture of state.fixtures) {
      fixture.played = true;
      fixture.result = [0, 0];
      applyResult(state, fixture.homeClubId, fixture.awayClubId, 0, 0);
    }
    expect(ensureLeagueSplit(new Rng(82), state, competition)).toBe(true);
    expect(state.splitGroups?.upper).toHaveLength(8);
    expect(state.splitGroups?.lower).toHaveLength(8);
    for (const clubId of clubIds) {
      expect(state.fixtures.filter((fixture) => (
        fixture.homeClubId === clubId || fixture.awayClubId === clubId
      ))).toHaveLength(37);
    }
  });
});

describe('data pack', () => {
  it('ships without validation errors', () => {
    const problems = validatePack(loadPack()).filter((p) => p.level === 'error');
    expect(problems).toEqual([]);
  });

  it('has a balanced pyramid: promotions match relegations between adjacent tiers', () => {
    const pack = loadPack();
    for (const comp of pack.competitions) {
      const downTo = comp.relegation?.to;
      if (!downTo) continue;
      const lower = pack.competitions.find((c) => c.id === downTo)!;
      expect(lower.promotion?.auto ?? 0).toBe(comp.relegation!.auto);
    }
  });
});

describe('save', () => {
  it('round trips a career', () => {
    const { state } = startedCareer();
    const restored = deserialize(serialize(state));
    expect(restored.careerSeed).toBe(state.careerSeed);
    expect(restored.player.lastName).toBe(state.player.lastName);
    expect(Object.keys(restored.world.clubs)).toHaveLength(Object.keys(state.world.clubs).length);
  });

  it('refuses a save from a newer schema instead of loading it half way', () => {
    const { state } = startedCareer();
    const envelope = JSON.parse(serialize(state));
    envelope.schemaVersion = 999;
    expect(() => deserialize(JSON.stringify(envelope))).toThrow(/newer version/);
  });

  it('removes an already-saved new-shirt interview after the debut was answered', () => {
    const { state } = startedCareer();
    const season = state.world.season;
    const decisionId = `milestone_firstAfterTransfer_${season}_${state.world.week}`;
    state.flags[`asked:debut:${season}`] = true;
    state.pendingDecisions.push({
      id: decisionId,
      kind: 'event',
      eventId: 'milestone:firstAfterTransfer',
      category: 'media',
      textKey: 'milestone.firstAfterTransfer',
      options: [],
      blocking: true,
    });
    state.inbox.unshift({
      id: 'duplicate_new_shirt', season, week: state.world.week, category: 'media',
      titleKey: 'milestone.firstAfterTransfer', read: false, decisionId,
    });

    const restored = deserialize(serialize(state));
    expect(restored.flags[`asked:firstAfterTransfer:${season}`]).toBe(true);
    expect(restored.pendingDecisions.some((decision) => decision.id === decisionId)).toBe(false);
    expect(restored.inbox.some((message) => message.id === 'duplicate_new_shirt')).toBe(false);
  });
});

describe('career', () => {
  it('starts the player at a believable youth rating with hidden potential', () => {
    const pack = loadPack();
    const { state } = createCareer(pack, DEFAULT_INPUT);
    expect(currentOvr(state)).toBeGreaterThanOrEqual(26);
    expect(currentOvr(state)).toBeLessThanOrEqual(40);
    expect(state.player.potential).toBeGreaterThan(currentOvr(state));
  });

  it('offers academies across a range of levels in the chosen country', () => {
    const pack = loadPack();
    const { state, index } = createCareer(pack, DEFAULT_INPUT);
    const offers = getAcademyOffers(state, index);
    expect(offers.length).toBeGreaterThanOrEqual(4);
    for (const offer of offers) {
      expect(state.world.clubs[offer.clubId]!.country).toBe('ISR');
    }
    const spread = Math.max(...offers.map((o) => o.reputation)) - Math.min(...offers.map((o) => o.reputation));
    expect(spread).toBeGreaterThan(10);
  });

  it('is deterministic: the same seed and the same actions give the same career', () => {
    const runOnce = () => {
      const { state, index } = startedCareer({ seed: 777 });
      for (let i = 0; i < 120; i++) {
        playWeek(state, index);
        state.pendingDecisions = [];
      }
      return state;
    };
    const a = runOnce();
    const b = runOnce();
    expect(currentOvr(a)).toBe(currentOvr(b));
    expect(a.world.seasonStats[a.player.id]).toEqual(b.world.seasonStats[b.player.id]);
    expect(a.player.attributes).toEqual(b.player.attributes);
  });

  it('promotes the player out of the academy and into senior football', () => {
    const { state, index } = startedCareer();
    let promoted = false;
    for (let i = 0; i < 52 * 5 && !promoted; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
      if (state.player.squadRole !== 'academy') promoted = true;
    }
    expect(promoted).toBe(true);
  });

  it('keeps the world sane over five seasons', () => {
    const { state, index } = startedCareer({ seed: 31337 });
    for (let i = 0; i < 52 * 5; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
    }

    expect(state.seasonHistory.length).toBeGreaterThanOrEqual(4);

    for (const record of state.seasonHistory) {
      expect(record.apps).toBeGreaterThanOrEqual(0);
      expect(record.starts + record.subApps).toBe(record.apps);
      expect(record.minutes).toBeLessThanOrEqual(record.apps * 90);
      expect(record.goals).toBeGreaterThanOrEqual(0);
      expect(record.age).toBeGreaterThan(14);
    }

    // Divisions must keep their size: no league quietly inflating over the years.
    for (const [id, comp] of Object.entries(state.world.competitions)) {
      const declared = index.competitionById.get(id)!.teams;
      expect(comp.clubIds.length).toBe(declared);
    }

    expect(currentOvr(state)).toBeLessThanOrEqual(state.player.potential);
    expect(state.player.fitness).toBeGreaterThanOrEqual(0);
    expect(state.player.morale).toBeLessThanOrEqual(100);
  });

  it('plays no more league matches than the fixture list allows', () => {
    const { state, index } = startedCareer({ seed: 2024 });
    for (let i = 0; i < 52 * 6; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
    }
    const maxRounds = Math.max(
      ...Object.values(state.world.competitions).map((c) => Math.max(...c.fixtures.map((f) => f.round))),
    );
    for (const record of state.seasonHistory) {
      // League fixtures plus a domestic cup run cannot exceed the rounds plus a full cup.
      expect(record.apps).toBeLessThanOrEqual(maxRounds + 10);
    }
  });

  it('applies competition specific card rules', () => {
    const pack = loadPack();
    const israel = pack.competitions.find((c) => c.id === 'il.1')!;
    const england = pack.competitions.find((c) => c.id === 'en.1')!;
    expect(israel.cards.yellowSuspensionThreshold).not.toBe(england.cards.yellowSuspensionThreshold);
  });
});


describe('training and state feed performance', () => {
  it('loses match sharpness on a light load and gains it on a heavy one', () => {
    const pack = loadPack();
    const index = indexPack(pack);
    const rng = new Rng(3);
    const make = () =>
      generatePlayer(rng, index, { clubId: null, pos: 'CM', age: 24, targetOvr: 70, season: 2025, countryCode: 'ENG' });

    const coasting = make();
    const working = make();
    coasting.condition.sharpness = 60;
    working.condition.sharpness = 60;

    for (let week = 0; week < 6; week++) {
      updateCondition(coasting, { intensity: 'light', focus: 'balanced', diet: 'normal' }, 0);
      updateCondition(working, { intensity: 'intensive', focus: 'balanced', diet: 'normal' }, 0);
    }

    expect(coasting.condition.sharpness).toBeLessThan(60);
    expect(working.condition.sharpness).toBeGreaterThan(coasting.condition.sharpness);
  });

  it('makes a heavy load more tiring than a light one', () => {
    const pack = loadPack();
    const index = indexPack(pack);
    const rng = new Rng(4);
    const easy = generatePlayer(rng, index, { clubId: null, pos: 'CM', age: 24, targetOvr: 70, season: 2025, countryCode: 'ENG' });
    const hard = generatePlayer(rng, index, { clubId: null, pos: 'CM', age: 24, targetOvr: 70, season: 2025, countryCode: 'ENG' });
    easy.condition.fatigue = 30;
    hard.condition.fatigue = 30;

    for (let week = 0; week < 4; week++) {
      updateCondition(easy, { intensity: 'light', focus: 'balanced', diet: 'normal' }, 90);
      updateCondition(hard, { intensity: 'extreme', focus: 'balanced', diet: 'normal' }, 90);
    }

    expect(hard.condition.fatigue).toBeGreaterThan(easy.condition.fatigue);
  });

  it('drops the player a level when his head, the crowd and the manager are against him', () => {
    const { state } = startedCareer();
    state.player.morale = 85;
    state.player.condition.sharpness = 85;
    state.player.condition.fatigue = 10;
    state.relationships = { manager: 75, teammates: 70, fans: 75, board: 60, media: 55 };
    const settled = mentalFactor(state);

    state.player.morale = 20;
    state.player.condition.sharpness = 25;
    state.player.condition.fatigue = 70;
    state.relationships = { manager: 18, teammates: 22, fans: 15, board: 25, media: 30 };
    const unsettled = mentalFactor(state);

    expect(settled).toBeGreaterThan(1);
    expect(unsettled).toBeLessThan(0.9);
    expect(settled - unsettled).toBeGreaterThan(0.15);
  });

  it('leaves a player out once the manager has fallen out with him', () => {
    const { state } = startedCareer();
    expect(isFrozenOut(state)).toBe(false);
    state.player.squadRole = 'starter';
    state.relationships.manager = 10;
    state.managerTrust = 10;
    const consequences = evaluateConsequences(new Rng(1), state);
    expect(consequences.some((c) => c.id === 'droppedFromSquad')).toBe(true);
    expect(isFrozenOut(state)).toBe(true);
  });

  it('puts a player nobody wants on the transfer list, and takes him off when he wins them back', () => {
    const { state } = startedCareer();
    state.player.squadRole = 'starter';
    state.relationships.manager = 20;
    state.relationships.board = 20;
    const rng = new Rng(9);
    let listed = false;
    for (let attempt = 0; attempt < 25 && !listed; attempt++) {
      const consequences = evaluateConsequences(rng, state);
      listed = consequences.some((c) => c.id === 'transferListed');
    }
    expect(listed).toBe(true);

    state.relationships.manager = 70;
    state.relationships.board = 70;
    const back = evaluateConsequences(rng, state);
    expect(back.some((c) => c.id === 'offTransferList')).toBe(true);
  });

  it('lets an apology repair a fallout', () => {
    const { state } = startedCareer();
    state.relationships.manager = 30;
    state.flags['incidentWithManager'] = true;
    const before = state.relationships.manager;
    const result = performAction(new Rng(2), state, 'apologiseManager');
    expect(result.changes.length).toBeGreaterThan(0);
    expect(state.relationships.manager).toBeGreaterThan(before);
  });

  it('spends the weekly budget of conversations', () => {
    const { state } = startedCareer();
    state.socialActions = { used: 0, perWeek: 2 };
    performAction(new Rng(5), state, 'quietWeek');
    expect(state.socialActions.used).toBe(1);
    expect(availableActions(state).length).toBeGreaterThan(0);
    // askManagerFeedback is one of the few that makes sense in any week.
    performAction(new Rng(6), state, 'askManagerFeedback');
    expect(state.socialActions.used).toBe(2);
    expect(availableActions(state)).toHaveLength(0);
  });

  it('only offers what a player would actually do this week', () => {
    const { state } = startedCareer();
    state.socialActions = { used: 0, perWeek: 4 };
    // Everyone is content and nothing has happened yet.
    state.relationships.manager = 60;
    state.relationships.fans = 60;
    state.relationships.teammates = 60;
    const ids = availableActions(state).map((a) => a.id);

    // Nothing to apologise for, no crowd to thank, and he is not asking to leave a
    // club he has just joined.
    expect(ids).not.toContain('apologiseManager');
    expect(ids).not.toContain('apologiseFans');
    expect(ids).not.toContain('thankFans');

    // An average relationship after an ordinary defeat is not a fallout. The player
    // should never be invited to apologise for a disagreement that did not happen.
    state.relationships.manager = 53;
    state.managerTrust = 53;
    state.lastMatch = {
      id: 'ordinary_loss', season: state.world.season, week: state.world.week,
      competitionId: 'test', homeClubId: state.player.clubId!, awayClubId: 'opponent',
      homeGoals: 0, awayGoals: 1, detailLevel: 1,
    };
    expect(availableActions(state).map((a) => a.id)).not.toContain('apologiseManager');

    // A low number on its own is a mood, not a reason: apologising to a dressing room
    // that has not fallen out with you is the sort of thing that made the screen read
    // like a list of buttons rather than a week in a life.
    state.relationships.teammates = 30;
    expect(availableActions(state).map((a) => a.id)).not.toContain('apologiseTeammates');

    // Something actually happening is what puts it on the table.
    state.flags['dressingRoomFallout'] = true;
    expect(availableActions(state).map((a) => a.id)).toContain('apologiseTeammates');
  });

  it('returns a people interaction immediately without saving it for after the next match', () => {
    const { state } = startedCareer();
    state.lastResult = null;
    const result = doPlayerAction(state, 'askManagerFeedback');

    expect(result).not.toBeNull();
    expect(result!.changes.length + result!.consequences.length).toBeGreaterThan(0);
    expect(state.lastResult).toBeNull();
  });

  it('benches sustained poor form and restores selection after recovery', () => {
    const { state } = startedCareer({ seed: 901 });
    state.player.squadRole = 'starter';
    state.player.form = 30;

    const dropped = evaluateConsequences(new Rng(1), state);
    expect(dropped.some((consequence) => consequence.id === 'benchedForForm')).toBe(true);
    expect(state.flags['formBenchNotified']).toBe(true);

    state.player.form = 52;
    const restored = evaluateConsequences(new Rng(2), state);
    expect(restored.some((consequence) => consequence.id === 'backInForm')).toBe(true);
    expect(state.flags['formBenchNotified']).toBe(false);
  });

  it('turns strong youth performances into a real senior-training request', () => {
    const { state } = startedCareer({ seed: 902 });
    state.player.squadRole = 'academy';
    state.player.birthYear = state.world.season - 17;
    expect(state.world.youth).toBeDefined();
    const youth = state.world.youth!;
    youth.form = {
      ...youth.form,
      apps: 5,
      minutes: 450,
      ratingSum: 37.5,
    };

    expect(availableActions(state).map((action) => action.id)).toContain('requestSeniorTraining');
    // Search deterministic outcomes so the test validates the accepted branch without
    // replacing the manager's real uncertainty with a guaranteed promotion.
    for (let seed = 1; seed <= 20 && !state.flags['calledUpToSeniors']; seed++) {
      state.socialActions.used = 0;
      state.actionCooldowns = state.actionCooldowns ?? {};
      state.actionCooldowns['requestSeniorTraining'] = -99;
      performAction(new Rng(seed), state, 'requestSeniorTraining');
    }
    expect(state.flags['calledUpToSeniors']).toBe(true);
    expect(state.world.squads[state.player.clubId!] ?? []).toContain(state.player.id);
  });
});

describe('clamp', () => {
  it('bounds values', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-5, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});

describe('ovr agrees with the headline ratings', () => {
  const positions: Position[] = ['GK', 'CB', 'RB', 'CDM', 'CM', 'CAM', 'RW', 'ST'];

  it('a player who is 50 at everything is a 50 everywhere', () => {
    const flat = buildAttributes(new Rng(7), 'CM', 50);
    for (const key of Object.keys(flat) as (keyof typeof flat)[]) flat[key] = 50;
    for (const pos of positions) {
      expect(ratingAt(flat, pos)).toBe(50);
    }
    for (const skill of skillProfile(flat, 'CM')) expect(skill.value).toBe(50);
  });

  it('ovr never sits outside the ratings the player is shown', () => {
    const rng = new Rng(99);
    for (let i = 0; i < 200; i++) {
      const pos = positions[rng.int(0, positions.length - 1)]!;
      const attributes = buildAttributes(rng, pos, rng.int(45, 88));
      const values = skillProfile(attributes, pos).map((s) => s.value);
      const ovr = ratingAt(attributes, pos);
      // The badge is a weighted read of the same numbers, so it cannot escape them.
      expect(ovr).toBeGreaterThanOrEqual(Math.min(...values) - 4);
      expect(ovr).toBeLessThanOrEqual(Math.max(...values) + 4);
    }
  });

  it('weights the ratings that matter for the position', () => {
    const attributes = buildAttributes(new Rng(3), 'ST', 70);
    const before = ratingAt(attributes, 'ST');
    const finishing = attributes.finishing;
    attributes.finishing = clamp(finishing + 10, 1, 99);
    const afterFinishing = ratingAt(attributes, 'ST');
    attributes.finishing = finishing;
    attributes.tackling = clamp(attributes.tackling + 10, 1, 99);
    const afterTackling = ratingAt(attributes, 'ST');
    expect(afterFinishing - before).toBeGreaterThan(afterTackling - before);
  });
});

describe('europe', () => {
  it('runs a full season and crowns three winners', () => {
    const { state, index } = startedCareer({ seed: 21 });
    for (let i = 0; i < 59; i++) playWeek(state, index);

    const winners = state.world.history.europeanWinners ?? [];
    const tiers = new Set(winners.map((w) => w.tier));
    expect(winners.length).toBeGreaterThanOrEqual(3);
    expect(tiers.has('ucl')).toBe(true);
    expect(tiers.has('uel')).toBe(true);
  });

  it('qualifies clubs from the league table, not at random', () => {
    const { state, index } = startedCareer({ seed: 22 });
    for (let i = 0; i < 59; i++) playWeek(state, index);

    const entrants: string[] = [];
    for (const competition of Object.values(state.world.europe ?? {})) {
      entrants.push(...Object.keys(competition.leaguePhase ?? {}));
      for (const group of competition.groups) entrants.push(...group.clubIds);
    }
    expect(entrants.length).toBeGreaterThan(20);

    // Nearly all of them are top-division clubs. Not all: a cup winner from the
    // division below takes a place too, which is how it works in real football.
    const topFlight = entrants.filter((id) => state.world.clubs[id]?.tier === 1).length;
    expect(topFlight / entrants.length).toBeGreaterThan(0.85);
    for (const id of entrants) expect(state.world.clubs[id]).toBeDefined();
  });

  it('draws a league phase where everybody plays eight, four home and four away', () => {
    const rng = new Rng(4);
    const clubIds = Array.from({ length: 36 }, (_, i) => `club${i}`);
    const competition = createEuroCompetition(rng, 'ucl', clubIds, 2025, (id) => 90 - Number(id.slice(4)))!;

    expect(Object.keys(competition.leaguePhase ?? {})).toHaveLength(36);
    expect(competition.groups).toHaveLength(0);

    for (const clubId of clubIds) {
      const home = competition.fixtures.filter((f) => f.homeClubId === clubId);
      const away = competition.fixtures.filter((f) => f.awayClubId === clubId);
      expect(home).toHaveLength(4);
      expect(away).toHaveLength(4);

      // Eight different opponents: nobody is played twice.
      const opponents = new Set([...home.map((f) => f.awayClubId), ...away.map((f) => f.homeClubId)]);
      expect(opponents.size).toBe(8);
      expect(opponents.has(clubId)).toBe(false);

      // And one match a week, over the eight matchdays.
      const weeks = new Set([...home, ...away].map((f) => f.week));
      expect(weeks.size).toBe(8);
    }
  });

  it('sends the top eight straight through and puts 9th to 24th in a play-off', () => {
    const rng = new Rng(9);
    const clubIds = Array.from({ length: 36 }, (_, i) => `club${i}`);
    const competition = createEuroCompetition(rng, 'ucl', clubIds, 2025)!;

    // Hand out points so the table is decided rather than a pile of ties.
    clubIds.forEach((clubId, i) => {
      const row = competition.leaguePhase![clubId]!;
      row.points = 36 - i;
      row.goalsFor = 36 - i;
    });

    const { direct, playoff } = qualifiersFromLeaguePhase(competition);
    expect(direct).toEqual(clubIds.slice(0, 8));
    expect(playoff).toHaveLength(16);
    // Ninth is seeded against twenty-fourth.
    expect(playoff[0]).toBe('club8');
    expect(playoff[1]).toBe('club23');
    // And nobody from the bottom twelve is anywhere near it.
    for (const clubId of clubIds.slice(24)) expect(playoff).not.toContain(clubId);
  });
});

describe('pre-season camp', () => {
  it('shows an academy signing all six youth-team camp friendlies', () => {
    const { state, index } = createCareer(loadPack(), { ...DEFAULT_INPUT, age: 16, seed: 6059 });
    const clubId = getAcademyOffers(state, index)[0]!.clubId;
    joinClub(state, index, clubId, { asAcademy: true });

    expect(state.flags[`trainingCamp:${state.world.season}`]).toBe(true);
    const opponents = new Set<string>();
    for (let week = 1; week <= 3; week++) {
      for (const slot of ['a', 'b']) {
        const opponent = String(state.flags[`campOpponent:${state.world.season}:${week}:${slot}`] ?? '');
        expect(opponent).toBeTruthy();
        opponents.add(opponent);
      }
      playWeek(state, index);
    }

    // Six different sides: a camp does not play the same club twice in a fortnight.
    expect(opponents.size).toBe(6);
    const camp = state.matchLog.filter((match) => match.competitionId === 'friendly.youth');
    expect(camp).toHaveLength(6);
    expect(camp.every((match) => match.userLine?.played)).toBe(true);
    expect(state.flags[`campVerdict:${state.world.season}`]).toBeTruthy();
    const feedback = state.inbox.find((message) => message.titleKey === 'inbox.trainingCampFeedback.1');
    expect(feedback?.action).toEqual({
      type: 'setTrainingFocus',
      focus: state.flags[`campRecommendedFocus:${state.world.season}`],
      intensity: state.flags[`campRecommendedIntensity:${state.world.season}`],
    });
  });

  it('asks for a load as well as a focus, and reads the body before the gap', () => {
    const { state, index } = createCareer(loadPack(), { ...DEFAULT_INPUT, age: 16, seed: 6063 });
    const clubId = getAcademyOffers(state, index)[0]!.clubId;
    joinClub(state, index, clubId, { asAcademy: true });

    const season = state.world.season;
    const intensity = String(state.flags[`campRecommendedIntensity:${season}`] ?? '');
    expect(['light', 'normal', 'intensive', 'extreme']).toContain(intensity);

    playWeek(state, index);
    const review = state.inbox.find((message) => message.titleKey === 'inbox.trainingCampFeedback.1');
    expect(review?.action?.intensity).toBe(state.flags[`campRecommendedIntensity:${season}`]);
    expect(review?.args?.intensity).toBe(`train.intensity.${state.flags[`campRecommendedIntensity:${season}`]}`);

    // A body that cannot take a hard block sets the ceiling whatever the gap looks like:
    // an injured player is told to go light, not to chase his weakest attribute.
    state.player.condition.injuries.push({
      id: 'inj_test', type: 'hamstring', severity: 'moderate', weeksOut: 4, weeksRemaining: 4, season,
    });
    state.flags[`campRecommendedIntensity:${season}`] = 'intensive';
    playWeek(state, index);
    expect(state.flags[`campRecommendedIntensity:${season}`]).toBe('light');
  });

  it('only counts the camp plan as followed when the load matches too', () => {
    const { state, index } = createCareer(loadPack(), { ...DEFAULT_INPUT, age: 16, seed: 6065 });
    const clubId = getAcademyOffers(state, index)[0]!.clubId;
    joinClub(state, index, clubId, { asAcademy: true });

    const season = state.world.season;
    const focus = state.flags[`campRecommendedFocus:${season}`] as TrainingPlan['focus'];
    const asked = state.flags[`campRecommendedIntensity:${season}`] as TrainingPlan['intensity'];
    const wrong = asked === 'light' ? 'intensive' : 'light';

    setTraining(state, { focus, intensity: wrong });
    playWeek(state, index);
    expect(state.flags[`campFollowedCoach:${season}:1`]).toBeUndefined();

    setTraining(state, { focus, intensity: asked });
    playWeek(state, index);
    expect(state.flags[`campFollowedCoach:${season}:2`]).toBe(true);
  });

  it('reviews the camp once a week and delivers one verdict', () => {
    const { state, index } = createCareer(loadPack(), { ...DEFAULT_INPUT, age: 16, seed: 6061 });
    const clubId = getAcademyOffers(state, index)[0]!.clubId;
    joinClub(state, index, clubId, { asAcademy: true });

    for (let week = 1; week <= 3; week++) playWeek(state, index);

    for (const week of [1, 2, 3]) {
      const reviews = state.inbox.filter(
        (message) => message.titleKey === `inbox.trainingCampFeedback.${week}`,
      );
      expect(reviews).toHaveLength(1);
    }
    expect(state.inbox.filter((message) => message.titleKey === 'inbox.trainingCampReport')).toHaveLength(1);
  });

  it('stops the week on a match he played even when a story is waiting', () => {
    const { state, index } = createCareer(loadPack(), { ...DEFAULT_INPUT, age: 16, seed: 6062 });
    const clubId = getAcademyOffers(state, index)[0]!.clubId;
    joinClub(state, index, clubId, { asAcademy: true });

    // Camp weeks are event-heavy, so at least one of them holds both a friendly he
    // played and a story raised after it. The match is what the week stops for; the
    // story waits behind the final whistle.
    let sawBoth = false;
    for (let attempt = 0; attempt < 30 && !sawBoth; attempt++) {
      const before = state.matchLog.length;
      const result = playWeek(state, index);
      const played = state.matchLog.length > before && state.matchLog[0]?.userLine?.played;
      const queued = state.pendingDecisions.some((decision) => decision.blocking !== false);
      if (played && queued) {
        sawBoth = true;
        expect(result.stopped).toBe('match');
      }
      state.pendingDecisions = [];
    }

    expect(sawBoth).toBe(true);
  });

  it('does not call a competitive youth appearance a senior debut', () => {
    const { state, index } = createCareer(loadPack(), { ...DEFAULT_INPUT, age: 16, seed: 6064 });
    const clubId = getAcademyOffers(state, index)[0]!.clubId;
    joinClub(state, index, clubId, { asAcademy: true });

    let youthAppearance: MatchResult | undefined;
    for (let attempt = 0; attempt < 16 && !youthAppearance; attempt++) {
      state.pendingDecisions = [];
      playWeek(state, index);
      youthAppearance = state.matchLog.find(
        (match) => match.competitionId.endsWith('.youth')
          && !match.competitionId.startsWith('friendly')
          && match.userLine?.played,
      );
    }

    expect(youthAppearance).toBeDefined();
    expect(youthAppearance!.importance).not.toBe('firstProMatch');
    expect(state.pendingDecisions.some((decision) => decision.eventId === 'milestone:debut')).toBe(false);
    expect(state.achievements.some(
      (achievement) => achievement.id === 'firstProMatch' || achievement.id === 'debut',
    )).toBe(false);
    expect(state.flags['calledUpToSeniors']).not.toBe(true);
  });

  it('evaluates a new senior in six friendlies before competitive football', () => {
    const { state, index } = createCareer(loadPack(), { ...DEFAULT_INPUT, age: 19, seed: 6060 });
    const clubId = getAcademyOffers(state, index)[0]!.clubId;
    joinClub(state, index, clubId, { role: 'rotation' });
    const trustBefore = state.managerTrust;

    for (let week = 1; week <= 3; week++) playWeek(state, index);

    const camp = state.matchLog.filter((match) => match.competitionId === 'friendly');
    expect(camp).toHaveLength(6);
    // Two a week: a midweek match and a weekend one, in each of the three camp weeks.
    for (const week of [1, 2, 3]) {
      expect(camp.filter((match) => match.week === week)).toHaveLength(2);
    }
    expect(camp.every((match) => match.userLine !== undefined)).toBe(true);
    // A fit player gets an audition; an actual camp injury is still allowed to rule
    // him out rather than being silently ignored for the sake of the schedule.
    expect(camp.some((match) => match.userLine?.played)).toBe(true);
    expect(camp.every((match) => match.importance === 'friendly')).toBe(true);
    expect(state.managerTrust).not.toBe(trustBefore);
    expect(Object.values(state.world.competitions).every(
      (competition) => Object.values(competition.table).every((row) => row.played === 0),
    )).toBe(true);
    expect(Object.values(state.world.europe ?? {}).every(
      (competition) => (competition.qualifying?.ties ?? []).every((tie) => !tie.played),
    )).toBe(true);
    expect(state.world.week).toBe(4);
  });

  it('keeps domestic league fixtures closed until week seven', () => {
    const { state, index } = createCareer(loadPack(), { ...DEFAULT_INPUT, age: 19, seed: 6061 });
    const clubId = getAcademyOffers(state, index)[0]!.clubId;
    joinClub(state, index, clubId, { role: 'rotation' });
    const league = state.world.competitions[state.world.clubs[clubId]!.competitionId]!;

    for (let week = 1; week <= 6; week++) playWeek(state, index);
    expect(league.table[clubId]!.played).toBe(0);
    // Week seven can first stop on a fixture-bound media/coach question. Answering it
    // (represented here by clearing the test queue) must then play that same fixture.
    for (let attempt = 0; attempt < 5 && league.table[clubId]!.played === 0; attempt++) {
      playWeek(state, index);
      state.pendingDecisions = [];
    }
    expect(league.table[clubId]!.played).toBeGreaterThan(0);
  });
});

describe('pre-match chronology', () => {
  function seniorCareer(seed: number) {
    const { state, index } = createCareer(loadPack(), { ...DEFAULT_INPUT, age: 19, seed });
    const clubId = getAcademyOffers(state, index)[0]!.clubId;
    joinClub(state, index, clubId, { role: 'rotation' });
    state.pendingDecisions = [];
    return { state, index, clubId };
  }

  it('asks about a domestic cup final before the tie is played', () => {
    const { state, index, clubId } = seniorCareer(8101);
    state.world.week = 44;
    const club = state.world.clubs[clubId]!;
    const opponent = Object.values(state.world.clubs).find(
      (candidate) => candidate.country === club.country && candidate.id !== clubId,
    )!;
    const tie = {
      round: 1, week: state.world.week, homeClubId: clubId, awayClubId: opponent.id, played: false,
    };
    state.world.cups = {
      test_cup: {
        id: 'test_cup', country: club.country, season: state.world.season,
        ties: [tie], alive: [], round: 1, finished: false,
      },
    };

    const beforeWeek = state.world.week;
    const result = advanceWeek(state, index);
    expect(result.stopped).toBe('decision');
    expect(state.world.week).toBe(beforeWeek);
    expect(tie.played).toBe(false);
    const interview = state.pendingDecisions.find((decision) => decision.eventId === 'milestone:bigMatch');
    expect(interview).toBeDefined();
    expect(state.inbox.some((message) => message.decisionId === interview!.id)).toBe(true);
    expect(state.inbox.some((message) => message.titleKey === 'inbox.buildUp.cupFinal')).toBe(false);
  });

  it('asks about a European night before the European fixture is played', () => {
    const { state, index, clubId } = seniorCareer(8102);
    state.world.week = 19;
    state.world.cups = {};
    if (state.world.youth) state.world.youth.cups = {};
    for (const competition of Object.values(state.world.competitions)) {
      for (const scheduled of competition.fixtures) scheduled.played = true;
    }
    const club = state.world.clubs[clubId]!;
    const opponent = Object.values(state.world.clubs).find((candidate) => candidate.id !== clubId)!;
    const fixture = {
      round: 1, week: state.world.week, homeClubId: clubId, awayClubId: opponent.id, played: false,
    };
    state.world.europe = {
      ucl: {
        id: 'ucl', season: state.world.season, groups: [], fixtures: [fixture], ties: [],
        stage: 'group', alive: [club.id, opponent.id],
      },
    };

    const beforeWeek = state.world.week;
    const result = advanceWeek(state, index);
    expect(result.stopped).toBe('decision');
    expect(state.world.week).toBe(beforeWeek);
    expect(fixture.played).toBe(false);
    const interview = state.pendingDecisions.find((decision) => decision.eventId === 'milestone:bigMatch');
    expect(interview).toBeDefined();
    expect(state.inbox.some((message) => message.decisionId === interview!.id)).toBe(true);
    expect(state.inbox.some((message) => message.titleKey === 'inbox.buildUp.europeanNight')).toBe(false);
  });

  it('does not ask an academy player about the senior side big match', () => {
    const { state, index } = createCareer(loadPack(), { ...DEFAULT_INPUT, age: 16, seed: 8103 });
    const clubId = getAcademyOffers(state, index)[0]!.clubId;
    joinClub(state, index, clubId, { asAcademy: true });
    state.pendingDecisions = [];
    state.inbox = [];
    state.world.week = 44;
    const club = state.world.clubs[clubId]!;
    const opponent = Object.values(state.world.clubs).find(
      (candidate) => candidate.country === club.country && candidate.id !== clubId,
    )!;
    state.world.cups = {
      academy_irrelevant_cup: {
        id: 'academy_irrelevant_cup', country: club.country, season: state.world.season,
        ties: [{
          round: 1, week: state.world.week, homeClubId: clubId,
          awayClubId: opponent.id, played: false,
        }],
        alive: [], round: 1, finished: false,
      },
    };

    advanceWeek(state, index);

    expect(state.pendingDecisions.some((decision) => decision.eventId === 'milestone:bigMatch')).toBe(false);
    expect(state.inbox.some((message) => message.titleKey === 'inbox.buildUp.cupFinal')).toBe(false);
  });

  it('announces a youth derby before the academy fixture is played', () => {
    const { state, index } = createCareer(loadPack(), { ...DEFAULT_INPUT, age: 16, seed: 8104 });
    const clubId = getAcademyOffers(state, index)[0]!.clubId;
    joinClub(state, index, clubId, { asAcademy: true });
    state.pendingDecisions = [];
    state.inbox = [];
    state.world.week = 12;

    const club = state.world.clubs[clubId]!;
    const youthCompetition = userYouthCompetition(state)!;
    const derby = youthCompetition.fixtures.find(
      (fixture) => fixture.homeClubId === clubId || fixture.awayClubId === clubId,
    )!;
    const opponentId = derby.homeClubId === clubId ? derby.awayClubId : derby.homeClubId;
    club.rivals = Array.from(new Set([...(club.rivals ?? []), opponentId]));
    state.world.clubs[opponentId]!.city = club.city ?? 'Test Derby City';
    club.city = state.world.clubs[opponentId]!.city;
    for (const fixture of youthCompetition.fixtures) fixture.played = fixture !== derby;
    derby.week = state.world.week;
    derby.played = false;

    const result = advanceWeek(state, index);
    expect(result.stopped).toBe('decision');
    expect(derby.played).toBe(false);
    const interview = state.pendingDecisions.find((decision) => decision.eventId === 'milestone:derby');
    expect(interview).toBeDefined();
    expect(state.inbox.some((message) => message.decisionId === interview!.id)).toBe(true);
    expect(state.inbox.some((message) => message.titleKey === 'inbox.buildUp.youth.derby')).toBe(false);
    const copySuffix = interview!.textKey.endsWith('.v2')
      ? '.v2'
      : interview!.textKey.endsWith('.v3') ? '.v3' : '';
    expect(interview!.options.every((option) => option.labelKey.endsWith(copySuffix))).toBe(true);
    expect(new Set(interview!.options.map((option) => (
      copySuffix ? option.labelKey.replace(copySuffix, '') : option.labelKey
    )))).toEqual(new Set([
      'milestone.derby.respect', 'milestone.derby.fire', 'milestone.derby.deflect',
    ]));
  });
});

describe('awards', () => {
  it('hands out the honours every season and names a winner', () => {
    const { state, index } = startedCareer({ seed: 23 });
    for (let i = 0; i < 53 * 2; i++) playWeek(state, index);

    const awards = state.world.history.awards ?? [];
    expect(awards.length).toBeGreaterThan(6);
    for (const award of awards) {
      expect(award.playerName ?? '').not.toBe('');
    }
    // The Ballon d'Or is contested by the whole of football, not one division.
    const ballon = awards.filter((a) => a.award === 'ballonDOr');
    expect(ballon.length).toBeGreaterThanOrEqual(2);
  });
});

describe('summer tournaments', () => {
  it('runs a World Cup in the right years and a Euro between them', () => {
    expect(tournamentFor(2025)).toBe('worldCup');   // summer of 2026
    expect(tournamentFor(2026)).toBe(null);
    expect(tournamentFor(2027)).toBe('euro');       // summer of 2028
    expect(tournamentFor(2029)).toBe('worldCup');   // summer of 2030
  });

  it('gives caps and goals to a player who is there', () => {
    const rng = new Rng(9);
    const { state } = startedCareer({ seed: 24 });
    const result = playTournament(rng, 'worldCup', state.player, 'ISR', 78, 2029, 0.9);
    expect(result.matches.length).toBeGreaterThanOrEqual(3);
    expect(result.caps).toBeGreaterThan(0);
    expect(result.goals).toBeGreaterThanOrEqual(0);
    const appearance = result.matches.find((match) => match.userPlayed)!;
    expect(appearance.userMinutes).toBeGreaterThan(0);
    expect(appearance.userAssists).toBeGreaterThanOrEqual(0);
  });
});

describe('the competitions a club actually enters', () => {
  it('gives every modelled country its national cup, and a league cup where one exists', () => {
    const { state, index } = startedCareer({ seed: 31 });
    for (const country of index.pack.countries) {
      const clubs = Object.values(state.world.clubs).filter((club) => club.country === country.code);
      if (clubs.length < 8) continue;
      expect(
        state.world.cups[`${country.code.toLowerCase()}_cup`],
        `${country.code} has no national cup`,
      ).toBeTruthy();
      if (country.leagueCupName) {
        expect(
          state.world.cups[`${country.code.toLowerCase()}_leaguecup`],
          `${country.code} plays a ${country.leagueCupName} and has none`,
        ).toBeTruthy();
      }
    }
    // Israel plays both, and the Toto is a smaller field than the State Cup.
    // The Toto is the top two divisions; the State Cup is everybody.
    const nationalCup = state.world.cups['isr_cup']!;
    const toto = state.world.cups['isr_leaguecup']!;
    const entrants = (cup: typeof toto) => cup.alive.length + cup.ties.length * 2;
    expect(entrants(toto)).toBeLessThan(entrants(nationalCup));
  });

  it('sends the age group into the same knockouts as the first team', () => {
    const { state, index } = startedCareer({ seed: 32 });
    expect(Object.keys(state.world.youth?.cups ?? {})).toEqual(
      expect.arrayContaining(['isr_cup.youth', 'isr_leaguecup.youth']),
    );

    const cupTies: string[] = [];
    for (let i = 0; i < 52 && cupTies.length < 2; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
      for (const match of state.matchLog) {
        if (match.userLine?.played && match.competitionId.includes('cup') && !cupTies.includes(match.id)) {
          cupTies.push(match.id);
        }
      }
    }

    // He plays cup football, on Sunday mornings, for his own age group.
    expect(cupTies.length, 'a season of youth football with no cup tie in it').toBeGreaterThan(0);
  });
});

describe('who the build-up is for', () => {
  it('leaves an injured player out of the questions as well as the squad', () => {
    const { state, index } = startedCareer({ seed: 97 });
    for (let i = 0; i < 8; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
    }

    // Six weeks of a hamstring: he is not in anybody's squad for a while.
    state.player.condition.injuries.push({
      id: 'inj_buildup', type: 'hamstring', severity: 'serious',
      weeksOut: 6, weeksRemaining: 6, season: state.world.season,
    });

    let asked = 0;
    for (let i = 0; i < 5 && state.player.condition.injuries.length > 0; i++) {
      playWeek(state, index);
      asked += state.pendingDecisions.filter((decision) => (
        decision.eventId === 'milestone:derby'
        || decision.eventId === 'milestone:bigMatch'
        || decision.eventId === 'opponent_targets_you'
        || decision.eventId === 'penalty_in_last_minute'
        || decision.eventId === 'derby_week_pressure'
      )).length;
      state.pendingDecisions = [];
    }

    expect(asked, 'the press asked a man who could not play what the match meant').toBe(0);
  });

  it('does not invite a boy abroad before he has played a competitive match', () => {
    const pack = loadPack();
    const trial = pack.events.find((event) => event.id === 'academy_trial_abroad')!;
    const { state } = startedCareer({ seed: 98 });
    const index = indexPack(pack);

    const ctx = {
      age: 16,
      absoluteWeek: state.world.season * 52 + 2,
      seasonWeek: 2,
      minutesPct: 0,
      careerApps: 0,
      squadRole: 'academy' as const,
      ovr: 55,
      morale: 60,
      managerTrust: 55,
      hasAgent: false,
      injured: false,
      tier: 1,
      contractYearsLeft: 3,
    };

    // In his first camp, with nothing behind him, nobody is flying him anywhere.
    expect(isEligible(trial, ctx, state)).toBe(false);
    // A season of football later, they can.
    expect(isEligible(trial, { ...ctx, careerApps: 20 }, state)).toBe(true);
    expect(index.competitionById.size).toBeGreaterThan(0);
  });
});

describe('losing the shirt over a bad run', () => {
  it('drops a boy in the age group too, and gives it back within a few matches', () => {
    const { state, index } = startedCareer({ seed: 96 });
    // Get him into the season proper, playing youth football every week.
    for (let i = 0; i < 10; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
    }
    expect(state.player.squadRole).toBe('academy');

    state.player.form = 22;
    state.player.condition.injuries = [];
    const dropped = evaluateConsequences(new Rng(4), state);
    expect(dropped.some((entry) => entry.id === 'benchedForForm')).toBe(true);
    expect(state.flags['formBenchNotified']).toBe(true);

    // The next time he plays, he comes off the bench - the age group used to hand him
    // ninety minutes whatever he had been doing.
    let cameOffTheBench = false;
    let weeksBenched = 0;
    for (let i = 0; i < 20 && state.flags['formBenchNotified']; i++) {
      const before = state.matchLog.length;
      // He is not playing his way out of it: the run stays bad for as long as we watch,
      // and he is fit throughout - this is about form, not about a hamstring.
      state.player.form = 22;
      state.player.condition.injuries = [];
      playWeek(state, index);
      state.pendingDecisions = [];
      weeksBenched++;
      for (const match of state.matchLog.slice(0, state.matchLog.length - before)) {
        if (match.userLine?.played && !match.competitionId.startsWith('friendly') && !match.userLine.started) {
          cameOffTheBench = true;
        }
      }
    }

    expect(cameOffTheBench, 'he started every match while dropped').toBe(true);
    // A few matches, not half a season: even with the form line pinned at its worst,
    // the spell is served and he is back in the side.
    expect(state.flags['formBenchNotified']).toBe(false);
    expect(weeksBenched).toBeLessThanOrEqual(8);
  });

  it('drops him on three bad afternoons, before the form line has caught up', () => {
    const { state, index } = startedCareer({ seed: 96 });
    const played = (career: typeof state) => career.matchLog
      .filter((match) => match.userLine?.played && !match.competitionId.startsWith('friendly'));
    for (let i = 0; i < 40 && played(state).length < 3; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
    }
    const competitive = state.matchLog
      .filter((match) => match.userLine?.played && !match.competitionId.startsWith('friendly'))
      .slice(0, 3);
    expect(competitive.length, 'he has not played three matches to be judged on').toBe(3);

    // A run everyone watching can see is bad, with the form line still in the forties:
    // the five-match average smoothed a quarter of the way a week never reaches 34, so
    // the old test kept him in the side through the whole of it.
    state.flags['formBenchNotified'] = false;
    state.flags['formBenchClearedWeek'] = 0;
    state.player.form = 42;
    for (const match of competitive) {
      match.userLine!.rating = 5.8;
      match.userLine!.minutes = 90;
      match.userLine!.started = true;
    }
    expect(state.player.form).toBeGreaterThan(34);
    const dropped = evaluateConsequences(new Rng(11), state);
    expect(dropped.some((entry) => entry.id === 'benchedForForm')).toBe(true);

    // The same three afternoons played well leave him where he is.
    const { state: other, index: otherIndex } = startedCareer({ seed: 96 });
    for (let i = 0; i < 40 && played(other).length < 3; i++) {
      playWeek(other, otherIndex);
      other.pendingDecisions = [];
    }
    other.flags['formBenchNotified'] = false;
    other.player.form = 42;
    for (const match of other.matchLog.slice(0, 6)) {
      if (match.userLine?.played) match.userLine.rating = 7.1;
    }
    expect(evaluateConsequences(new Rng(11), other).some((e) => e.id === 'benchedForForm')).toBe(false);
  });

  it('stops marking him on a run he played two months ago', () => {
    const { state, index } = startedCareer({ seed: 96 });
    for (let i = 0; i < 40 && !state.matchLog.some((m) => m.userLine?.played); i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
    }

    // A bad run and then nothing: no fixture, no reserve game, weeks of it. His form used
    // to be re-averaged from the same five old ratings every one of those weeks, so it
    // kept falling with nothing new to answer it and the way back was shut. Out of the
    // window, they stop counting and he drifts back toward the middle.
    let idleWeek = false;
    for (let i = 0; i < 80 && !idleWeek; i++) {
      // Everything he has played, played badly, and played five months into this same
      // season - the run is old, but it is not last year's.
      const stamped = Math.max(1, state.world.week - 20);
      for (const match of state.matchLog) {
        match.season = state.world.season;
        match.week = stamped;
        if (match.userLine?.played) match.userLine.rating = 5.4;
      }
      state.player.form = 25;
      const before = state.matchLog.length;
      playWeek(state, index);
      state.pendingDecisions = [];
      if (state.matchLog.length === before && state.world.week > 22) {
        idleWeek = true;
        expect(state.player.form, 'an old run still dragged his form down').toBeGreaterThan(25);
      }
    }
    expect(idleWeek, 'he played every single week, so nothing was tested').toBe(true);
  });
});

describe('clubs that have watched him', () => {
  it('takes a gifted boy into a good academy and turns a modest one down', () => {
    const { state, index } = startedCareer({ seed: 88 });
    const elite = Object.values(state.world.clubs)
      .filter((club) => club.country !== state.player.birthCountry)
      .sort((a, b) => (b.academy ?? 0) - (a.academy ?? 0))[0]!;

    state.player.potential = 94;
    state.player.reputation = 55;
    const forGifted = offerFromWatchingClub({
      state, index, rng: new Rng(3), club: elite, minutesPct: 0.8, impression: 0.5,
    });
    expect(forGifted).not.toBeNull();
    expect(forGifted!.joinAs).toBe('academy');
    expect(forGifted!.clubId).toBe(elite.id);

    // The same week, watched by the same people, from a boy who is not that player.
    state.player.potential = 62;
    state.player.reputation = 30;
    expect(offerFromWatchingClub({
      state, index, rng: new Rng(3), club: elite, minutesPct: 0.8, impression: -0.4,
    })).toBeNull();
  });

  it('answers a trial either way instead of leaving him waiting', () => {
    for (const [potential, expectOffer] of [[94, true], [55, false]] as const) {
      const { state, index } = startedCareer({ seed: 89 });
      state.world.week = 20;
      state.player.potential = potential;
      state.player.reputation = potential > 80 ? 55 : 25;

      // A club abroad with a real but not untouchable academy - the kind that actually
      // flies a boy out for a week.
      const abroad = Object.values(state.world.clubs)
        .filter((club) => club.country !== state.player.birthCountry
          && club.reputation >= 48
          && (club.academy ?? 0) >= 50 && (club.academy ?? 0) <= 66)
        .sort((a, b) => a.id.localeCompare(b.id))[0]!;
      expect(abroad, 'no plausible club abroad in the pack').toBeTruthy();
      state.flags['watchingClubId'] = abroad.id;
      state.flags['watchingVerdictWeek'] = state.world.season * 52 + state.world.week;
      state.flags['watchingImpression'] = expectOffer ? 0.6 : -0.5;
      state.flags['watchingWasTrial'] = true;

      const inboxBefore = state.inbox.length;
      playWeek(state, index);

      if (expectOffer) {
        expect(state.transferOffers.length, 'nobody offered him anything').toBeGreaterThan(0);
        expect(state.transferOffers[0]!.clubId).toBe(abroad.id);
        expect(state.pendingDecisions.some((decision) => decision.kind === 'transfer')).toBe(true);
      } else {
        // A no is still an answer, and it arrives with their name on it.
        const answered = state.inbox
          .slice(0, state.inbox.length - inboxBefore)
          .some((message) => message.titleKey === 'inbox.trialRejected' && message.args?.club === abroad.name);
        expect(answered, 'he was left waiting').toBe(true);
      }
      // Either way the club stops watching: no verdict is delivered twice.
      expect(state.flags['watchingClubId']).toBe('');
    }
  });
});

describe('the occasion of a fixture', () => {
  it('calls two clubs from the same town a derby, listed rivalry or not', () => {
    const { state, index } = startedCareer({ seed: 61 });
    const club = state.world.clubs[state.player.clubId!]!;
    club.city = 'Testville';
    club.rivals = [];
    const neighbour = Object.values(state.world.clubs).find((entry) => entry.id !== club.id)!;
    neighbour.city = 'Testville';
    const stranger = Object.values(state.world.clubs).find(
      (entry) => entry.id !== club.id && entry.id !== neighbour.id,
    )!;
    stranger.city = 'Elsewhere';

    expect(matchImportanceFor(state, index, club.competitionId, club.id, neighbour.id)).toBe('derby');
    expect(matchImportanceFor(state, index, club.competitionId, club.id, stranger.id)).not.toBe('derby');
  });

  it('reads the table of the league he is actually in, age group included', () => {
    const { state, index } = startedCareer({ seed: 62 });
    const club = state.world.clubs[state.player.clubId!]!;
    club.city = 'Nowhere';
    club.rivals = [];
    const division = userYouthCompetitionId(state)!;
    const comp = state.world.youth!.competitions[division]!;

    // A fixture against the best side in his own age group, a third of the way in.
    const others = Object.keys(comp.table).filter((id) => id !== club.id);
    const leader = others[0]!;
    // He is mid-table; they are top. Three clubs sit between them so this is not a
    // title decider, it is a boy facing the best side in his division.
    const chasers = others.slice(1, 4);
    for (const [clubId, row] of Object.entries(comp.table)) {
      row.played = 10;
      row.points = clubId === leader ? 30
        : chasers.includes(clubId) ? 24
        : clubId === club.id ? 12
        : 8;
      const other = state.world.clubs[clubId];
      if (other && other.id !== club.id) other.city = `City ${clubId}`;
    }

    expect(matchImportanceFor(state, index, division, club.id, leader)).toBe('topSide');
  });

  it('puts a microphone in front of him before the big ones', () => {
    const { state, index } = startedCareer({ seed: 63 });
    let asked = 0;
    let bigFixtures = 0;
    for (let i = 0; i < 52 && !state.retired; i++) {
      playWeek(state, index);
      for (const decision of state.pendingDecisions) {
        if (decision.eventId === 'milestone:bigMatch' || decision.eventId === 'milestone:derby') asked++;
      }
      state.pendingDecisions = [];
      const last = state.matchLog[0];
      if (last && last.importance !== 'normal' && last.importance !== 'friendly') bigFixtures++;
    }
    expect(bigFixtures).toBeGreaterThan(0);
    expect(asked).toBeGreaterThan(0);
  });
});

describe('transfer offers', () => {
  it('does not offer a division below to a player who is playing', () => {
    const { state, index } = startedCareer({ seed: 71 });
    const club = state.world.clubs[state.player.clubId!]!;
    // A regular in the side, at a second-tier club.
    const offers = generateOffers({ state, index, rng: new Rng(4), minutesPct: 0.7 });
    for (const offer of offers) {
      const suitor = state.world.clubs[offer.clubId]!;
      expect(suitor.tier).toBeLessThanOrEqual(club.tier);
    }
  });

  it('opens the door lower when he never plays', () => {
    const { state, index } = startedCareer({ seed: 72 });
    const offers = generateOffers({ state, index, rng: new Rng(5), minutesPct: 0.02 });
    // Nothing is guaranteed, but nothing may be two divisions down either.
    const club = state.world.clubs[state.player.clubId!]!;
    for (const offer of offers) {
      const suitor = state.world.clubs[offer.clubId]!;
      expect(suitor.tier).toBeLessThanOrEqual(club.tier + 1);
    }
  });

  it('offers a regular academy starter a better academy, or first-team football, and nothing else', () => {
    const { state, index } = createCareer(loadPack(), { ...DEFAULT_INPUT, age: 17, seed: 774 });
    joinClub(state, index, 'isr_maccabi_tel_aviv', { asAcademy: true });
    const current = state.world.clubs[state.player.clubId!]!;
    const currentCompetition = index.competitionById.get(current.competitionId)!;
    const youthCompetition = Object.values(state.world.youth!.competitions).find(
      (competition) => competition.table[current.id],
    )!;
    youthCompetition.table[current.id]!.played = 12;
    state.world.youth!.form.minutes = 12 * 80;
    state.player.reputation = 55;
    for (const key of Object.keys(state.player.attributes) as (keyof typeof state.player.attributes)[]) {
      state.player.attributes[key] = Math.max(state.player.attributes[key], 64);
    }

    const offers = Array.from({ length: 12 }, (_, seed) => generateOffers({
      state, index, rng: new Rng(900 + seed), minutesPct: 0,
    })).flat();
    expect(offers.length).toBeGreaterThan(0);
    for (const offer of offers) {
      const suitor = state.world.clubs[offer.clubId]!;
      const competition = index.competitionById.get(suitor.competitionId)!;
      expect(offer.joinAs).toBeDefined();
      if (offer.joinAs === 'academy') {
        // Another academy is only worth leaving a good one for if it is better.
        expect(suitor.tier).toBeLessThanOrEqual(current.tier);
        expect(competition.reputation).toBeGreaterThanOrEqual(currentCompetition.reputation - 2);
        expect(
          suitor.academy > current.academy || clubBaseOvr(suitor) > clubBaseOvr(current),
          `${suitor.name} is not a better academy than ${current.name}`,
        ).toBe(true);
        expect(offer.squadRole).toBe('academy');
      } else {
        // The only other thing worth his while is a first-team place he can actually
        // take: minutes, in a senior squad, at an age he is allowed to play.
        expect(offer.joinAs).toBe('senior');
        expect(offer.seniorPathway).toBe(true);
        expect(offer.expectedMinutesPct).toBeGreaterThanOrEqual(0.45);
      }
    }
  });

  it('never offers a fifteen-year-old a senior squad', () => {
    const { state, index } = createCareer(loadPack(), { ...DEFAULT_INPUT, age: 15, seed: 776 });
    joinClub(state, index, 'isr_maccabi_tel_aviv', { asAcademy: true });
    state.player.reputation = 55;
    state.player.potential = 92;

    const offers = Array.from({ length: 12 }, (_, seed) => generateOffers({
      state, index, rng: new Rng(1200 + seed), minutesPct: 0,
    })).flat();
    for (const offer of offers) {
      expect(offer.joinAs, `${offer.clubId} offered a senior place to a boy of fifteen`).toBe('academy');
    }
  });

  it('signs an academy offer into the academy, with a youth division to play in', () => {
    const { state, index } = createCareer(loadPack(), { ...DEFAULT_INPUT, age: 16, seed: 777 });
    joinClub(state, index, 'isr_hapoel_hadera', { asAcademy: true });
    state.player.potential = 92;
    state.player.reputation = 55;

    const offer = Array.from({ length: 16 }, (_, seed) => generateOffers({
      state, index, rng: new Rng(1300 + seed), minutesPct: 0,
    })).flat().find((entry) => entry.joinAs === 'academy');
    expect(offer).toBeDefined();

    state.transferOffers = [offer!];
    expect(acceptOffer(state, index, offer!.id)).toBe(true);

    expect(state.player.clubId).toBe(offer!.clubId);
    expect(state.player.squadRole).toBe('academy');
    expect(state.contract?.squadRole).toBe('academy');
    // He has not been called up to anybody's first team by signing a scholarship.
    expect(state.flags['calledUpToSeniors']).not.toBe(true);
    // And there is an age group for him to actually play in at the new club.
    const division = userYouthCompetitionId(state);
    expect(division).toBeTruthy();
    expect(state.world.youth?.squads[offer!.clubId]?.length ?? 0).toBeGreaterThan(0);
  });

  it('keeps real match simulation after a seventeen-year-old moves into a senior starting role', () => {
    const { state, index } = startedCareer({ seed: 775, age: 17 });
    const oldClub = state.player.clubId!;
    const oldCompetition = state.world.clubs[oldClub]!.competitionId;
    const target = Object.values(state.world.clubs).find(
      (club) => club.id !== oldClub && club.competitionId === oldCompetition,
    )!;
    state.world.week = 7;
    for (const key of Object.keys(state.player.attributes) as (keyof typeof state.player.attributes)[]) {
      state.player.attributes[key] = Math.max(state.player.attributes[key], 78);
    }
    state.player.form = 82;
    state.player.fitness = 90;
    joinClub(state, index, target.id, { role: 'starter' });
    state.pendingDecisions = [];

    for (let week = 0; week < 16; week++) {
      playWeek(state, index);
      state.pendingDecisions = [];
    }

    const seniorMatches = state.matchLog.filter((match) => (
      match.userClubId === target.id
      && !match.competitionId.endsWith('.youth')
      && match.userLine?.played
    ));
    expect(seniorMatches.length).toBeGreaterThan(0);
    expect(seniorMatches.every((match) => (match.userLine?.rating ?? 0) > 0)).toBe(true);
    expect(seniorMatches.some((match) => (
      match.homeGoals + match.awayGoals > 0
      || (match.events?.some((event) => ['chance', 'miss', 'save', 'corner', 'freeKick'].includes(event.type)) ?? false)
    ))).toBe(true);
  });

  it('finds somebody for a player with no club at all', () => {
    /*
     * A released player used to be measured against a thirty-rated league, which made
     * every real division look like a jump he was not ready for. Nobody rang, and a
     * career could end at nineteen with the player still fit and willing.
     */
    const { state, index } = startedCareer({ seed: 73, age: 18 });
    // Two seasons in, so he is a footballer rather than a boy nobody has heard of.
    for (let i = 0; i < 106; i++) playWeek(state, index);
    const club = state.world.clubs[state.player.clubId!] ?? Object.values(state.world.clubs)[0]!;
    state.flags['lastClubLevel'] = clubBaseOvr(club);
    state.flags['lastLeagueReputation'] = index.competitionById.get(club.competitionId)?.reputation ?? 40;
    state.flags['lastTier'] = club.tier;
    state.player.clubId = null;
    state.contract = null;

    // Four calls a month apart: at least one of them should turn something up.
    const offers = [0, 1, 2, 3].flatMap((n) => generateOffers({ state, index, rng: new Rng(500 + n), minutesPct: 0 }));
    expect(offers.length).toBeGreaterThan(0);
  });

  it('keeps windows to the weeks a country actually has them', () => {
    // England: July to the start of September, and January.
    expect(isTransferWindow(3, 'ENG')).toBe(true);
    expect(isTransferWindow(15, 'ENG')).toBe(false);
    expect(isTransferWindow(28, 'ENG')).toBe(true);
    // Israel runs a little later at both ends.
    expect(isTransferWindow(1, 'ISR')).toBe(false);
    expect(isTransferWindow(11, 'ISR')).toBe(true);
    expect(isTransferWindow(33, 'ISR')).toBe(true);
  });
});

describe('the press', () => {
  /** Puts a question on the table the way `raiseMilestone` does, without a whole season. */
  function askHim(state: ReturnType<typeof startedCareer>['state'], id: 'debut' | 'derby' | 'transferRumour') {
    const question = milestoneById(id)!;
    const decision = {
      id: `milestone_${id}_1_1`,
      kind: 'event' as const,
      eventId: `milestone:${id}`,
      category: 'media' as const,
      textKey: `milestone.${id}`,
      options: question.answers.map((answer) => ({
        id: answer.id,
        labelKey: `milestone.${id}.${answer.id}`,
        effects: [],
      })),
      blocking: true,
    };
    state.pendingDecisions.push(decision);
    return decision;
  }

  it('hands back what the answer changed', () => {
    const { state, index } = startedCareer();
    const decision = askHim(state, 'debut');
    const result = answerMedia(state, index, decision.id, decision.options[0]!.id);

    expect(result).not.toBeNull();
    expect(result!.changes.length).toBeGreaterThan(0);
    for (const change of result!.changes) {
      expect(change.before).not.toBe(change.after);
      expect(['good', 'bad', 'neutral']).toContain(change.tone);
    }
    expect(state.pendingDecisions.some((d) => d.id === decision.id)).toBe(false);
  });

  it('records a public claim so the next match has to settle it', () => {
    const { state } = startedCareer();
    const question = milestoneById('debut')!;
    const bold = question.answers.find((answer) => answer.backsItUp)!;
    const result = applyMilestoneAnswer(state, bold);

    expect(result.narrativeKey).toBe('milestone.claimMade');
    expect(state.flags['claimAttribute']).toBe(bold.backsItUp!.attribute);
    expect(Number(state.flags['claimSwing'])).toBeGreaterThan(0);
  });

  it('refuses an answer that was never on the table', () => {
    const { state, index } = startedCareer();
    const decision = askHim(state, 'derby');
    expect(answerMedia(state, index, decision.id, 'nothing-he-said')).toBeNull();
  });

  it('puts a transfer rumour before the formal offer and removes stale rumours after signing', () => {
    const { state, index } = startedCareer({ seed: 817 });
    state.pendingDecisions = [];
    const target = Object.values(state.world.clubs).find((club) => club.id !== state.player.clubId)!;
    const offer: TransferOffer = {
      id: 'chronological_offer', clubId: target.id, fee: 500_000, salaryPerWeek: 4_000,
      years: 3, squadRole: 'rotation', expectedMinutesPct: 0.45, isLoan: false,
      season: state.world.season, week: state.world.week, interestLevel: 70,
      competitionId: target.competitionId,
    };
    state.transferOffers = [offer];
    const rumour = askHim(state, 'transferRumour');

    answerMedia(state, index, rumour.id, rumour.options[0]!.id);
    const formal = state.pendingDecisions.find((decision) => decision.kind === 'transfer');
    expect(formal).toBeDefined();
    expect(state.pendingDecisions.some((decision) => decision.eventId === 'milestone:transferRumour')).toBe(false);

    // An upgraded save may already contain both. Signing invalidates the old premise.
    const stale = askHim(state, 'transferRumour');
    state.inbox.push({
      id: 'stale_rumour_message', season: state.world.season, week: state.world.week,
      category: 'media', titleKey: stale.textKey, read: false, decisionId: stale.id,
    });
    expect(answerOffer(state, index, formal!.id, offer.id)).not.toBeNull();
    expect(state.pendingDecisions.some((decision) => decision.eventId === 'milestone:transferRumour')).toBe(false);
    expect(state.inbox.some((message) => message.id === 'stale_rumour_message')).toBe(false);
  });

  it('asks once for one red-card incident, even while it remains the last match', () => {
    const { state, index } = startedCareer({ seed: 818 });
    for (const competition of Object.values(state.world.competitions)) competition.fixtures = [];
    for (const competition of Object.values(state.world.youth?.competitions ?? {})) competition.fixtures = [];
    state.world.cups = {};
    if (state.world.youth) state.world.youth.cups = {};
    state.world.europe = {};
    state.world.week = 10;
    state.pendingDecisions = [];

    const redMatch: MatchResult = {
      id: 'one_red_incident', season: state.world.season, week: 10,
      competitionId: 'test.youth', homeClubId: state.player.clubId!, awayClubId: 'opponent',
      homeGoals: 0, awayGoals: 1, detailLevel: 1,
      userLine: {
        played: true, started: true, minutes: 61, position: state.player.primaryPos,
        goals: 0, assists: 0, shots: 1, keyPasses: 0, tackles: 1, saves: 0,
        yellow: 0, red: 1, rating: 4.8, motm: false, offMinute: 61,
      },
    };
    state.lastMatch = redMatch;
    state.matchLog = [redMatch];

    advanceWeek(state, index);
    const first = state.pendingDecisions.find((decision) => decision.eventId === 'milestone:sentOff');
    expect(first).toBeDefined();
    answerMedia(state, index, first!.id, first!.options[0]!.id);
    state.pendingDecisions = [];

    advanceWeek(state, index);
    expect(state.pendingDecisions.filter((decision) => decision.eventId === 'milestone:sentOff')).toHaveLength(0);
    expect(state.inbox.filter((message) => message.titleKey.startsWith('milestone.sentOff'))).toHaveLength(1);
    expect(state.flags['asked:sentOff:match:one_red_incident']).toBe(true);
  });

  it('honours the old match-week marker when loading a career that already answered', () => {
    const { state, index } = startedCareer({ seed: 819 });
    for (const competition of Object.values(state.world.competitions)) competition.fixtures = [];
    for (const competition of Object.values(state.world.youth?.competitions ?? {})) competition.fixtures = [];
    state.world.cups = {};
    if (state.world.youth) state.world.youth.cups = {};
    state.world.europe = {};
    state.world.week = 12;
    state.pendingDecisions = [];
    state.lastMatch = {
      id: 'legacy_red_incident', season: state.world.season, week: 11,
      competitionId: 'test.youth', homeClubId: state.player.clubId!, awayClubId: 'opponent',
      homeGoals: 0, awayGoals: 0, detailLevel: 1,
      userLine: {
        played: true, started: true, minutes: 70, position: state.player.primaryPos,
        goals: 0, assists: 0, shots: 0, keyPasses: 0, tackles: 0, saves: 0,
        yellow: 2, red: 1, rating: 4.5, motm: false, offMinute: 70,
      },
    };
    state.matchLog = [state.lastMatch];
    state.flags[`asked:sentOff:${state.world.season}:11`] = true;

    advanceWeek(state, index);
    expect(state.pendingDecisions.filter((decision) => decision.eventId === 'milestone:sentOff')).toHaveLength(0);
    expect(state.flags['asked:sentOff:match:legacy_red_incident']).toBe(true);
  });

  it('has a question written for every moment it can raise', () => {
    const ids: MilestoneId[] = [
      'debut', 'firstGoal', 'derby', 'bigMatch', 'firstAfterTransfer', 'againstOldClub',
      'transferRumour', 'trophyNight', 'hatTrick', 'sentOff', 'dropped', 'goalDrought',
      'badRun', 'punditCriticism', 'rivalDig', 'injuryReturn', 'nationalCallUp',
      'youthBreakout', 'relegationFight', 'contractStandoff',
    ];
    for (const id of ids) {
      const question = milestoneById(id);
      expect(question, `${id} has no question`).toBeDefined();
      expect(question!.answers.length, `${id} needs at least two answers`).toBeGreaterThanOrEqual(2);
    }
  });

  it('gives him something to stake on every new moment', () => {
    const staked: MilestoneId[] = [
      'hatTrick', 'dropped', 'goalDrought', 'badRun', 'punditCriticism', 'rivalDig',
      'injuryReturn', 'nationalCallUp', 'youthBreakout', 'relegationFight', 'contractStandoff',
    ];
    for (const id of staked) {
      const question = milestoneById(id)!;
      expect(question.answers.some((a) => a.backsItUp), `${id} has nothing to stake`).toBe(true);
    }
  });

  it('turns up over a career, and never twice in a fortnight', () => {
    const { state, index } = startedCareer({ seed: 5150 });
    const asked: { id: string; week: number }[] = [];

    for (let i = 0; i < 52 * 6; i++) {
      playWeek(state, index);
      for (const decision of state.pendingDecisions) {
        if (!decision.eventId.startsWith('milestone:')) continue;
        asked.push({
          id: decision.eventId.slice('milestone:'.length),
          week: state.world.season * 52 + state.world.week,
        });
      }
      state.pendingDecisions = [];
    }

    // Six seasons of football produces more than one question, from more than one cause.
    expect(asked.length).toBeGreaterThan(3);
    expect(new Set(asked.map((entry) => entry.id)).size).toBeGreaterThan(1);
  });

  it('turns a fixture he talked about into a rival fixture, then closes the account', () => {
    const { state, index } = startedCareer({ seed: 909 });
    const club = state.world.clubs[state.player.clubId!]!;
    const opponentId = Object.values(state.world.clubs)
      .find((c) => c.competitionId === club.competitionId && c.id !== club.id)!.id;

    state.flags['grudgeClubId'] = opponentId;
    state.flags['grudgeUntilWeek'] = state.world.season * 52 + state.world.week + 20;
    expect(grudgeClubId(state)).toBe(opponentId);

    // An account nobody collects on expires rather than following him for ever.
    state.flags['grudgeUntilWeek'] = state.world.season * 52 + state.world.week - 1;
    expect(grudgeClubId(state)).toBeNull();
  });

  it('never offers an answer that costs nothing at all', () => {
    for (const question of MILESTONES) {
      for (const answer of question.answers) {
        const deltas = [
          ...Object.values(answer.attributes ?? {}),
          ...Object.values(answer.personality ?? {}),
          ...Object.values(answer.relationships ?? {}),
          answer.morale ?? 0,
          answer.fame ?? 0,
          answer.reputation ?? 0,
        ];
        const costs = deltas.some((delta) => delta < 0) || Boolean(answer.backsItUp);
        expect(costs, `${question.id}.${answer.id} risks nothing`).toBe(true);
      }
    }
  });
});

describe('half time', () => {
  /**
   * A match context built from a real career, so the lineup, the squad and the
   * opponent are the ones the engine would actually hand the simulation.
   */
  function matchContext(): UserMatchContext {
    const { state, index } = startedCareer({ seed: 8080 });
    // Play until he is a senior with a club squad around him.
    for (let i = 0; i < 52 * 4; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
    }
    // Four seasons in he is usually a senior somewhere. If a move has left him without
    // a club for the moment, the test still needs eleven men, so we borrow a squad.
    const clubId = state.player.clubId ?? Object.keys(state.world.squads)[0]!;
    const club = state.world.clubs[clubId]!;
    const squad = [
      ...(state.world.squads[clubId] ?? []).flatMap((id) => {
        const found = state.world.players[id];
        return found ? [found] : [];
      }),
      state.player,
    ];
    const opponent = Object.values(state.world.clubs)
      .find((c) => c.competitionId === club.competitionId && c.id !== club.id)!;

    const lineup = pickLineup(new Rng(11), squad, {
      formation: '4-3-3',
      managerTrust: 70,
      userId: state.player.id,
      rotationPressure: 0.3,
      importantMatch: false,
    });

    return {
      season: state.world.season,
      week: 10,
      competitionId: club.competitionId,
      homeClub: club,
      awayClub: opponent,
      userIsHome: true,
      userClubSquad: squad,
      opponentStars: [],
      opponentRating: 62,
      user: state.player,
      lineup,
      minutes: { played: true, started: true, minutes: 90, slot: state.player.primaryPos },
      importance: 'normal',
      matchId: 'test-match',
      mental: 1,
      penaltyTaker: true,
    };
  }

  it('plays a first half that nothing said at the break can change', () => {
    const ctx = matchContext();
    const cut = simulateUserMatch(new Rng(4242), { ...ctx, stopAtHalfTime: true });
    const shape = (events: typeof cut.events) =>
      events.filter((e) => e.minute <= 45).map((e) => [e.minute, e.type, e.playerId ?? '', e.detailKey ?? '']);

    for (const instruction of Object.keys(HALF_TIME_INSTRUCTIONS) as (keyof typeof HALF_TIME_INSTRUCTIONS)[]) {
      const full = simulateUserMatch(new Rng(4242), { ...ctx, instruction });
      expect(shape(full.events), `${instruction} changed the first half`).toEqual(shape(cut.events));
      expect(full.halfTimeScore).toEqual(cut.halfTimeScore);
    }
  });

  it('stops without rolling anything past the whistle', () => {
    const ctx = matchContext();
    const cut = simulateUserMatch(new Rng(99), { ...ctx, stopAtHalfTime: true });
    expect(cut.events.every((e) => e.minute <= 45)).toBe(true);
    expect(cut.injuryRolled).toBe(false);
    expect(cut.events.some((e) => e.type === 'halfTime')).toBe(true);
    expect(cut.events.some((e) => e.type === 'fullTime')).toBe(false);
  });

  it('lets the instruction change the second half and only the second half', () => {
    const ctx = matchContext();
    const forward = simulateUserMatch(new Rng(1234), { ...ctx, instruction: 'pushForward' });
    const legs = simulateUserMatch(new Rng(1234), { ...ctx, instruction: 'saveLegs' });

    const secondHalf = (events: typeof forward.events) => events.filter((e) => e.minute > 45).length;
    expect(secondHalf(forward.events)).not.toBe(0);
    // Different orders produce different second halves; the same seed, the same first.
    expect(forward.halfTimeScore).toEqual(legs.halfTimeScore);
    expect(forward.fatigueFactor).toBeGreaterThan(legs.fatigueFactor);
    expect(forward.result.instruction).toBe('pushForward');
    expect(legs.result.instruction).toBe('saveLegs');
  });

  it('makes the expanded instructions change the actions the player performs', () => {
    const ctx = matchContext();
    const totals = (instruction: keyof typeof HALF_TIME_INSTRUCTIONS) => {
      const sum = { shots: 0, keyPasses: 0, tackles: 0, fatigue: 0 };
      for (let seed = 1; seed <= 240; seed++) {
        const outcome = simulateUserMatch(new Rng(seed), { ...ctx, instruction });
        sum.shots += outcome.line.shots;
        sum.keyPasses += outcome.line.keyPasses + outcome.line.assists;
        sum.tackles += outcome.line.tackles;
        sum.fatigue += outcome.fatigueFactor;
      }
      return sum;
    };
    const shooting = totals('shootFromDistance');
    const passing = totals('passMore');
    const defending = totals('defendMore');
    const solo = totals('playAlone');
    const pressing = totals('pressHigher');

    expect(shooting.shots).toBeGreaterThan(passing.shots);
    expect(passing.keyPasses).toBeGreaterThan(solo.keyPasses);
    expect(defending.tackles).toBeGreaterThan(solo.tackles);
    expect(pressing.fatigue).toBeGreaterThan(defending.fatigue);
  });

  it('produces a full match stream with named cards, injuries and announced penalties', () => {
    const base = matchContext();
    const ctx = { ...base, opponentStars: base.userClubSquad.filter((player) => player.id !== base.user.id) };
    let events = 0;
    let matches = 0;
    let yellowFor = false;
    let yellowAgainst = false;
    let namedInjury = false;
    let announcedPenalty = false;
    for (let seed = 1; seed <= 500; seed++) {
      const outcome = simulateUserMatch(new Rng(seed), ctx);
      events += outcome.events.length;
      matches++;
      yellowFor ||= outcome.events.some((event) => event.type === 'yellow' && event.forUserTeam === true);
      yellowAgainst ||= outcome.events.some((event) => event.type === 'yellow' && event.forUserTeam === false);
      namedInjury ||= outcome.events.some((event) => event.type === 'injury' && Boolean(event.playerId));
      for (const event of outcome.events.filter((entry) => entry.type === 'penaltyAwarded')) {
        const resolved = outcome.events.find(
          (entry) => entry.minute === event.minute + 1
            && (entry.type === 'penaltyScored' || entry.type === 'penaltyMissed')
            && entry.forUserTeam === event.forUserTeam,
        );
        if (resolved) announcedPenalty = true;
      }
    }
    expect(events / matches).toBeGreaterThan(22);
    expect(yellowFor).toBe(true);
    expect(yellowAgainst).toBe(true);
    expect(namedInjury).toBe(true);
    expect(announcedPenalty).toBe(true);
  });

  it('keeps score snapshots chronological', () => {
    const ctx = matchContext();
    for (let seed = 1; seed <= 300; seed++) {
      const match = simulateUserMatch(new Rng(seed), ctx);
      let home = 0;
      let away = 0;
      for (const event of match.events) {
        if (!event.score) continue;
        expect(event.score[0], `home score went backwards at ${event.minute} with seed ${seed}`).toBeGreaterThanOrEqual(home);
        expect(event.score[1], `away score went backwards at ${event.minute} with seed ${seed}`).toBeGreaterThanOrEqual(away);
        home = event.score[0];
        away = event.score[1];
      }
      expect([home, away]).toEqual([match.result.homeGoals, match.result.awayGoals]);
    }
  });

  it('never lets the user act after a substitution, dismissal, or injury', () => {
    const base = matchContext();
    const involved = new Set(['goal', 'assist', 'miss', 'save', 'tackle', 'chance', 'woodwork', 'freeKick', 'corner']);
    let forcedExitSeen = false;

    for (let seed = 1; seed <= 800; seed++) {
      const plannedOff = seed % 2 === 0 ? 35 : 70;
      const minutes = plannedOff === 35
        ? { played: true, started: true, minutes: 35, slot: base.user.primaryPos, offMinute: 35 }
        : { played: true, started: false, minutes: 25, slot: base.user.primaryPos, cameOnMinute: 45, offMinute: 70 };
      const match = simulateUserMatch(new Rng(seed), { ...base, minutes });
      const forced = match.events.find(
        (event) => event.byUser && event.playerId === base.user.id
          && (event.type === 'red' || event.type === 'injury'),
      );
      if (forced) forcedExitSeen = true;
      const exit = Math.min(plannedOff, forced?.minute ?? 90);

      for (const event of match.events) {
        if (!event.byUser || event.playerId !== base.user.id || !involved.has(event.type)) continue;
        expect(event.minute, `${event.type} after exit with seed ${seed}`).toBeLessThan(exit);
      }
    }
    expect(forcedExitSeen, 'the sample never exercised a dismissal or injury').toBe(true);
  });

  it('stops the week at the interval without writing anything to the world', () => {
    const { state, index } = startedCareer({ seed: 4242 });

    let paused = null as ReturnType<typeof advanceWeek> | null;
    for (let i = 0; i < 52 * 3; i++) {
      const result = advanceWeek(state, index);
      if (result.stopped === 'halfTime') {
        paused = result;
        expect(state.pendingHalfTime).toBeDefined();
        const held = state.pendingHalfTime!;
        // The stopped match itself has not landed anywhere: it is not the last match
        // played, it is not in the log, and the fixture is still waiting.
        expect(state.lastMatch?.id).not.toBe(held.matchId);
        expect(state.matchLog.some((m) => m.id === held.matchId)).toBe(false);
        const comp = state.world.competitions[held.competitionId]
          ?? state.world.youth?.competitions[held.competitionId];
        const fixture = comp?.fixtures.find(
          (f) => f.homeClubId === held.homeClubId && f.awayClubId === held.awayClubId && f.week === state.world.week,
        );
        if (fixture) expect(fixture.played, 'the fixture was written off before the whistle').toBe(false);
        break;
      }
      state.pendingDecisions = [];
    }

    expect(paused, 'no match ever reached the interval').not.toBeNull();
    const held = state.pendingHalfTime!;
    expect(held).toBeDefined();
    expect(held.firstHalfEvents.every((e) => e.minute <= 45)).toBe(true);
    expect(held.options.length).toBeGreaterThan(1);

    // A manager demand can be prepended even when it is outside the player's normal
    // menu (for example asking a goalkeeper to push up while chasing a game). A live
    // self-instruction must use one of the position-valid options.
    const instruction = held.options[held.options.length - 1]!;
    const instructionMinute = Math.max(12, held.minutes.cameOnMinute ?? 0);
    const eventsBeforeInstruction = held.firstHalfEvents.length;
    const ratingBeforeInstruction = held.rating;
    expect(instructionMinute).toBeLessThan(44);
    expect(applyLiveInstruction(state, held.matchId, instructionMinute, instruction)).toBe(true);
    expect(held.liveInstructions).toEqual([{ minute: instructionMinute, instruction }]);
    expect(held.firstHalfEvents).toHaveLength(eventsBeforeInstruction + 1);
    expect(held.firstHalfEvents.some(
      (event) => event.detailKey === `match.live.instruction.${instruction}`,
    )).toBe(true);
    expect(held.rating).not.toBe(ratingBeforeInstruction);

    const watched = held.firstHalfEvents.map((e) => [e.minute, e.type, e.detailKey ?? '']);
    const resumed = resumeHalfTime(state, index, held.options[0]!);

    expect(resumed.stopped).not.toBe('halfTime');
    expect(state.pendingHalfTime).toBeUndefined();
    expect(state.lastMatch).not.toBeNull();
    expect(
      state.lastMatch!.events!.filter((e) => e.minute <= 45).map((e) => [e.minute, e.type, e.detailKey ?? '']),
      'the half he watched changed under him',
    ).toEqual(watched);
    expect(state.lastMatch!.instructionChanges).toEqual([{ minute: instructionMinute, instruction }]);
    expect(state.lastMatch!.events!.some(
      (event) => event.detailKey === `match.live.instruction.${instruction}`,
    )).toBe(true);
  });

  it('gives orders to a boy and leaves a trusted senior to decide', () => {
    const { state, index } = startedCareer({ seed: 777 });
    for (let i = 0; i < 52 * 3; i++) {
      const result = advanceWeek(state, index);
      state.pendingDecisions = [];
      if (result.stopped !== 'halfTime') continue;
      const held = state.pendingHalfTime!;
      // Whoever is talking, he is never handed a list with nothing on it.
      expect(held.options.length).toBeGreaterThan(0);
      if (held.demand !== null) expect(held.options).toContain(held.demand);
      resumeHalfTime(state, index, held.demand ?? held.options[0]!);
    }
  });

  it('finishes the match the team talk belonged to, whatever else that week held', () => {
    // A week can hold a Sunday morning in the age group and a cup tie two days later.
    // The interval belongs to one of them, and that is the match that has to be played
    // out and put in the log - the app follows it by id, and following "the last match
    // written" is how a boy watching his youth match ended up in somebody else's tie.
    const { state, index } = startedCareer({ seed: 8181 });
    let checked = 0;
    for (let i = 0; i < 52 * 4 && !state.retired; i++) {
      const result = advanceWeek(state, index);
      state.pendingDecisions = [];
      if (result.stopped !== 'halfTime') continue;
      const held = state.pendingHalfTime!;
      const answeredId = held.matchId;
      resumeHalfTime(state, index, held.demand ?? held.options[0]!);
      const played = state.matchLog.find((match) => match.id === answeredId);
      expect(played, `the match the interval belonged to was never finished: ${answeredId}`).toBeDefined();
      expect(played!.competitionId, 'the finished match changed competition').toBe(held.competitionId);
      checked++;
    }
    expect(checked, 'no interval ever came up').toBeGreaterThan(0);
  });

  it('applies national-team instructions without rewriting club trust or club totals', () => {
    const { state } = startedCareer({ seed: 8182, age: 19 });
    const stats = state.world.seasonStats[state.player.id]!;
    const ratingSumBefore = stats.ratingSum;
    const trustBefore = state.managerTrust;
    const relationshipBefore = state.relationships.manager;
    const match: MatchResult = {
      id: 'national-live-test', season: state.world.season, week: state.world.week,
      competitionId: 'national.qualifier', homeClubId: 'ISR', awayClubId: 'ENG',
      homeGoals: 1, awayGoals: 1, detailLevel: 1, userClubId: 'ISR',
      userLine: {
        played: true, started: true, minutes: 90, position: state.player.primaryPos,
        goals: 0, assists: 0, shots: 1, keyPasses: 1, tackles: 0, saves: 0,
        yellow: 0, red: 0, rating: 6.6, motm: false,
      },
      events: [],
    };
    state.matchLog.unshift(match);
    state.lastMatch = match;

    expect(applyLiveInstruction(state, match.id, 24, 'passMore')).toBe(true);
    expect(match.instructionChanges).toEqual([{ minute: 24, instruction: 'passMore' }]);
    expect(match.userLine!.keyPasses).toBeGreaterThan(1);
    expect(stats.ratingSum).toBe(ratingSumBefore);
    expect(state.managerTrust).toBe(trustBefore);
    expect(state.relationships.manager).toBe(relationshipBefore);
  });

  it('grows a career at a believable pace', () => {
    // The shape is the point: a boy does not go from thirty-five to seventy in one youth
    // season, and by twenty he is not finished. This pins both ends so a later change to
    // training, diet or facilities cannot quietly reinflate it.
    const { state, index } = startedCareer({ seed: 4242 });
    let previous = currentOvr(state);
    let biggestSeasonJump = 0;
    let atTwenty = 0;
    let season = state.world.season;

    for (let i = 0; i < 52 * 8 && !state.retired; i++) {
      const result = advanceWeek(state, index);
      state.pendingDecisions = [];
      if (result.stopped === 'halfTime' && state.pendingHalfTime) {
        const held = state.pendingHalfTime;
        resumeHalfTime(state, index, held.demand ?? held.options[0]!);
      }
      if (state.world.season !== season) {
        season = state.world.season;
        const now = currentOvr(state);
        biggestSeasonJump = Math.max(biggestSeasonJump, now - previous);
        previous = now;
        if (state.world.season - state.player.birthYear === 20) atTwenty = now;
      }
    }

    expect(biggestSeasonJump, 'a season gained more than a career should').toBeLessThanOrEqual(14);
    expect(atTwenty, 'a twenty year old is already finished').toBeLessThan(88);
    expect(currentOvr(state), 'he never grew at all').toBeGreaterThan(50);
  });

  it('does not put an injured or banned boy on the pitch, in any competition', () => {
    // The age group used to hand him ninety minutes unconditionally, so a hamstring tear
    // with eight weeks to serve still turned out on Sunday morning.
    const { state, index } = startedCareer({ seed: 909 });
    let injuredWeeks = 0;
    for (let i = 0; i < 52 * 5 && !state.retired; i++) {
      const injured = state.player.condition.injuries.length > 0;
      // A ban belongs to the competition it was served in: a league suspension does not
      // keep him out of the age group on Sunday morning.
      const banned = new Set(
        state.player.condition.suspensions
          .filter((ban) => ban.matchesRemaining > 0)
          .map((ban) => ban.competitionId),
      );
      const before = state.matchLog.length;
      const result = advanceWeek(state, index);
      state.pendingDecisions = [];
      if (result.stopped === 'halfTime' && state.pendingHalfTime) {
        const held = state.pendingHalfTime;
        resumeHalfTime(state, index, held.demand ?? held.options[0]!);
      }
      if (!injured && banned.size === 0) continue;
      injuredWeeks++;
      for (const match of state.matchLog.slice(0, state.matchLog.length - before)) {
        if (!injured && !banned.has(match.competitionId)) continue;
        expect(
          match.userLine?.played,
          `played ${match.competitionId} while unavailable`,
        ).toBeFalsy();
      }
    }
    expect(injuredWeeks, 'he was never unavailable, so nothing was tested').toBeGreaterThan(0);
  });

  it('never leaves a team talk hanging once it has been answered', () => {
    // An answered break that is never cleared is not a harmless leftover: the app shows
    // the dressing room in place of the match report, for every match after it.
    const { state, index } = startedCareer({ seed: 4242 });
    let answered = 0;
    for (let i = 0; i < 52 * 3; i++) {
      const result = advanceWeek(state, index);
      state.pendingDecisions = [];
      if (result.stopped !== 'halfTime') continue;
      const held = state.pendingHalfTime!;
      resumeHalfTime(state, index, held.demand ?? held.options[0]!);
      answered++;
      // A week can hold two matches - a league game and a cup tie - and the second one
      // is entitled to its own dressing room. What must never happen is the match he
      // has just answered for staying on the table.
      expect(
        state.pendingHalfTime?.matchId,
        'the interval was still on the table after it was answered',
      ).not.toBe(held.matchId);
    }
    expect(answered, 'no interval ever came up').toBeGreaterThan(0);
  });

  it('takes a player off the sheet when the same man was planted twice', () => {
    // Careers begun before the two spellings were merged have him in the squad twice -
    // Vinicius Junior by keyboard and Vinícius Júnior by encyclopedia - and the squad
    // lives in the save, so only a migration can get him off the sheet.
    const { state } = startedCareer({ seed: 31 });
    const clubId = state.player.clubId!;
    const ids = state.world.squads[clubId]!;
    const twin = { ...state.world.players[ids[0]!]!, id: 'twin_of_the_first' };
    twin.firstName = twin.firstName.replace(/e/i, 'é');
    state.world.players[twin.id] = twin;
    state.world.squads[clubId] = [...ids, twin.id];
    const before = state.world.squads[clubId]!.length;

    const raw = JSON.stringify({
      schemaVersion: 2,
      gameVersion: '0.1.0',
      savedAt: '2026-01-01T00:00:00.000Z',
      state,
    });
    const loaded = deserialize(raw);

    expect(loaded.world.squads[clubId]!.length).toBe(before - 1);
    const names = loaded.world.squads[clubId]!.map((id) => {
      const man = loaded.world.players[id]!;
      return `${man.firstName} ${man.lastName}`.normalize('NFD').replace(/[̀-ͯ]/g, '');
    });
    expect(new Set(names).size, 'the same man is still on the sheet twice').toBe(names.length);
  });

  it('never offers an instruction that is all upside', () => {
    // For three of these, a number below one is the good news: less fatigue, fewer
    // cards, fewer knocks. Everything else is better the higher it is.
    const lowerIsBetter = new Set(['fatigue', 'cardRisk', 'injuryRisk']);
    for (const [id, effect] of Object.entries(HALF_TIME_INSTRUCTIONS)) {
      const helps: boolean[] = [];
      const hurts: boolean[] = [];
      for (const [key, value] of Object.entries(effect)) {
        if (value === 1) continue;
        const good = lowerIsBetter.has(key) ? value < 1 : value > 1;
        helps.push(good);
        hurts.push(!good);
      }
      expect(helps.some(Boolean), `${id} gains nothing`).toBe(true);
      expect(hurts.some(Boolean), `${id} costs nothing`).toBe(true);
    }
  });

  it('leaves trusted senior players alone and tells everybody else', () => {
    expect(managerDictates(80, 'key')).toBe(false);
    expect(managerDictates(40, 'key')).toBe(true);
    expect(managerDictates(90, 'bench')).toBe(true);
    expect(managerDictates(90, 'academy')).toBe(true);
  });

  it('asks a losing side to go forward and a winning side to hold on', () => {
    const rng = new Rng(5);
    const losing = Array.from({ length: 40 }, () => managerDemand(rng, -1, 6.8, 'ATT'));
    const winning = Array.from({ length: 40 }, () => managerDemand(rng, 2, 6.8, 'MID'));
    expect(losing.every((id) => id === 'pushForward' || id === 'takeThemOn' || id === 'pressHigher')).toBe(true);
    expect(winning.every((id) => id === 'holdShape' || id === 'saveLegs')).toBe(true);
  });

  it('does not ask a goalkeeper to run at the full-back', () => {
    expect(instructionsFor('GK')).not.toContain('takeThemOn');
    expect(instructionsFor('ATT')).toContain('takeThemOn');
    expect(instructionsFor('ATT')).toContain('shootFromDistance');
    expect(instructionsFor('ATT')).toContain('playAlone');
    expect(instructionsFor('MID')).toContain('passMore');
    expect(instructionsFor('DEF')).toContain('defendMore');
    expect(instructionsFor('DEF')).toContain('pressHigher');

    const demands = Array.from({ length: 50 }, (_, seed) => managerDemand(new Rng(seed + 1), -1, 6.8, 'GK'));
    expect(demands.every((demand) => demand === 'holdShape' || demand === 'passMore')).toBe(true);
  });
});

describe('the youth league', () => {
  /** A career far enough in that a youth season has actually been played out. */
  function youthCareer(seed = 4242, weeks = 40) {
    const { state, index } = startedCareer({ seed });
    for (let i = 0; i < weeks; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
    }
    return { state, index };
  }

  it('shadows every senior division in his country', () => {
    const { state, index } = startedCareer();
    const club = state.world.clubs[state.player.clubId!]!;
    const youth = state.world.youth!;
    expect(youth).toBeDefined();

    for (const league of countryLeagues(index, club.country)) {
      const clubsInIt = Object.values(state.world.clubs).filter((c) => c.competitionId === league.id);
      if (clubsInIt.length < 4) continue;
      const id = youthCompetitionId(league.id);
      expect(youth.competitions[id], `${league.id} has no youth division`).toBeDefined();
      for (const c of clubsInIt) expect(youth.membership[c.id]).toBe(id);
    }
  });

  it('fields sixteen boys of the right age at a level below the first team', () => {
    const { state, index } = startedCareer();
    const club = state.world.clubs[state.player.clubId!]!;
    const squad = generateYouthSquad(new Rng(7), index, club, state.world.season);

    expect(squad.length).toBe(YOUTH_SQUAD_SIZE);
    expect(squad.some((p) => p.primaryPos === 'GK')).toBe(true);
    for (const p of squad) {
      const age = state.world.season - p.birthYear;
      expect(age, `${p.lastName} is ${age}`).toBeGreaterThanOrEqual(14);
      expect(age).toBeLessThanOrEqual(YOUTH_MAX_AGE);
      expect(overall(p.attributes, p.primaryPos, p.secondaryPos)).toBeLessThan(currentOvr(state) + 40);
    }
  });

  it('populates only the division he is actually in', () => {
    const { state } = startedCareer();
    const youth = state.world.youth!;
    const his = userYouthCompetitionId(state)!;
    expect(his).toBeTruthy();

    for (const clubId of Object.keys(youth.squads)) {
      expect(youth.membership[clubId], 'a club outside his division has a squad').toBe(his);
    }
    expect(Object.keys(youth.players).length).toBeGreaterThan(50);
  });

  it('gives the goals in his division to boys who exist', () => {
    const { state } = youthCareer();
    const comp = userYouthCompetition(state)!;
    const youth = state.world.youth!;
    const scorers = Object.keys(comp.scorers);

    expect(scorers.length, 'nobody in the division has scored').toBeGreaterThan(0);
    for (const id of scorers) {
      expect(youth.players[id] || id === state.player.id, `${id} is nobody`).toBeTruthy();
    }
    // And the table has been played, not just built.
    expect(Object.values(comp.table).some((row) => row.played > 0)).toBe(true);
  });

  it('turns his own youth matches over to the age group, not the first team', () => {
    const { state } = youthCareer();
    const youthMatches = state.matchLog.filter((m) => m.competitionId.endsWith('.youth'));
    expect(youthMatches.length).toBeGreaterThan(0);
    expect(state.world.youth!.form.apps).toBeGreaterThan(0);

    const teammates = new Set(youthSquad(state, state.player.clubId!).map((p) => p.id));
    for (const match of youthMatches) {
      for (const event of match.events ?? []) {
        if (event.type !== 'goal' || !event.playerId) continue;
        if (event.playerId === state.player.id) continue;
        const known = teammates.has(event.playerId) || Boolean(state.world.youth!.players[event.playerId]);
        expect(known, 'a youth goal was credited to a senior').toBe(true);
      }
    }
  });

  it('moves clubs up and down its own pyramid and crowns its own winners', () => {
    const { state, index } = startedCareer({ seed: 31337 });
    for (let i = 0; i < 52 * 3; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
    }

    const youth = state.world.youth!;
    const moved = Object.entries(youth.membership).filter(
      ([clubId, compId]) => compId !== youthCompetitionId(state.world.clubs[clubId]!.competitionId),
    );
    expect(moved.length, 'the youth pyramid never moved anybody').toBeGreaterThan(0);

    const titles = state.world.history.champions.filter((c) => c.competitionId.endsWith('.youth'));
    expect(titles.length).toBeGreaterThanOrEqual(2);

    const honours = (state.world.history.awards ?? []).filter((a) => a.award.startsWith('youth'));
    expect(honours.some((a) => a.award === 'youthLeagueTopScorer')).toBe(true);
    expect(honours.some((a) => a.award === 'youthPlayerOfSeason')).toBe(true);
    // A golden boot is a number of goals, not a shrug.
    const boot = honours.find((a) => a.award === 'youthLeagueTopScorer')!;
    expect(boot.detail ?? 0).toBeGreaterThan(0);
    expect(boot.playerName).toBeTruthy();
  });

  it('carries a schema 1 career across without losing it', () => {
    const { state } = startedCareer({ seed: 55 });
    // A save written before the youth pyramid existed: one shadow table, a loose form
    // counter, and a national record with no youth caps in it.
    const old = JSON.parse(JSON.stringify(state)) as Record<string, any>;
    old.schemaVersion = 1;
    old.world.youth = {
      competitionId: 'isr.1.youth',
      season: state.world.season,
      clubIds: [],
      table: {},
      fixtures: [{ round: 1, week: 4, homeClubId: 'a', awayClubId: 'b', played: false }],
      currentRound: 0,
      scorers: {},
      finished: false,
    };
    old.world.youthForm = { apps: 9, goals: 2, assists: 1, ratingSum: 61 };
    delete old.nationalTeam.youthCaps;
    delete old.nationalTeam.youthGoals;

    const raw = JSON.stringify({
      schemaVersion: 1,
      gameVersion: '0.1.0',
      savedAt: '2026-01-01T00:00:00.000Z',
      state: old,
    });
    const loaded = deserialize(raw);

    expect(loaded.schemaVersion).toBe(SCHEMA_VERSION);
    expect(loaded.world.youth).toBeUndefined();
    expect(loaded.world.youthLegacy).toBeDefined();
    expect(loaded.nationalTeam.youthCaps).toBe(0);
    expect(loaded.nationalTeam.youthGoals).toBe(0);
    expect(loaded.player.id).toBe(state.player.id);
  });

  it('rebuilds the pyramid for a migrated career at the next season', () => {
    const { state, index } = startedCareer({ seed: 56 });
    state.world.youth = undefined;
    state.world.youthLegacy = undefined;

    for (let i = 0; i < 60; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
      if (state.world.youth) break;
    }
    expect(state.world.youth, 'a migrated career never got its academy back').toBeDefined();
  });

  it('does not carry every boy who ever played into the save', () => {
    const { state, index } = startedCareer({ seed: 57 });
    for (let i = 0; i < 52 * 3; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
    }
    const written = deserialize(serialize(state));
    const youth = written.world.youth;
    if (!youth) return;

    const inSquads = new Set(Object.values(youth.squads).flat());
    for (const id of Object.keys(youth.players)) {
      expect(inSquads.has(id), 'a boy who left is still in the save').toBe(true);
    }
    for (const record of Object.values(youth.stats)) {
      expect(record.season).toBeGreaterThanOrEqual(written.world.season);
    }
  });

  it('keeps the age group an age group year after year', () => {
    const { state, index } = startedCareer({ seed: 909 });
    for (let i = 0; i < 52 * 3; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
      const youth = state.world.youth;
      if (!youth) continue;
      for (const player of Object.values(youth.players)) {
        const age = state.world.season - player.birthYear;
        expect(age, `${player.lastName} is ${age} in the youth league`).toBeLessThanOrEqual(YOUTH_MAX_AGE);
        expect(age).toBeGreaterThanOrEqual(14);
      }
    }
  });
});

describe('the age gate', () => {
  function boy(age: number, ovr: number, potential: number) {
    const player = generatePlayer(new Rng(3), loadedIndex(), {
      clubId: 'c', pos: 'CAM', age, targetOvr: ovr, season: 2026, countryCode: 'ISR',
    });
    player.potential = potential;
    return player;
  }

  let cachedIndex: ReturnType<typeof indexPack> | null = null;
  function loadedIndex() {
    if (!cachedIndex) cachedIndex = indexPack(loadPack());
    return cachedIndex;
  }

  it('never lets a fifteen year old near a senior pitch', () => {
    const gate = eligibleForSenior(boy(15, 70, 95), 2026, {
      calledUp: true, clubOvr: 70, managerTrust: 95,
    });
    expect(gate.allowed).toBe(false);
    expect(gate.maxMinutes).toBe(0);
  });

  it('gives an exceptional sixteen year old the last half hour, not the shirt', () => {
    const gate = eligibleForSenior(boy(16, 70, 90), 2026, {
      calledUp: true, clubOvr: 70, managerTrust: 70,
    });
    expect(gate.allowed).toBe(true);
    expect(gate.maxMinutes).toBeLessThanOrEqual(CAMEO_MINUTES);
  });

  it('registers a young player signed for the senior rotation instead of treating him as an academy trial', () => {
    const gate = eligibleForSenior(boy(17, 58, 78), 2026, {
      calledUp: false, clubOvr: 62, managerTrust: 46, seniorRole: 'rotation',
    });
    expect(gate).toEqual({ allowed: true, maxMinutes: 90 });

    const prospect = eligibleForSenior(boy(17, 58, 78), 2026, {
      calledUp: false, clubOvr: 70, managerTrust: 44, seniorRole: 'futureProspect',
    });
    expect(prospect).toEqual({ allowed: true, maxMinutes: CAMEO_MINUTES });
  });

  it('keeps an ordinary sixteen year old in the academy', () => {
    const ordinary = eligibleForSenior(boy(16, 45, 70), 2026, {
      calledUp: true, clubOvr: 70, managerTrust: 70,
    });
    expect(ordinary.allowed).toBe(false);

    const untrusted = eligibleForSenior(boy(17, 70, 90), 2026, {
      calledUp: true, clubOvr: 70, managerTrust: 30,
    });
    expect(untrusted.allowed).toBe(false);
  });

  it('stops asking the question at eighteen', () => {
    const gate = eligibleForSenior(boy(18, 40, 50), 2026, {
      calledUp: false, clubOvr: 90, managerTrust: 10,
    });
    expect(gate.allowed).toBe(true);
    expect(gate.maxMinutes).toBe(90);
  });

  it('never generates a child into a senior squad', () => {
    const { state } = startedCareer({ seed: 4242 });
    for (const [clubId, ids] of Object.entries(state.world.squads)) {
      for (const id of ids) {
        const player = state.world.players[id];
        if (!player || player.isUser) continue;
        const age = state.world.season - player.birthYear;
        expect(age, `${player.lastName} is ${age} at ${clubId}`).toBeGreaterThanOrEqual(16);
      }
    }
  });

  it('does not put a fifteen year old in the first team of a top club', () => {
    const { state, index } = startedCareer({ seed: 12 });
    for (let i = 0; i < 52 * 3; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
      const age = state.world.season - state.player.birthYear;
      if (age >= 16) continue;
      for (const match of state.matchLog) {
        if (match.competitionId.endsWith('.youth')) continue;
        expect(match.userLine?.played ?? false, `a ${age} year old played a senior match`).toBe(false);
      }
    }
  });

  it('holds a sixteen year old to cameos in senior football', () => {
    const { state, index } = startedCareer({ seed: 99 });
    for (let i = 0; i < 52 * 4; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
      for (const match of state.matchLog) {
        if (match.competitionId.endsWith('.youth') || match.competitionId.startsWith('national.')
          || match.competitionId === 'friendly.national') continue;
        const line = match.userLine;
        if (!line?.played) continue;
        const ageThen = match.season - state.player.birthYear;
        if (ageThen !== 16) continue;
        expect(line.minutes, `a ${ageThen} year old played ${line.minutes} minutes`).toBeLessThanOrEqual(CAMEO_MINUTES);
        expect(line.started).toBe(false);
      }
    }
  });
});

describe('the national youth sides', () => {
  function boyWithAYouthSeason(targetOvr = 44) {
    const index = indexPack(loadPack());
    const player = generatePlayer(new Rng(21), index, {
      clubId: 'c', pos: 'ST', age: 16, targetOvr, season: 2026, countryCode: 'ISR',
    });
    return { index, player, nt: initNationalTeam(player) };
  }

  it('turns a real call-up window into the live national match of the week', () => {
    let calledUp: ReturnType<typeof startedCareer>['state'] | null = null;
    let stopped: ReturnType<typeof advanceWeek>['stopped'] | null = null;
    for (let seed = 8300; seed < 8340 && !calledUp; seed++) {
      const { state, index } = startedCareer({ seed, age: 19 });
      const clubId = state.player.clubId!;
      state.world.week = 8;
      joinClub(state, index, clubId, { role: 'starter' });
      for (const competition of Object.values(state.world.competitions)) competition.fixtures = [];
      for (const competition of Object.values(state.world.youth?.competitions ?? {})) competition.fixtures = [];
      state.world.cups = {};
      if (state.world.youth) state.world.youth.cups = {};
      state.world.europe = {};
      state.pendingDecisions = [];
      state.player.condition.injuries = [];
      state.player.form = 90;
      state.player.fitness = 95;
      state.player.condition.sharpness = 95;
      state.nationalTeam.interest.ISR = 100;
      for (const key of Object.keys(state.player.attributes) as (keyof typeof state.player.attributes)[]) {
        state.player.attributes[key] = Math.max(state.player.attributes[key], 82);
      }

      const result = advanceWeek(state, index);
      if (state.flags['nationalMatchId']) {
        calledUp = state;
        stopped = result.stopped;
      }
    }

    expect(calledUp, 'no high-interest player was selected across the sample').not.toBeNull();
    expect(stopped).toBe('match');
    const match = calledUp!.lastMatch!;
    expect(match.id).toBe(calledUp!.flags['nationalMatchId']);
    expect(match.competitionId).toBe('friendly.national');
    expect(match.userClubId).toBe('ISR');
    expect(match.homeClubId).toBe('ISR');
    expect(match.events?.length).toBeGreaterThan(4);
    let home = 0;
    let away = 0;
    for (const event of match.events ?? []) {
      if (!event.score) continue;
      expect(event.score[0]).toBeGreaterThanOrEqual(home);
      expect(event.score[1]).toBeGreaterThanOrEqual(away);
      [home, away] = event.score;
    }
    expect([home, away]).toEqual([match.homeGoals, match.awayGoals]);
  });

  /** A season of a coach watching: interest moves gradually, not in one week. */
  function watchAllSeason(index: ReturnType<typeof indexPack>, player: ReturnType<typeof generatePlayer>,
    nt: ReturnType<typeof initNationalTeam>, youth: { pct: number; rating: number; goals: number }) {
    for (let i = 0; i < 12; i++) {
      updateNationalInterest({
        player, age: 16, season: 2026,
        minutesPct: 0,
        youthMinutesPct: youth.pct, youthRating: youth.rating, youthGoals: youth.goals,
        clubReputation: 60, leagueReputation: 55,
        index, nt,
      });
    }
    return nt.interest['ISR'] ?? 0;
  }

  it('counts a season in the youth league when the senior one has not started', () => {
    const { index, player, nt } = boyWithAYouthSeason();
    const seen = watchAllSeason(index, player, nt, { pct: 0.9, rating: 7.8, goals: 18 });
    const quiet = watchAllSeason(index, player, initNationalTeam(player), { pct: 0.2, rating: 6.2, goals: 0 });

    expect(seen, `hot ${seen} against quiet ${quiet}`).toBeGreaterThan(quiet);
    expect(seen, `a boy tearing up the youth league drew ${seen}`).toBeGreaterThan(55);
  });

  it('does not let youth form stand in for senior football at under-21', () => {
    const { index, player, nt } = boyWithAYouthSeason();
    expect(levelForAge(21)).toBe('u21');

    updateNationalInterest({
      player, age: 21, season: 2026,
      minutesPct: 0,
      youthMinutesPct: 1, youthRating: 8.5, youthGoals: 30,
      clubReputation: 60, leagueReputation: 55,
      index, nt,
    });
    // At twenty-one nobody cares what he did on a Sunday morning.
    expect(nt.interest['ISR'] ?? 0).toBeLessThan(55);
  });

  it('cools national interest during injury and rebuilds it only with recovered form', () => {
    const { index, player, nt } = boyWithAYouthSeason(52);
    nt.interest['ISR'] = 78;
    const update = (availability: { injuredWeeks: number; sharpness: number; fitness: number; form: number }) =>
      updateNationalInterest({
        player, age: 19, season: 2026,
        minutesPct: availability.injuredWeeks > 0 ? 0 : 0.75,
        clubReputation: 60, leagueReputation: 55,
        index, nt,
        ...availability,
      });

    update({ injuredWeeks: 12, sharpness: 35, fitness: 55, form: 48 });
    const afterInjury = nt.interest['ISR'] ?? 0;
    expect(afterInjury).toBeLessThan(78);
    for (let week = 0; week < 4; week++) {
      update({ injuredWeeks: 8 - week, sharpness: 35, fitness: 60, form: 44 });
    }
    const duringLayoff = nt.interest['ISR'] ?? 0;
    expect(duringLayoff).toBeLessThan(afterInjury);

    update({ injuredWeeks: 0, sharpness: 38, fitness: 72, form: 45 });
    const justReturned = nt.interest['ISR'] ?? 0;
    expect(justReturned).toBeLessThanOrEqual(afterInjury);
    for (let week = 0; week < 8; week++) {
      update({ injuredWeeks: 0, sharpness: 86, fitness: 94, form: 76 });
    }
    expect(nt.interest['ISR'] ?? 0).toBeGreaterThan(justReturned);
  });

  it('remembers the shirts he wore before the senior one', () => {
    const { state, index } = startedCareer({ seed: 1234 });
    for (let i = 0; i < 52 * 5; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
    }
    const nt = state.nationalTeam;
    expect(nt.youthCaps).toBeGreaterThanOrEqual(0);
    expect(nt.youthGoals).toBeGreaterThanOrEqual(0);
    // Youth caps are not senior caps, whatever else happens.
    if (nt.youthCaps > 0) expect(nt.callUpHistory.some((c) => c.level !== 'senior')).toBe(true);
  });
});

describe('the old player', () => {
  const VOICES = ['winner', 'artist', 'grinder', 'captain', 'wanderer', 'wall'];

  it('has one of every voice to be found somewhere', () => {
    const voices = new Set(MENTORS.map((mentor) => mentor.voice));
    for (const voice of VOICES) expect(voices.has(voice as never), `nobody speaks as ${voice}`).toBe(true);
  });

  it('answers in his own voice rather than a shared script', () => {
    const { state } = startedCareer({ seed: 606 });
    const lines = new Set<string>();

    for (const voice of VOICES) {
      const mentor = MENTORS.find((m) => m.voice === voice)!;
      state.mentor = { id: mentor.id, bond: 60, lastTalkWeek: -99, talks: 3, followed: 1 };
      const reply = talkToMentor(new Rng(9), state, 'advice', 0.5);
      expect(reply, `${voice} said nothing`).not.toBeNull();
      expect(reply!.lineKey).toContain(voice);
      lines.add(reply!.lineKey);
    }
    // Six men, six different lines - which is the whole point of having a mentor.
    expect(lines.size).toBe(VOICES.length);
  });

  it('opens up more questions as a career moves on', () => {
    const { state } = startedCareer({ seed: 77 });
    state.mentor = { id: MENTORS[0]!.id, bond: 40, lastTalkWeek: -99, talks: 6, followed: 2 };

    const young = mentorTopics(state, 16);
    expect(young).toContain('firstTeam');

    state.world.youth = undefined;
    state.player.squadRole = 'starter';
    const older = mentorTopics(state, 28);
    expect(older).toContain('body');
    expect(older).not.toContain('firstTeam');
    expect(older.length).toBeGreaterThan(3);
  });

  it('chooses media copy deterministically while varying it between careers', () => {
    const variants = new Set<number>();
    for (let seed = 1; seed <= 12; seed++) {
      const { state } = startedCareer({ seed });
      variants.add(milestoneCopyVariant(state, 'debut'));
      expect(milestoneCopyVariant(state, 'debut')).toBe(milestoneCopyVariant(state, 'debut'));
    }
    expect(variants.size).toBe(3);
  });

  it('offers a different contextual question set at the next conversation', () => {
    const { state } = startedCareer({ seed: 79 });
    state.mentor = { id: MENTORS[0]!.id, bond: 50, lastTalkWeek: -99, talks: 2, followed: 0 };
    state.managerTrust = 35;
    state.player.form = 42;

    const first = mentorTopics(state, 19);
    state.world.week += MENTOR_COOLDOWN_WEEKS;
    state.mentor.talks += 1;
    const second = mentorTopics(state, 19);

    expect(first).toHaveLength(5);
    expect(second).toHaveLength(5);
    expect(new Set(first).size).toBe(5);
    expect(second).not.toEqual(first);
    expect(first.some((topic) => ['form', 'coach', 'selection', 'training'].includes(topic))).toBe(true);
  });

  it('answers every topic it offers', () => {
    const { state } = startedCareer({ seed: 78 });
    const mentor = MENTORS[0]!;
    state.mentor = { id: mentor.id, bond: 90, lastTalkWeek: -99, talks: 9, followed: 3 };

    for (const topic of mentorTopics(state, 22)) {
      state.mentor!.lastTalkWeek = -99;
      const reply = talkToMentor(new Rng(3), state, topic, 0.6);
      expect(reply, `${topic} went unanswered`).not.toBeNull();
      expect(reply!.lineKey.length).toBeGreaterThan(0);
    }
  });

  it('gets in touch himself once he knows the player', () => {
    const { state } = startedCareer({ seed: 4242 });
    state.mentor = { id: MENTORS[0]!.id, bond: 40, lastTalkWeek: 0, talks: 0, followed: 0 };
    const ctx = { recentRating: 5.9, minutesPct: 0.1, rumoured: false };

    // Two conversations in, he has not earned the right to ask anything yet.
    const rng = new Rng(5);
    expect(mentorReachesOut(rng, state, ctx)).toBeNull();

    state.mentor.talks = 4;
    let asked: string | null = null;
    for (let i = 0; i < 40 && !asked; i++) {
      state.flags['mentorAskedWeek'] = -99;
      asked = mentorReachesOut(rng, state, ctx);
    }
    expect(asked, 'he never once picked up the phone').not.toBeNull();
    expect(mentorPromptById(asked as never)).toBeDefined();
  });

  it('leaves him alone for a while after asking', () => {
    const { state } = startedCareer({ seed: 4243 });
    state.mentor = { id: MENTORS[0]!.id, bond: 50, lastTalkWeek: 0, talks: 5, followed: 1 };
    state.flags['mentorAskedWeek'] = state.world.season * 52 + state.world.week;
    const rng = new Rng(11);
    for (let i = 0; i < 20; i++) {
      expect(mentorReachesOut(rng, state, { recentRating: 5.5, minutesPct: 0, rumoured: true })).toBeNull();
    }
  });

  it('never asks a question with a free answer', () => {
    for (const prompt of MENTOR_PROMPTS) {
      expect(prompt.answers.length).toBeGreaterThanOrEqual(3);
      const bonds = prompt.answers.map((a) => a.bond);
      // Somewhere in every question there is an answer that costs him closeness.
      expect(Math.min(...bonds), `${prompt.id} has no answer that costs anything`).toBeLessThan(5);
      expect(Math.max(...bonds), `${prompt.id} has no answer worth giving`).toBeGreaterThan(3);
    }
  });
});


describe('the man in the dugout', () => {
  it('gives a new manager his own opinion of an inherited player', () => {
    const { state, index } = startedCareer({ seed: 501 });
    for (let i = 0; i < 20; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
    }
    const first = state.manager;
    expect(first, 'a club without a manager').toBeTruthy();
    expect(first!.name.trim().length, 'a manager with no name').toBeGreaterThan(2);

    // A settled player, and then the man who settled him is gone.
    state.managerTrust = 88;
    state.relationships.manager = 88;
    state.flags['incidentWithManager'] = true;
    const club = state.world.clubs[state.player.clubId!]!;
    appointManager(new Rng(9), state, index, club);

    expect(state.manager!.name, 'the same man walked back in').not.toBe(first!.name);
    expect(state.managerTrust, 'the new man inherited the old one\u2019s opinion').toBeLessThan(80);
    expect(state.relationships.manager).toBe(state.managerTrust);
    expect(state.flags['incidentWithManager'], 'a row with a manager who has left').toBe(false);
  });

  it('leaves a manager alone until a season has actually gone wrong', () => {
    const settled = { weeksInCharge: 60, seasonWeek: 30, boardMood: 55 };
    // Top of the table, where the money says he should be: no pressure, but no manager
    // is ever completely safe either.
    const safe = sackingChance({ ...settled, tablePlace: 0.1, expectedPlace: 0.2 });
    expect(safe).toBeLessThan(0.003);
    // August, however bad it looks.
    expect(sackingChance({ ...settled, seasonWeek: 6, tablePlace: 0.9, expectedPlace: 0.2 })).toBe(0);
    // A month in the job.
    expect(sackingChance({ ...settled, weeksInCharge: 4, tablePlace: 0.9, expectedPlace: 0.2 })).toBe(0);
    // Bottom four with a squad built for Europe, and a board that has run out of patience.
    expect(sackingChance({ ...settled, tablePlace: 0.92, expectedPlace: 0.15, boardMood: 20 })).toBeGreaterThan(0);
  });
});

describe('his own contract', () => {
  /**
   * A career walked - moving when somebody comes in for him, the way one does - until
   * the club he is at puts a new contract in front of him.
   */
  const walk = (seed: number) => {
    const { state, index } = startedCareer({ seed });
    let decision;
    for (let i = 0; i < 53 * 12 && !state.retired && !decision; i++) {
      playWeek(state, index);
      for (const pending of [...state.pendingDecisions]) {
        if (pending.eventId === 'contractRenewal') { decision = pending; break; }
        if (pending.kind === 'transfer') {
          answerOffer(state, index, pending.id, state.transferOffers[0]?.id ?? null);
        }
      }
      if (!decision) state.pendingDecisions = [];
    }
    return { state, index, decision };
  };

  /**
   * Not every career runs a contract down at the club he is at - most players move
   * before it gets that far - so the first seed that does is the one the test uses.
   */
  const upForRenewal = (from: number) => {
    for (let seed = from; seed < from + 8; seed++) {
      const walked = walk(seed);
      if (walked.decision) return walked;
    }
    throw new Error('no career in eight reached a contract renewal');
  };

  it('puts the club\u2019s terms to him instead of signing them for him', () => {
    const { state, index, decision } = upForRenewal(77);
    expect(decision, 'twelve seasons and the club never once asked him to re-sign').toBeTruthy();
    expect(decision!.options.map((option) => option.id)).toEqual(['sign', 'pushForMore', 'runItDown']);
    // The terms he is shown are the terms he gets: a club that has had a bad season from
    // him is allowed to offer less, and the question is that it is put to him at all.
    const offered = Number(decision!.textArgs!['salary']);
    expect(offered).toBeGreaterThan(0);

    const result = answerContractRenewal(state, index, decision!.id, 'sign');
    expect(result).toBeTruthy();
    expect(state.contract!.salaryPerWeek, 'he signed something other than the offer').toBe(offered);
    expect(state.contract!.endSeason).toBeGreaterThan(state.world.season);
  });

  it('lets him walk away, and then he is somebody else\u2019s problem', () => {
    const { state, index, decision } = upForRenewal(96);
    expect(decision).toBeTruthy();
    answerContractRenewal(state, index, decision!.id, 'runItDown');
    expect(state.contract, 'he refused and is still under contract').toBeNull();
    expect(state.player.clubId).toBeNull();
  });

  it('signs the offer for him if he never answers it, rather than losing him a club', () => {
    const { state, index, decision } = upForRenewal(77);
    expect(decision).toBeTruthy();
    const club = state.player.clubId;
    // He leaves it in the inbox. The club takes silence for a signature.
    for (let i = 0; i < 8 && state.pendingDecisions.some((d) => d.id === decision!.id); i++) {
      playWeek(state, index);
    }
    expect(state.pendingDecisions.some((d) => d.id === decision!.id), 'the question never expired').toBe(false);
    expect(state.player.clubId, 'silence cost him his club').toBe(club);
    expect(state.contract!.endSeason).toBeGreaterThanOrEqual(state.world.season);
  });
});

describe('the shirt he is fighting for', () => {
  it('names the man ahead of him rather than a hidden number', () => {
    const { state, index } = startedCareer({ seed: 96 });
    for (let i = 0; i < 90 && state.player.squadRole === 'academy'; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
    }
    if (state.player.squadRole === 'academy') return;   // still a boy on this seed

    const rival = shirtRival(state);
    if (!rival) return;                                  // nobody else plays there
    const squad = userSquad(state);
    expect(squad.some((mate) => mate.id === rival.playerId), 'a rival who is not at the club').toBe(true);
    expect(rival.name.trim().length).toBeGreaterThan(2);
    expect(rival.position).toBe(state.player.primaryPos);
  });
});

describe('what a career was worth', () => {
  it('does not call an ordinary professional one of the greatest', () => {
    const { state } = startedCareer({ seed: 12 });
    const season = (ovr: number, apps: number, goals: number) => ({
      season: 2030, clubId: 'x', competitionId: 'y', apps, starts: apps, subApps: 0,
      minutes: apps * 80, goals, assists: goals, cleanSheets: 0, yellowCards: 0, redCards: 0,
      motm: 0, ratingSum: apps * 6.8, ratedApps: apps, age: 26, ovrStart: ovr, ovrEnd: ovr,
      valueStart: 0, valueEnd: 0, leaguePosition: 8, trophies: [],
    });

    // Fifteen honest seasons in a modest league, no trophies, no caps.
    state.seasonHistory = Array.from({ length: 15 }, () => season(63, 32, 4));
    state.trophies = [];
    state.nationalTeam.caps = 0;
    state.player.fame = 30;
    const journeyman = computeCareerScore(state);
    expect(journeyman, `an ordinary career scored ${journeyman}`).toBeLessThan(60);
    expect(careerStatus(journeyman)).not.toBe('goatCandidate');

    // And the other end of it: the best player in the world, everywhere, for a decade.
    state.seasonHistory = Array.from({ length: 18 }, () => season(93, 45, 30));
    state.trophies = Array.from({ length: 20 }, () => ({ season: 2030, competitionId: 'x', kind: 'league' as const }));
    state.nationalTeam.caps = 120;
    state.awards = Array.from({ length: 6 }, () => ({ season: 2030, award: 'ballonDOr' }));
    state.player.fame = 99;
    const great = computeCareerScore(state);
    expect(great, `the greatest of all time scored ${great}`).toBeGreaterThan(90);
    expect(great).toBeGreaterThan(journeyman + 30);
  });
});


describe('the week before the match', () => {
  it('reads a side off the players it actually has', () => {
    const { state, index } = startedCareer({ seed: 55 });
    for (let i = 0; i < 53 * 4 && state.player.squadRole === 'academy'; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
    }
    let preparation = matchPreparation(state, index);
    for (let i = 0; i < 60 && !preparation; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
      preparation = matchPreparation(state, index);
    }
    expect(preparation, 'a season of fixtures and never a report on any of them').toBeTruthy();

    const report = preparation!.report;
    expect(report.clubName.length).toBeGreaterThan(1);
    expect(Object.keys(FORMATIONS)).toContain(report.formation);
    expect(report.rating).toBeGreaterThan(20);
    // Every job on offer has to be one his position could actually do.
    const group = positionGroup(state.player.primaryPos);
    for (const option of preparation!.options) {
      expect(MATCH_PLANS[option.id].groups, `${option.id} is not a job for a ${group}`).toContain(group);
    }
    expect(preparation!.options.length).toBeGreaterThan(1);
    // Sorted best read first, and the staff pick agrees with the top of that list.
    expect(preparation!.options[0]!.fit).toBeGreaterThanOrEqual(preparation!.options.at(-1)!.fit);
    expect(preparation!.options.some((option) => option.id === preparation!.recommended)).toBe(true);
  });

  it('rewards a plan that counters them and punishes one that does not', () => {
    const quick: OpponentReport = {
      clubId: 'x', clubName: 'X', formation: '4-3-3', rating: 70, gap: 0,
      threat: 'pace', weakness: 'none', dangerMan: null, marker: null, home: false,
    };
    // Sitting in is the answer to pace; pushing the line up is how you get run behind.
    expect(planFit(MATCH_PLANS.stayGoalside, quick)).toBeGreaterThan(0);
    expect(planFit(MATCH_PLANS.stepUpAndSqueeze, quick)).toBeLessThan(0);

    const slow: OpponentReport = { ...quick, threat: 'possession', weakness: 'slowDefence' };
    expect(planFit(MATCH_PLANS.runTheChannels, slow)).toBeGreaterThan(0.5);

    // And being right is worth something the match engine can see.
    const sharp = planEffect(MATCH_PLANS.runTheChannels, planFit(MATCH_PLANS.runTheChannels, slow));
    const blunt = planEffect(MATCH_PLANS.runTheChannels, -1);
    expect(sharp.involvement).toBeGreaterThan(blunt.involvement);
    expect(sharp.conversion).toBeGreaterThan(blunt.conversion);
    // The running still has to be done either way.
    expect(sharp.fatigue).toBe(blunt.fatigue);
  });

  it('keeps a plan for the fixture it was chosen for and no longer', () => {
    const { state, index } = startedCareer({ seed: 55 });
    for (let i = 0; i < 53 * 4 && state.player.squadRole === 'academy'; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
    }
    let preparation = matchPreparation(state, index);
    for (let i = 0; i < 60 && !preparation; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
      preparation = matchPreparation(state, index);
    }
    if (!preparation) return;

    const plan = preparation.options[0]!.id;
    expect(setMatchPlan(state, index, plan)).toBe(true);
    expect(state.matchPlan).toEqual({ key: preparation.key, plan });
    expect(matchPreparation(state, index)!.chosen).toBe(plan);

    // Play the match it belonged to. The plan is spent.
    for (let i = 0; i < 4 && state.matchPlan; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
    }
    expect(state.matchPlan, 'a plan carried into somebody else\u2019s fixture').toBeUndefined();
  });

  it('puts a man in the opposite shirt and says who won', () => {
    const { state, index } = startedCareer({ seed: 55 });
    let duels = 0;
    for (let i = 0; i < 53 * 8 && duels === 0; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
      for (const match of state.matchLog) {
        const duel = match.userLine?.duel;
        if (!duel) continue;
        duels++;
        expect(duel.name.trim().length, 'a duel against nobody').toBeGreaterThan(2);
        expect(typeof duel.won).toBe('boolean');
      }
    }
    expect(duels, 'eight seasons and never a direct opponent').toBeGreaterThan(0);
  });
});


describe('the boys he came through with', () => {
  it('keeps them when everybody else in the world is thrown away', () => {
    const { state, index } = startedCareer({ seed: 96 });
    const tracked = state.world.tracked ?? [];
    expect(tracked.length, 'nobody from his own year is being followed').toBe(TRACKED_PEERS);
    expect(tracked.length).toBeLessThanOrEqual(TRACKED_LIMIT);
    for (const id of tracked) {
      const peer = state.world.players[id];
      expect(peer, `a tracked player who does not exist: ${id}`).toBeTruthy();
      expect(peer!.career).toBeTruthy();
      expect(peer!.id).not.toBe(state.player.id);
    }

    // Six seasons of squad rebuilds, summer windows and retirements.
    for (let i = 0; i < 53 * 6 && !state.retired; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
    }
    for (const id of tracked) {
      expect(state.world.players[id], `the world forgot ${id}`).toBeTruthy();
    }
  });

  it('gives them careers that add up and move around', () => {
    const { state, index } = startedCareer({ seed: 96 });
    for (let i = 0; i < 53 * 10 && !state.retired; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
    }

    const table = peers(state);
    // His year, plus anybody the career ran into and started following.
    expect(table.length).toBeGreaterThanOrEqual(TRACKED_PEERS);
    expect(table.filter((peer) => peer.sameYear).length).toBe(TRACKED_PEERS);
    expect(table.some((peer) => peer.apps > 40), 'ten seasons and nobody played 40 games').toBe(true);
    expect(table.some((peer) => peer.goals > 0)).toBe(true);
    // Sorted by what a career is worth, and every line names a real club or an ending.
    for (const peer of table) {
      expect(peer.name.trim().length).toBeGreaterThan(2);
      expect(peer.clubName.length > 0 || peer.retired).toBe(true);
    }
    const moved = (state.world.tracked ?? [])
      .map((id) => state.world.players[id]?.career?.spells.length ?? 0);
    expect(Math.max(...moved), 'nobody in his year ever changed club').toBeGreaterThan(1);
  });

  it('writes one spell per club, not one per season', () => {
    const career = emptyCareer(2026);
    recordSeason(career, 2026, 'a', { apps: 30, goals: 5, assists: 2, ovr: 60 });
    recordSeason(career, 2027, 'a', { apps: 28, goals: 7, assists: 3, ovr: 64, trophies: 1 });
    recordSeason(career, 2028, 'b', { apps: 20, goals: 2, assists: 1, ovr: 66 });

    expect(career.spells.length).toBe(2);
    expect(career.spells[0]).toMatchObject({ clubId: 'a', fromSeason: 2026, toSeason: 2027, apps: 58, goals: 12 });
    expect(career.apps).toBe(78);
    expect(career.goals).toBe(14);
    expect(career.trophies).toBe(1);
    expect(career.peakOvr).toBe(66);
  });
});


describe('senior football stays senior football', () => {
  it('never puts a player with a senior shirt back in the age group', () => {
    for (const seed of [11, 233]) {
      const { state, index } = startedCareer({ seed });
      const seen = new Set<string>();
      for (let i = 0; i < 53 * 6 && !state.retired; i++) {
        playWeek(state, index);
        state.pendingDecisions = [];
        const senior = !['academy', 'futureProspect', 'prospect', 'fringe'].includes(state.player.squadRole);
        const onLoan = Boolean(state.contract?.isLoan);
        for (const match of state.matchLog) {
          if (seen.has(match.id)) continue;
          seen.add(match.id);
          if (!match.competitionId.endsWith('.youth') || !match.userLine?.played) continue;
          expect(
            senior || onLoan,
            `a ${state.player.squadRole}${onLoan ? ' on loan' : ''} played ${match.competitionId}`,
          ).toBe(false);
        }
      }
    }
  });

  it('does not read a first-team regular as a boy who never plays in July', () => {
    const { state, index } = startedCareer({ seed: 233 });
    // A season of senior football behind him, and a new season that has not started.
    state.seasonHistory.push({
      season: state.world.season - 1, clubId: state.player.clubId, competitionId: null,
      apps: 30, starts: 28, subApps: 2, minutes: 2500, goals: 6, assists: 4, cleanSheets: 0,
      yellowCards: 2, redCards: 0, motm: 2, ratingSum: 210, ratedApps: 30,
      age: 18, ovrStart: 60, ovrEnd: 66, valueStart: 0, valueEnd: 0, leaguePosition: 5, trophies: [],
    });
    state.world.seasonStats[state.player.id] = {
      ...state.world.seasonStats[state.player.id]!,
      apps: 0, minutes: 0,
    };
    expect(minutesPct(state), 'the season has not started, so this is zero').toBe(0);
    expect(recentMinutesShare(state), 'and last season says otherwise').toBeGreaterThan(0.5);
    void index;
  });

  it('says on every offer which side of the club is signing him', () => {
    const { state, index } = startedCareer({ seed: 96 });
    let offers = 0;
    for (let i = 0; i < 53 * 8 && offers < 6 && !state.retired; i++) {
      playWeek(state, index);
      for (const offer of state.transferOffers) {
        offers++;
        expect(offer.joinAs, 'an offer that does not say who is signing him').toBeTruthy();
        // A loan is senior football by definition; nobody is loaned into an academy.
        if (offer.isLoan) expect(offer.joinAs).toBe('senior');
      }
      state.pendingDecisions = [];
      state.transferOffers = [];
    }
    expect(offers, 'eight seasons and nobody came in for him').toBeGreaterThan(0);
  });
});


describe('nobody rings a first-team player about a step down', () => {
  it('offers a regular nothing below the level he already has', () => {
    const pack = loadPack();
    const compById = new Map(pack.competitions.map((competition) => [competition.id, competition]));
    let offers = 0;
    for (const seed of [55, 123, 233]) {
      const { state, index } = startedCareer({ seed });
      for (let i = 0; i < 53 * 8 && !state.retired; i++) {
        playWeek(state, index);
        const club = state.player.clubId ? state.world.clubs[state.player.clubId] : undefined;
        const comp = club ? compById.get(club.competitionId) : undefined;
        // A club that has told him he can leave is allowed to be the last one calling.
        const free = Boolean(state.flags['transferListed']) || Boolean(state.flags['openToLowerLeague']);
        const established = state.player.squadRole !== 'academy'
          && (recentMinutesShare(state) >= 0.45
            || ['starter', 'important', 'key', 'star'].includes(state.player.squadRole));
        if (club && comp && established && !free) {
          for (const offer of state.transferOffers) {
            offers++;
            const to = state.world.clubs[offer.clubId]!;
            const toComp = compById.get(to.competitionId);
            expect(
              to.tier <= club.tier,
              `a regular at ${club.name} (tier ${club.tier}) was offered ${to.name} (tier ${to.tier})`,
            ).toBe(true);
            expect(
              (toComp?.reputation ?? 0) >= comp.reputation - 2,
              `a regular in ${comp.name} was offered a move to ${toComp?.name}`,
            ).toBe(true);
            // And never into somebody's age group.
            expect(offer.joinAs).toBe('senior');
          }
        }
        state.transferOffers = [];
        state.pendingDecisions = [];
      }
    }
    expect(offers, 'no offers were made to an established player at all').toBeGreaterThan(0);
  });

  it('does not offer a loan to a player who is already in the first team', () => {
    const { state, index } = startedCareer({ seed: 233 });
    for (let i = 0; i < 53 * 8 && !state.retired; i++) {
      playWeek(state, index);
      const firstTeam = ['starter', 'important', 'key', 'star'].includes(state.player.squadRole);
      for (const offer of state.transferOffers) {
        if (!offer.isLoan) continue;
        expect(firstTeam, `a ${state.player.squadRole} was offered a loan to ${offer.clubId}`).toBe(false);
      }
      state.transferOffers = [];
      state.pendingDecisions = [];
    }
  });
});


describe('what a boy is offered', () => {
  it('never offers him a worse academy, and never sells him at sixteen', () => {
    let academy = 0;
    let senior = 0;
    for (const seed of [11, 4242, 96]) {
      const { state, index } = startedCareer({ seed });
      for (let i = 0; i < 53 * 5 && !state.retired; i++) {
        playWeek(state, index);
        if (state.player.squadRole === 'academy' && state.transferOffers.length > 0) {
          const club = state.world.clubs[state.player.clubId!]!;
          const age = state.world.season - state.player.birthYear;
          for (const offer of state.transferOffers) {
            const to = state.world.clubs[offer.clubId]!;
            // Every offer says which team is signing him and how it compares.
            expect(offer.joinAs, 'an offer to a boy that does not say which side').toBeTruthy();
            expect(offer.levelStep, 'an offer that does not say what level it is').toBeTruthy();

            if (offer.joinAs === 'academy') {
              academy++;
              const step = (to.academy - club.academy) * 0.6 + (clubBaseOvr(to) - clubBaseOvr(club)) * 0.4;
              expect(step, `${to.name} is a worse academy than ${club.name}`).toBeGreaterThanOrEqual(0);
              expect(to.tier, 'an academy a division below his own').toBeLessThanOrEqual(club.tier);
            } else {
              senior++;
              // Men's football is a real move for a boy, but not at sixteen, and not
              // while his own first team has already asked to see him.
              expect(age, 'a sixteen year old was offered a senior move').toBeGreaterThanOrEqual(17);
              if (age < 18) {
                expect(Boolean(state.flags['calledUpToSeniors']), 'sold down a division while the first team was looking at him').toBe(false);
              }
              expect(offer.expectedMinutesPct, 'a senior move that is not even for minutes').toBeGreaterThanOrEqual(0.4);
            }
          }
          state.transferOffers = [];
        }
        state.pendingDecisions = [];
      }
    }
    expect(academy + senior, 'no boy in three careers was ever approached').toBeGreaterThan(0);
  });
});


describe('the order things arrive in', () => {
  it('asks what the fixture means before the fixture, and reacts to it afterwards', () => {
    const OCCASION = ['derby', 'rivalMatch', 'bigMatch', 'againstOldClub'];
    const REACTION = ['hatTrick', 'sentOff', 'punditCriticism', 'badRun', 'goalDrought'];
    for (const seed of [11, 48]) {
      const { state, index } = startedCareer({ seed });
      const seenMatches = new Set<string>();
      let played = 0;
      // One interruption at a time rather than one week at a time: a week stops several
      // times and the order inside it is the whole question.
      for (let i = 0; i < 53 * 6 * 3 && !state.retired; i++) {
        const before = played;
        const result = advanceWeek(state, index);
        if (result.stopped === 'halfTime' && state.pendingHalfTime) {
          const held = state.pendingHalfTime;
          resumeHalfTime(state, index, held.demand ?? held.options[0]!);
        }
        for (const match of state.matchLog) {
          if (seenMatches.has(match.id)) continue;
          seenMatches.add(match.id);
          if (match.userLine?.played && !match.competitionId.startsWith('friendly')) played++;
        }
        const playedThisWeek = played > before;

        for (const decision of state.pendingDecisions) {
          if (!decision.eventId.startsWith('milestone:')) continue;
          const id = decision.eventId.replace('milestone:', '');
          if (OCCASION.includes(id) && playedThisWeek) {
            throw new Error(`asked what the ${id} meant to him after he had played it`);
          }
          if (REACTION.includes(id) && played === 0) {
            throw new Error(`asked him to react to ${id} before he had played a match`);
          }
        }
        state.pendingDecisions = [];
      }
      expect(played, 'six seasons and no competitive football').toBeGreaterThan(0);
    }
  });

  it('never writes two letters with the same name on them', () => {
    const { state, index } = startedCareer({ seed: 96 });
    const ids = new Set<string>();
    for (let i = 0; i < 53 * 8 && !state.retired; i++) {
      playWeek(state, index);
      state.pendingDecisions = [];
      for (const message of state.inbox) ids.add(message.id);
    }
    // Every message that has ever been in the mailbox had its own id: the screen keys on
    // it, the read marker uses it, and a decision hangs off it.
    const seen = new Map<string, number>();
    for (const message of state.inbox) {
      seen.set(message.id, (seen.get(message.id) ?? 0) + 1);
    }
    for (const [id, count] of seen) {
      expect(count, `two letters share the id ${id}`).toBe(1);
    }
    expect(ids.size).toBeGreaterThan(50);
  });
});
