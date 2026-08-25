/**
 * The people a career is lived with.
 *
 * A footballer's numbers were all this game kept: form, morale, five relationship
 * scales. The things that make those numbers matter - the boy from his own year he is
 * measured against for twenty years, the two men in the dressing room who are actually
 * his friends, the family a move abroad uproots, the promise a manager made him in
 * August and remembers in January, the stands deciding he is theirs, the old king
 * whose crown falls to somebody - lived nowhere. This module owns them.
 *
 * Everything here rides on infrastructure that already exists: the rival is a tracked
 * peer (peers.ts keeps him alive for good), friends are real members of real squads,
 * promises are read against the same season stats the rest of the game trusts, and
 * every decision resolves through the generic event engine - options, effects,
 * gambles - so the app needed no new plumbing to ask any of these questions.
 */
import { Rng, clamp } from './rng.js';
import { positionGroup, ratingAt } from './positions.js';
import { FIRST_MATCH_WEEK, LAST_MATCH_WEEK } from './league.js';
import type { PackIndex } from './data.js';
import type {
  CareerState, Club, InboxMessage, MatchResult, PendingDecision, Player, StoryState,
} from './types.js';

type Push = (
  state: CareerState,
  category: InboxMessage['category'],
  titleKey: string,
  args?: Record<string, string | number>,
  decisionId?: string,
) => void;
type News = (state: CareerState, key: string, args: Record<string, string | number>, weight: 'low' | 'medium' | 'high') => void;

export interface StoryHooks {
  pushInbox: Push;
  pushNews: News;
}

export interface StoryWeekInput {
  state: CareerState;
  index: PackIndex;
  rng: Rng;
  club: Club | undefined;
  userMatch: MatchResult | undefined;
  hooks: StoryHooks;
}

function story(state: CareerState): StoryState {
  if (!state.story) state.story = {};
  return state.story;
}

function fullName(player: Player): string {
  return `${player.firstName} ${player.lastName}`;
}

function userOvr(state: CareerState): number {
  return ratingAt(state.player.attributes, state.player.primaryPos);
}

function absoluteWeek(state: CareerState): number {
  return state.world.season * 52 + state.world.week;
}

function inSeason(state: CareerState): boolean {
  return state.world.week >= FIRST_MATCH_WEEK && state.world.week <= LAST_MATCH_WEEK;
}

function openStoryDecision(
  state: CareerState,
  id: string,
  decision: Omit<PendingDecision, 'id' | 'kind' | 'eventId'>,
  hooks: StoryHooks,
  inboxCategory: InboxMessage['category'],
): void {
  const decisionId = `story_${id}_${state.world.season}_${state.world.week}`;
  if (state.pendingDecisions.some((pending) => pending.eventId === `story:${id}`)) return;
  state.pendingDecisions.push({
    ...decision,
    id: decisionId,
    kind: 'event',
    eventId: `story:${id}`,
  });
  hooks.pushInbox(state, inboxCategory, decision.textKey, decision.textArgs, decisionId);
}

/* ------------------------------------------------------------------ rival */

/**
 * The boy he is measured against.
 *
 * Chosen once, from his own tracked year: same kind of footballer, the biggest
 * promise. He is not an enemy - some weeks he is a friend - but for twenty years
 * every paper that prints one of their names prints the other.
 */
function ensureRival(state: CareerState, rng: Rng): Player | undefined {
  const s = story(state);
  if (s.rivalId) {
    const rival = state.world.players[s.rivalId];
    return rival && !rival.retired ? rival : undefined;
  }
  const tracked = (state.world.tracked ?? [])
    .map((id) => state.world.players[id])
    .filter((p): p is Player => Boolean(p && !p.isUser && !p.retired));
  if (tracked.length === 0) return undefined;
  const group = positionGroup(state.player.primaryPos);
  const pool = tracked.filter((p) => positionGroup(p.primaryPos) === group);
  const from = pool.length > 0 ? pool : tracked;
  const rival = from
    .slice()
    .sort((a, b) => (b.potential + ratingAt(b.attributes, b.primaryPos)) - (a.potential + ratingAt(a.attributes, a.primaryPos)))[0]!;
  s.rivalId = rival.id;
  s.rivalHeat = 25;
  void rng;
  return rival;
}

