import { describe, expect, it } from 'vitest';
import { Rng, clamp, interpolate } from '../src/rng.js';
import { overall, ratingAt, skillProfile, skillRating, tacticalFit } from '../src/positions.js';
import { createEuroCompetition, qualifiersFromLeaguePhase } from '../src/europe.js';
import { playTournament, tournamentFor } from '../src/tournament.js';
import { ageFactor, developWeek, headroom, updateCondition } from '../src/development.js';
import { availableActions, evaluateConsequences, isFrozenOut, performAction } from '../src/social.js';
import { buildAttributes, generatePlayer } from '../src/generate.js';
import { CAMEO_MINUTES, eligibleForSenior, pickLineup, selectionScore } from '../src/selection.js';
import { applyResult, buildFixtures, sortedTable, initCompetitionSeason } from '../src/league.js';
import { deserialize, serialize } from '../src/save.js';
import { YOUTH_MAX_AGE, countryLeagues, userYouthCompetition, userYouthCompetitionId, youthCompetitionId } from '../src/youth.js';
import { YOUTH_SQUAD_SIZE, generateYouthSquad, youthSquad } from '../src/youth-squads.js';
import { HALF_TIME_INSTRUCTIONS, instructionsFor, managerDemand, managerDictates } from '../src/halftime.js';
import { simulateUserMatch, type UserMatchContext } from '../src/match.js';
import { MILESTONES, applyMilestoneAnswer, milestoneById } from '../src/milestones.js';
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
import { generateOffers, isTransferWindow } from '../src/transfer.js';
import { clubBaseOvr } from '../src/generate.js';
import { indexPack, validatePack } from '../src/data.js';
import { initNationalTeam, levelForAge, updateNationalInterest } from '../src/national.js';
import {
  SCHEMA_VERSION,
  advanceWeek,
  answerMedia,
  createCareer,
  grudgeClubId,
  resumeHalfTime,
  currentOvr,
  getAcademyOffers,
  joinClub,
  mentalFactor,
  userSquad,
} from '../src/career.js';
import { DEFAULT_INPUT, loadPack, playWeek, startedCareer } from './helpers.js';
import type { CompetitionSeasonState, Player, Position, TrainingPlan } from '../src/types.js';

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

    // A low number on its own is a mood, not a reason: apologising to a dressing room
    // that has not fallen out with you is the sort of thing that made the screen read
    // like a list of buttons rather than a week in a life.
    state.relationships.teammates = 30;
    expect(availableActions(state).map((a) => a.id)).not.toContain('apologiseTeammates');

    // Something actually happening is what puts it on the table.
    state.flags['dressingRoomFallout'] = true;
    expect(availableActions(state).map((a) => a.id)).toContain('apologiseTeammates');
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
  it('shows an academy signing all three youth-team camp friendlies', () => {
    const { state, index } = createCareer(loadPack(), { ...DEFAULT_INPUT, age: 16, seed: 6059 });
    const clubId = getAcademyOffers(state, index)[0]!.clubId;
    joinClub(state, index, clubId, { asAcademy: true });

    expect(state.flags[`trainingCamp:${state.world.season}`]).toBe(true);
    for (let week = 1; week <= 3; week++) {
      expect(state.flags[`campOpponent:${state.world.season}:${week}`]).toBeTruthy();
      playWeek(state, index);
    }

    const camp = state.matchLog.filter((match) => match.competitionId === 'friendly.youth');
    expect(camp).toHaveLength(3);
    expect(camp.every((match) => match.userLine?.played)).toBe(true);
    expect(state.flags[`campVerdict:${state.world.season}`]).toBeTruthy();
  });

  it('evaluates a new senior in three friendlies before competitive football', () => {
    const { state, index } = createCareer(loadPack(), { ...DEFAULT_INPUT, age: 19, seed: 6060 });
    const clubId = getAcademyOffers(state, index)[0]!.clubId;
    joinClub(state, index, clubId, { role: 'rotation' });
    const trustBefore = state.managerTrust;

    for (let week = 1; week <= 3; week++) playWeek(state, index);

    const camp = state.matchLog.filter((match) => match.competitionId === 'friendly');
    expect(camp).toHaveLength(3);
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
    expect(state.pendingDecisions.some((decision) => decision.eventId === 'milestone:bigMatch')).toBe(true);
    expect(state.inbox.some((message) => message.titleKey === 'inbox.buildUp.cupFinal')).toBe(true);
  });

  it('asks about a European night before the European fixture is played', () => {
    const { state, index, clubId } = seniorCareer(8102);
    state.world.week = 19;
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
    expect(state.pendingDecisions.some((decision) => decision.eventId === 'milestone:bigMatch')).toBe(true);
    expect(state.inbox.some((message) => message.titleKey === 'inbox.buildUp.europeanNight')).toBe(true);
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
    expect(state.inbox.some((message) => message.titleKey.startsWith('inbox.buildUp.'))).toBe(false);
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
  function askHim(state: ReturnType<typeof startedCareer>['state'], id: 'debut' | 'derby') {
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

    const watched = held.firstHalfEvents.map((e) => [e.minute, e.type, e.detailKey ?? '']);
    const resumed = resumeHalfTime(state, index, held.options[0]!);

    expect(resumed.stopped).not.toBe('halfTime');
    expect(state.pendingHalfTime).toBeUndefined();
    expect(state.lastMatch).not.toBeNull();
    expect(
      state.lastMatch!.events!.filter((e) => e.minute <= 45).map((e) => [e.minute, e.type, e.detailKey ?? '']),
      'the half he watched changed under him',
    ).toEqual(watched);
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
      const carrying = state.player.condition.injuries.length > 0
        || state.player.condition.suspensions.some((ban) => ban.matchesRemaining > 0);
      const before = state.matchLog.length;
      const result = advanceWeek(state, index);
      state.pendingDecisions = [];
      if (result.stopped === 'halfTime' && state.pendingHalfTime) {
        const held = state.pendingHalfTime;
        resumeHalfTime(state, index, held.demand ?? held.options[0]!);
      }
      if (!carrying) continue;
      injuredWeeks++;
      for (const match of state.matchLog.slice(0, state.matchLog.length - before)) {
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
      expect(state.pendingHalfTime, 'the interval was still on the table after it was answered').toBeUndefined();
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
    expect(losing.every((id) => id === 'pushForward' || id === 'takeThemOn')).toBe(true);
    expect(winning.every((id) => id === 'holdShape' || id === 'saveLegs')).toBe(true);
  });

  it('does not ask a goalkeeper to run at the full-back', () => {
    expect(instructionsFor('GK')).not.toContain('takeThemOn');
    expect(instructionsFor('ATT')).toContain('takeThemOn');
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
        if (match.competitionId.endsWith('.youth')) continue;
        const line = match.userLine;
        if (!line?.played) continue;
        const ageThen = match.season - state.player.birthYear;
        if (ageThen >= 18) continue;
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
