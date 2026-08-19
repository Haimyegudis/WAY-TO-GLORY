import { describe, expect, it } from 'vitest';
import { Rng, clamp, interpolate } from '../src/rng.js';
import { overall, ratingAt, skillProfile, skillRating, tacticalFit } from '../src/positions.js';
import { createEuroCompetition, qualifiersFromLeaguePhase } from '../src/europe.js';
import { playTournament, tournamentFor } from '../src/tournament.js';
import { ageFactor, developWeek, headroom, updateCondition } from '../src/development.js';
import { availableActions, evaluateConsequences, isFrozenOut, performAction } from '../src/social.js';
import { buildAttributes, generatePlayer } from '../src/generate.js';
import { pickLineup, selectionScore } from '../src/selection.js';
import { applyResult, buildFixtures, sortedTable, initCompetitionSeason } from '../src/league.js';
import { deserialize, serialize } from '../src/save.js';
import { MILESTONES, applyMilestoneAnswer, milestoneById } from '../src/milestones.js';
import type { MilestoneId } from '../src/milestones.js';
import { generateOffers, isTransferWindow } from '../src/transfer.js';
import { indexPack, validatePack } from '../src/data.js';
import {
  advanceWeek,
  answerMedia,
  createCareer,
  currentOvr,
  getAcademyOffers,
  joinClub,
  mentalFactor,
  userSquad,
} from '../src/career.js';
import { DEFAULT_INPUT, loadPack, startedCareer } from './helpers.js';
import type { Player, Position, TrainingPlan } from '../src/types.js';

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
        advanceWeek(state, index);
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
      advanceWeek(state, index);
      state.pendingDecisions = [];
      if (state.player.squadRole !== 'academy') promoted = true;
    }
    expect(promoted).toBe(true);
  });

  it('keeps the world sane over five seasons', () => {
    const { state, index } = startedCareer({ seed: 31337 });
    for (let i = 0; i < 52 * 5; i++) {
      advanceWeek(state, index);
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
      advanceWeek(state, index);
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
    for (let i = 0; i < 53; i++) advanceWeek(state, index);

    const winners = state.world.history.europeanWinners ?? [];
    const tiers = new Set(winners.map((w) => w.tier));
    expect(winners.length).toBeGreaterThanOrEqual(3);
    expect(tiers.has('ucl')).toBe(true);
    expect(tiers.has('uel')).toBe(true);
  });

  it('qualifies clubs from the league table, not at random', () => {
    const { state, index } = startedCareer({ seed: 22 });
    for (let i = 0; i < 53; i++) advanceWeek(state, index);

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

describe('awards', () => {
  it('hands out the honours every season and names a winner', () => {
    const { state, index } = startedCareer({ seed: 23 });
    for (let i = 0; i < 53 * 2; i++) advanceWeek(state, index);

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
    const { state } = startedCareer();
    const decision = askHim(state, 'debut');
    const result = answerMedia(state, decision.id, decision.options[0]!.id);

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
    const { state } = startedCareer();
    const decision = askHim(state, 'derby');
    expect(answerMedia(state, decision.id, 'nothing-he-said')).toBeNull();
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