function rivalWeek(input: StoryWeekInput): void {
  const { state, rng, userMatch, hooks } = input;
  const s = story(state);
  const rival = ensureRival(state, rng);
  if (!rival) return;
  const name = fullName(rival);

  // Their paths cross: his club is on the other side of Saturday's result.
  if (userMatch?.userLine?.played && rival.clubId
    && (userMatch.homeClubId === rival.clubId || userMatch.awayClubId === rival.clubId)) {
    const mine = userMatch.userLine.rating;
    const heat = clamp((s.rivalHeat ?? 25) + 10, 0, 100);
    s.rivalHeat = heat;
    hooks.pushInbox(state, 'media', mine >= 7.2 ? 'story.rival.faced.won' : 'story.rival.faced.lost', { rival: name });
  }

  // The running comparison, a few times a season, in the paper rather than his post.
  if (inSeason(state) && rng.chance(0.08)) {
    const gap = userOvr(state) - ratingAt(rival.attributes, rival.primaryPos);
    hooks.pushNews(
      state,
      gap >= 2 ? 'story.rival.ahead' : gap <= -2 ? 'story.rival.behind' : 'story.rival.level',
      { rival: name },
      'low',
    );
    if (gap <= -2) s.rivalHeat = clamp((s.rivalHeat ?? 25) + 2, 0, 100);
  }

  // The queue for the shirt they both want.
  if (
    rival.birthCountry === state.player.birthCountry
    && state.nationalTeam.level !== 'senior'
    && ratingAt(rival.attributes, rival.primaryPos) >= userOvr(state) + 3
    && rng.chance(0.03)
  ) {
    hooks.pushNews(state, 'story.rival.nationalQueue', { rival: name }, 'medium');
  }
}

function rivalSeasonEnd(state: CareerState, rng: Rng, hooks: StoryHooks): void {
  const s = story(state);
  if (!s.rivalId) return;
  const rival = state.world.players[s.rivalId];
  if (!rival) return;
  if (rival.retired) {
    if (s.rivalHeat !== 0) {
      hooks.pushInbox(state, 'personal', 'story.rival.retired', { rival: fullName(rival) });
      s.rivalHeat = 0;
    }
    return;
  }
  const spell = rival.career?.spells[rival.career.spells.length - 1];
  const mine = state.world.seasonStats[state.player.id];
  hooks.pushInbox(state, 'media', 'story.rival.seasonReview', {
    rival: fullName(rival),
    club: rival.clubId ? state.world.clubs[rival.clubId]?.name ?? '' : '',
    rivalGoals: spell?.goals ?? 0,
    myGoals: mine?.goals ?? 0,
  });
  void rng;
}

/* ---------------------------------------------------------------- friends */

/**
 * Two of them, from the squad he actually shares a floor with: the senior man who
 * looks out for him, and the boy who thinks he hung the moon. Friendship survives
 * transfers; proximity does not, and the reunion fixture is a different afternoon.
 */
function friendsWeek(input: StoryWeekInput, movedThisWeek: boolean): void {
  const { state, rng, club, userMatch, hooks } = input;
  const s = story(state);
  s.friends = s.friends ?? [];

  // A move: the goodbyes are said before the hellos.
  if (movedThisWeek) {
    for (const friend of s.friends) {
      const mate = state.world.players[friend.id];
      if (mate && friend.bond >= 40) {
        hooks.pushInbox(state, 'personal', 'story.friend.farewell', { name: fullName(mate) });
      }
    }
    s.friends = s.friends.filter((friend) => friend.bond >= 40).slice(0, 2);
  }

  // Making friends where he is. Slowly: nobody arrives with a best man.
  if (club && s.friends.filter((f) => f.clubId === club.id).length === 0 && rng.chance(0.3)) {
    const squad = (state.world.squads[club.id] ?? [])
      .map((id) => state.world.players[id])
      .filter((p): p is Player => Boolean(p && !p.isUser && !p.retired));
    if (squad.length > 0) {
      const season = state.world.season;
      const elder = squad.filter((p) => season - p.birthYear >= 27)
        .sort((a, b) => ratingAt(b.attributes, b.primaryPos) - ratingAt(a.attributes, a.primaryPos))[0];
      const younger = squad.filter((p) => season - p.birthYear <= 22 && p !== elder)[0];
      const pick = elder ?? younger;
      if (pick) {
        const role = pick === elder ? 'captain' : 'prospect';
        s.friends.push({ id: pick.id, clubId: club.id, role, bond: 45 });
        if (s.friends.length > 3) s.friends.shift();
        hooks.pushInbox(state, 'personal', `story.friend.made.${role}`, { name: fullName(pick) });
      }
    }
  }

  // Life together: small, occasional, real.
  for (const friend of s.friends) {
    const mate = state.world.players[friend.id];
    if (!mate) continue;
    if (friend.clubId === state.player.clubId && rng.chance(0.05)) {
      friend.bond = clamp(friend.bond + 4, 0, 100);
      state.relationships.teammates = clamp(state.relationships.teammates + 1, 0, 100);
      state.player.morale = clamp(state.player.morale + 1, 0, 100);
      hooks.pushInbox(state, 'personal', `story.friend.moment.${friend.role}`, { name: fullName(mate) });
    }
    // The reunion fixture: his club against an old friend's new one.
    if (
      friend.clubId !== null
      && friend.clubId !== state.player.clubId
      && userMatch?.userLine?.played
      && (userMatch.homeClubId === friend.clubId || userMatch.awayClubId === friend.clubId)
    ) {
      hooks.pushInbox(state, 'personal', 'story.friend.reunion', { name: fullName(mate) });
    }
  }
}

/* ----------------------------------------------------------------- family */

/**
 * The life the football pays for. Parents at the first professional match, somebody
 * met at twenty, a wedding a career has to schedule, children who do not care what
 * the papers say. None of it blocks a week except the question that should.
 */
function familyWeek(input: StoryWeekInput): void {
  const { state, rng, club, userMatch, hooks } = input;
  const s = story(state);
  s.family = s.family ?? { partner: 'none', kids: 0 };
  const family = s.family;
  const age = state.world.season - state.player.birthYear;

  if (!family.parentsSeen && userMatch?.userLine?.played && state.player.squadRole !== 'academy') {
    family.parentsSeen = true;
    state.player.morale = clamp(state.player.morale + 3, 0, 100);
    hooks.pushInbox(state, 'personal', 'story.family.parentsAtMatch', {});
  }

  if (family.partner === 'none' && age >= 19 && rng.chance(0.02)) {
    family.partner = 'dating';
    hooks.pushInbox(state, 'personal', 'story.family.met', {});
  }

  if (family.partner === 'dating' && age >= 21 && rng.chance(0.015)) {
    openStoryDecision(state, 'propose', {
      category: 'personal',
      textKey: 'story.propose',
      options: [
        {
          id: 'yes',
          labelKey: 'story.propose.yes',
          effects: [
            { kind: 'money', value: -40_000 },
            { kind: 'morale', value: 10 },
            { kind: 'custom', key: 'storyEngaged', value: 1 },
          ],
        },
        { id: 'notYet', labelKey: 'story.propose.notYet', effects: [{ kind: 'morale', value: -3 }] },
      ],
      blocking: false,
    }, hooks, 'personal');
  }
  if (state.flags['storyEngaged']) {
    state.flags['storyEngaged'] = 0;
    family.partner = 'engaged';
  }

  if (family.partner === 'engaged' && rng.chance(0.04)) {
    family.partner = 'married';
    state.player.morale = clamp(state.player.morale + 8, 0, 100);
    hooks.pushInbox(state, 'personal', 'story.family.wedding', {});
    hooks.pushNews(state, 'story.family.weddingNews', { player: fullName(state.player) }, 'low');
  }

  if (family.partner === 'married' && family.kids < 3 && rng.chance(0.012)) {
    family.kids += 1;
    state.player.morale = clamp(state.player.morale + 8, 0, 100);
    hooks.pushInbox(state, 'personal', 'story.family.child', { count: family.kids });
  }

  // A move abroad moves everybody. The week it happens, home says so.
  if (club && club.country !== state.player.birthCountry && family.partner !== 'none'
    && state.flags['storyAbroadClub'] !== club.id) {
    state.flags['storyAbroadClub'] = club.id;
    state.player.morale = clamp(state.player.morale - 4, 0, 100);
    hooks.pushInbox(state, 'personal', 'story.family.abroad', { club: club.name });
  }
}

/* --------------------------------------------------------------- promises */

/**
 * What the manager said in the corridor. A number, a date, and a place in the side:
 * he remembers it, the game holds him to it in both directions, and the letter that
 * settles it names the letter that made it.
 */
function promiseWeek(input: StoryWeekInput): void {
  const { state, rng, club, hooks } = input;
  const s = story(state);
  const stats = state.world.seasonStats[state.player.id];
  const style = state.manager?.style ?? 'pragmatist';

  if (s.promise) {
    // A promise belongs to the mouth that made it. Sacked, it dies with the job.
    if (s.promise.manager && state.manager && s.promise.manager !== state.manager.name) {
      hooks.pushInbox(state, 'manager', 'story.promise.void', { manager: s.promise.manager });
      s.promise = undefined;
      return;
    }
    if (absoluteWeek(state) >= s.promise.deadline) {
      const scored = (stats?.goals ?? 0) - s.promise.baseline;
      const kept = scored >= s.promise.target;
      if (kept) {
        // How much a kept word is worth depends on whose word it was: everything to a
        // gambler who staked his judgement on you, table stakes to a pragmatist.
        const gain = style === 'gambler' ? 16 : style === 'trusting' ? 12 : 10;
        state.relationships.manager = clamp(state.relationships.manager + gain, 0, 100);
        state.managerTrust = state.relationships.manager;
        state.player.morale = clamp(state.player.morale + 8, 0, 100);
        hooks.pushInbox(state, 'manager', `story.promise.kept.${style}`, { goals: scored, target: s.promise.target });
      } else {
        const loss = style === 'gambler' ? 12 : style === 'demanding' ? 10 : style === 'trusting' ? 4 : 6;
        state.relationships.manager = clamp(state.relationships.manager - loss, 0, 100);
        state.managerTrust = state.relationships.manager;
        hooks.pushInbox(state, 'manager', `story.promise.missed.${style}`, { goals: scored, target: s.promise.target });
      }
      s.promise = undefined;
    }
    return;
  }

  // Only a striker's promise for now: goals are the one currency nobody argues with.
  const attacking = positionGroup(state.player.primaryPos) === 'ATT'
    || positionGroup(state.player.primaryPos) === 'MID';
  const offerChance = style === 'gambler' ? 0.06 : style === 'demanding' ? 0.05 : 0.04;
  if (
    club && attacking && inSeason(state) && state.world.week <= LAST_MATCH_WEEK - 14
    && state.player.squadRole !== 'academy'
    && state.relationships.manager >= 35 && state.relationships.manager <= 70
    && rng.chance(offerChance)
  ) {
    const base = positionGroup(state.player.primaryPos) === 'ATT' ? rng.int(4, 6) : rng.int(2, 3);
    // The demanding man asks for more; the trusting one sets a bar you can see over;
    // the gambler names a number that makes the room go quiet.
    const target = Math.max(1, base + (style === 'demanding' ? 1 : style === 'gambler' ? 2 : style === 'trusting' ? -1 : 0));
    s.promise = {
      kind: 'goals',
      target,
      deadline: absoluteWeek(state) + 12,
      baseline: stats?.goals ?? 0,
      manager: state.manager?.name,
    };
    hooks.pushInbox(state, 'manager', `story.promise.made.${style}`, { target });
  }
}

/* ------------------------------------------------------------------- fans */

/**
 * The stands as a person. They write a song once, they turn once a season at most,
 * and when a man who gave them years leaves, they say goodbye properly.
 */
function fansWeek(input: StoryWeekInput, movedThisWeek: boolean, leftClub: Club | undefined): void {
  const { state, rng, userMatch, hooks } = input;
  const s = story(state);
  const fans = state.relationships.fans;

  if (!s.chant && fans >= 72 && userMatch?.userLine?.motm && rng.chance(0.5)) {
    s.chant = true;
    state.player.morale = clamp(state.player.morale + 8, 0, 100);
    state.relationships.fans = clamp(fans + 4, 0, 100);
    hooks.pushInbox(state, 'club', 'story.fans.chant', {});
    hooks.pushNews(state, 'story.fans.chantNews', { player: fullName(state.player) }, 'medium');
  }

  const booedSeason = Number(state.flags['storyBooedSeason'] ?? -1);
  if (fans <= 25 && userMatch?.userLine?.played && booedSeason !== state.world.season) {
    state.flags['storyBooedSeason'] = state.world.season;
    state.player.morale = clamp(state.player.morale - 5, 0, 100);
    hooks.pushInbox(state, 'club', 'story.fans.boos', {});
  }

  if (movedThisWeek && leftClub) {
    const seasonsThere = state.world.season - Number(s.joinedSeason ?? state.world.season);
    if (seasonsThere >= 3 && fans >= 55) {
      hooks.pushInbox(state, 'club', 'story.fans.tifo', { club: leftClub.name });
      hooks.pushNews(state, 'story.fans.tifoNews', { player: fullName(state.player), club: leftClub.name }, 'medium');
    }
  }
}

/* ----------------------------------------------------------------- legend */

/**
 * The old king. Picked once from the world's stars - the best veteran in his own
 * position - and when he goes, the crown does not: the press hands it to whoever
 * looks most like him, and one of the candidates is always the rival.
 */
function ensureLegend(state: CareerState, index: PackIndex): void {
  const s = story(state);
  if (s.legend) return;
  const group = positionGroup(state.player.primaryPos);
  const stars = index.pack.stars
    .filter((star) => star.age >= 31 && star.ovr >= 85)
    .sort((a, b) => b.ovr - a.ovr);
  const sameGroup = stars.filter((star) => positionGroup(star.pos) === group);
  const king = (sameGroup.length > 0 ? sameGroup : stars)[0];
  if (!king) return;
  s.legend = {
    name: `${king.firstName} ${king.lastName}`,
    group: positionGroup(king.pos),
    retireSeason: state.world.season + clamp(37 - king.age, 1, 5),
  };
}

function legendSeasonEnd(state: CareerState, rng: Rng, hooks: StoryHooks): void {
  const s = story(state);
  const legend = s.legend;
  if (!legend || legend.settled) return;
  if (state.world.season < legend.retireSeason) return;
  legend.settled = true;
  hooks.pushNews(state, 'story.legend.retired', { legend: legend.name }, 'high');

  const rival = s.rivalId ? state.world.players[s.rivalId] : undefined;
  const sameGroup = positionGroup(state.player.primaryPos) === legend.group;
  if (sameGroup && state.player.reputation >= 60) {
    state.player.reputation = clamp(state.player.reputation + 4, 0, 100);
    state.player.fame = clamp(state.player.fame + 4, 0, 100);
    hooks.pushInbox(state, 'media', 'story.legend.heir', { legend: legend.name });
  } else if (rival && !rival.retired && ratingAt(rival.attributes, rival.primaryPos) >= userOvr(state) + 2) {
    s.rivalHeat = clamp((s.rivalHeat ?? 25) + 12, 0, 100);
    hooks.pushNews(state, 'story.legend.rivalCrowned', { legend: legend.name, rival: fullName(rival) }, 'high');
  }
  void rng;
}

/* ----------------------------------------------------------- injury story */

/**
 * A long lay-off as a fork rather than a countdown. Rushing back is real - two weeks
 * bought against a leg that is not ready - and the man who took his shirt meanwhile
 * is named, because that is the part that actually keeps a player awake.
 */
function injuryWeek(input: StoryWeekInput): void {
  const { state, hooks } = input;
  const worst = state.player.condition.injuries
    .slice()
    .sort((a, b) => b.weeksRemaining - a.weeksRemaining)[0];

  // The answer he gave last week, applied: recovery shortened, risk accepted.
  if (state.flags['storyRushRecovery']) {
    state.flags['storyRushRecovery'] = 0;
    if (worst && worst.weeksRemaining > 2) {
      worst.weeksRemaining = Math.max(1, worst.weeksRemaining - 2);
      state.flags['storyRushedInjury'] = 1;
      hooks.pushInbox(state, 'medical', 'story.injuryPath.rushed', { weeks: worst.weeksRemaining });
    }
  }

  if (!worst || worst.weeksRemaining < 6) return;
  const key = `storyInjuryAsked:${worst.id}`;
  if (state.flags[key]) return;
  state.flags[key] = 1;

  openStoryDecision(state, 'injuryPath', {
    category: 'medical',
    textKey: 'story.injuryPath',
    textArgs: { weeks: worst.weeksRemaining },
    options: [
      {
        id: 'rush',
        labelKey: 'story.injuryPath.rush',
        riskKey: 'risk.high',
        effects: [
          { kind: 'custom', key: 'storyRushRecovery', value: 1 },
          { kind: 'injuryRisk', value: 22 },
          { kind: 'morale', value: 3 },
        ],
      },
      {
        id: 'patient',
        labelKey: 'story.injuryPath.patient',
        effects: [
          { kind: 'morale', value: -2 },
          { kind: 'personality', key: 'professionalism', value: 2 },
        ],
      },
    ],
    blocking: true,
    expiresWeek: absoluteWeek(state) + 2,
  }, hooks, 'medical');
}

/* ---------------------------------------------------------- clutch moment */

/**
 * The big afternoon put in his hands before it starts. Whether he wants the ball at
 * the worst possible moment is a question about him, and the outcome is a gamble his
 * own nerve tilts - taken through the same engine every other gamble uses.
 */
function clutchWeek(input: StoryWeekInput): void {
  const { state, rng, club, userMatch, hooks } = input;
  if (!club || !inSeason(state)) return;
  const senior = ['rotation', 'starter', 'important', 'key', 'star'].includes(state.player.squadRole);
  if (!senior) return;
  // The moment belongs to a big afternoon he was actually on the pitch for.
  const line = userMatch?.userLine;
  const bigDay = Boolean(line?.played && (line?.minutes ?? 0) >= 55
    && userMatch && (userMatch.importance ?? 'normal') !== 'normal' && userMatch.importance !== 'friendly');
  const cooldown = Number(state.flags['storyClutchWeek'] ?? -99);
  if (!bigDay || absoluteWeek(state) - cooldown < 14 || !rng.chance(0.55)) return;
  state.flags['storyClutchWeek'] = absoluteWeek(state);

  openStoryDecision(state, 'clutchPenalty', {
    category: 'club',
    textKey: 'story.clutchPenalty',
    options: [
      {
        id: 'take',
        labelKey: 'story.clutchPenalty.take',
        riskKey: 'risk.medium',
        effects: [],
        outcomes: [
          {
            key: 'scored',
            weight: 62,
            swayedBy: 'determination',
            sway: 0.5,
            effects: [
              { kind: 'morale', value: 9 },
              { kind: 'reputation', value: 3 },
              { kind: 'fame', value: 3 },
              { kind: 'relationship', key: 'fans', value: 6 },
            ],
          },
          {
            key: 'missed',
            weight: 38,
            effects: [
              { kind: 'morale', value: -8 },
              { kind: 'reputation', value: -2 },
              { kind: 'relationship', key: 'fans', value: -4 },
              { kind: 'personality', key: 'determination', value: 2 },
            ],
          },
        ],
      },
      {
        id: 'pass',
        labelKey: 'story.clutchPenalty.pass',
        effects: [{ kind: 'personality', key: 'determination', value: -1 }],
      },
    ],
    blocking: false,
    expiresWeek: absoluteWeek(state) + 2,
  }, hooks, 'club');
}


/* ---------------------------------------------------------------- grudges */

/**
 * What he has not forgiven. Three shapes of it: the man whose tackle cost him months,
 * the big club whose letter said "not for us" when he was fifteen, and the manager who
 * let him go. None of them do anything for years at a time - that is what a grudge is -
 * and then a fixture list puts one of them in front of him.
 */
function grudges(state: CareerState): NonNullable<StoryState['grudges']> {
  const s = story(state);
  if (!s.grudges) s.grudges = [];
  return s.grudges;
}

/** The rejection letter. Written once, at the start, and kept for good. */
function seedRejection(state: CareerState, rng: Rng): void {
  const s = story(state);
  if (s.grudges) return;
  const list = grudges(state);
  const age = state.world.season - state.player.birthYear;
  // Only a young career gets a backstory; a loaded veteran save is not handed one.
  if (age > 21) return;
  const candidates = Object.values(state.world.clubs)
    .filter((c) => c.country === state.player.birthCountry && c.id !== state.player.clubId && c.tier === 1)
    .sort((a, b) => (b.prestige ?? 0) - (a.prestige ?? 0))
    .slice(0, 4);
  if (candidates.length === 0) return;
  const club = rng.pick(candidates);
  list.push({ kind: 'rejectedYouth', name: club.name, clubId: club.id, season: state.world.season });
}

function grudgeWeek(input: StoryWeekInput): void {
  const { state, rng, userMatch, hooks } = input;
  seedRejection(state, rng);
  const list = grudges(state);

  // A new leg to remember. A fresh long injury out of a match gets a name attached:
  // the man on the other side who put it there.
  const worst = state.player.condition.injuries.find((injury) => injury.weeksRemaining >= 5);
  if (worst && userMatch?.userLine?.played && !state.flags[`storyFoulNamed:${worst.id}`]) {
    state.flags[`storyFoulNamed:${worst.id}`] = 1;
    const otherClubId = userMatch.homeClubId === state.player.clubId ? userMatch.awayClubId : userMatch.homeClubId;
    const culprits = (state.world.squads[otherClubId] ?? [])
      .map((id) => state.world.players[id])
      .filter((p): p is Player => Boolean(p && !p.retired && positionGroup(p.primaryPos) === 'DEF'));
    const culprit = culprits.length > 0 ? rng.pick(culprits) : undefined;
    if (culprit && !list.some((g) => g.kind === 'foul' && !g.settled)) {
      list.push({ kind: 'foul', name: fullName(culprit), playerId: culprit.id, season: state.world.season });
      hooks.pushInbox(state, 'personal', 'story.grudge.foul.born', {
        name: fullName(culprit),
        club: state.world.clubs[otherClubId]?.name ?? '',
      });
    }
  }

  // A fixture against somebody he remembers. Winning, or scoring, settles the account;
  // losing to them again is its own letter, but not every time - a grudge is patient.
  if (userMatch?.userLine?.played) {
    const otherClubId = userMatch.homeClubId === state.player.clubId ? userMatch.awayClubId : userMatch.homeClubId;
    const myGoals = userMatch.homeClubId === state.player.clubId ? userMatch.homeGoals : userMatch.awayGoals;
    const theirGoals = userMatch.homeClubId === state.player.clubId ? userMatch.awayGoals : userMatch.homeGoals;
    const won = myGoals > theirGoals;
    const scored = (userMatch.userLine.goals ?? 0) > 0;
    for (const grudge of list) {
      if (grudge.settled) continue;
      const address = grudge.kind === 'foul'
        ? (grudge.playerId ? state.world.players[grudge.playerId]?.clubId ?? undefined : undefined)
        : grudge.clubId;
      if (!address || address !== otherClubId) continue;
      const cooldownKey = `storyGrudgeFaced:${grudge.kind}`;
      if (won || scored) {
        grudge.settled = true;
        state.player.morale = clamp(state.player.morale + 6, 0, 100);
        hooks.pushInbox(state, 'personal', `story.grudge.${grudge.kind}.settled`, {
          name: grudge.name,
          goals: userMatch.userLine.goals ?? 0,
        });
      } else if (absoluteWeek(state) - Number(state.flags[cooldownKey] ?? -99) >= 20) {
        state.flags[cooldownKey] = absoluteWeek(state);
        hooks.pushInbox(state, 'personal', `story.grudge.${grudge.kind}.faced`, { name: grudge.name });
      }
    }
  }

  // The club that said no at fifteen, ringing the agent now. Read once and remembered.
  const rejection = list.find((g) => g.kind === 'rejectedYouth' && !g.settled);
  if (rejection && !state.flags['storyRejectionCalled']
    && state.transferOffers.some((offer) => offer.clubId === rejection.clubId)) {
    state.flags['storyRejectionCalled'] = 1;
    hooks.pushInbox(state, 'personal', 'story.grudge.rejectedYouth.calls', { name: rejection.name });
  }
}

/** The week a club is left: if the man in charge had stopped fancying him, that is kept. */
function grudgeOnMove(state: CareerState, hooks: StoryHooks): void {
  const s = story(state);
  if (!s.lastManagerName || (s.lastManagerTrust ?? 50) >= 35 || !s.clubId) return;
  const list = grudges(state);
  if (list.some((g) => g.kind === 'manager' && g.name === s.lastManagerName)) return;
  list.push({ kind: 'manager', name: s.lastManagerName, clubId: s.clubId, season: state.world.season });
  if (list.length > 5) list.shift();
  hooks.pushInbox(state, 'personal', 'story.grudge.manager.born', { name: s.lastManagerName });
}

/* ------------------------------------------------------------------ hooks */

/** One week of everybody's life around him. Called with a club or without one. */
export function runStoryWeek(input: StoryWeekInput): void {
  const { state, club } = input;
  const s = story(state);

  // Notice a move the week it happened, before anybody reacts to it.
  const movedThisWeek = s.clubId !== undefined && s.clubId !== state.player.clubId;
  const leftClub = movedThisWeek && s.clubId ? state.world.clubs[s.clubId] : undefined;
  // The grudge against the man who let him go is written while the old address and
  // last week's manager are still in memory, before the pointers move.
  if (movedThisWeek) grudgeOnMove(state, input.hooks);
  if (s.clubId === undefined || movedThisWeek) {
    if (movedThisWeek && state.player.clubId) s.joinedSeason = state.world.season;
    if (s.clubId === undefined) s.joinedSeason = s.joinedSeason ?? state.world.season;
    s.clubId = state.player.clubId;
  }

  ensureLegend(state, input.index);
  injuryWeek(input);
  grudgeWeek(input);

  // A man with no club keeps his family and his friends - they are exactly who he
  // has - but the manager, the fans and the paper's comparisons belong to a shirt.
  familyWeek(input);
  friendsWeek(input, movedThisWeek);
  if (club) {
    rivalWeek(input);
    promiseWeek(input);
    fansWeek(input, movedThisWeek, leftClub);
    clutchWeek(input);
  }

  // Remember who was in charge this week, so the week this player walks out the door
  // the name of the man who let him go is still known.
  s.lastManagerName = state.manager?.name;
  s.lastManagerTrust = state.managerTrust;
}

/** The summer: seasons are compared, kings retire, heat settles. */
export function runStorySeasonEnd(state: CareerState, rng: Rng, hooks: StoryHooks): void {
  rivalSeasonEnd(state, rng, hooks);
  legendSeasonEnd(state, rng, hooks);
  const s = story(state);
  s.rivalHeat = clamp((s.rivalHeat ?? 25) - 3, 0, 100);
}
