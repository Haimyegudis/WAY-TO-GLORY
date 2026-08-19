/**
 * Having somebody who has been there.
 *
 * A career simulator can tell a player his rating went up. It cannot tell him whether he
 * should be at this club, whether nineteen is too young to go abroad, or whether the
 * quiet season he is having is a problem or a phase. That is what the old players are
 * for: one of them takes an interest, and from then on there is someone to ask.
 *
 * The advice is not decoration. He reads the same career state the engine does - minutes,
 * age, form, contract, what is on the table - decides what he would do, and if the player
 * takes it, the brief his agent works to changes accordingly. Following a mentor and
 * ignoring him are both real choices with real outcomes.
 */
import { Rng, clamp } from './rng.js';
import { overall } from './positions.js';
import { MENTORS, mentorsFor, type MentorDef, type MentorVoice } from './mentors-data.js';
import type { CareerState } from './types.js';

export { MENTORS, mentorsFor };
export type { MentorDef, MentorVoice };

/** What a mentor reckons the player's situation actually is. */
export type MentorSituation =
  | 'needMinutes'
  | 'stepUp'
  | 'stayAndFight'
  | 'goOnLoan'
  | 'leaveNow'
  | 'signTheDeal'
  | 'holdOut'
  | 'watchTheBody'
  | 'leadThem'
  | 'enjoyIt';

/**
 * The things he can actually ask.
 *
 * Three questions is not a relationship, it is a menu. These are the things a young
 * player genuinely wants to ask somebody who has been through it, and which ones are
 * on the table depends on where he is: a sixteen year old in an academy asks how you
 * get into a first team, and a twenty-eight year old asks about his body.
 */
export type MentorTopic =
  | 'advice'
  | 'path'
  | 'support'
  | 'club'
  | 'abroad'
  | 'body'
  | 'pressure'
  | 'money'
  | 'firstTeam'
  | 'regret';

export interface MentorState {
  id: string;
  /** How much he has invested in this player, 0-100. Deeper advice comes with it. */
  bond: number;
  /** Absolute week of the last conversation, so he is not a hotline. */
  lastTalkWeek: number;
  talks: number;
  followed: number;
}

export interface MentorReply {
  topic: MentorTopic;
  mentorId: string;
  voice: MentorVoice;
  situation: MentorSituation;
  /**
   * The exact line he said, as a copy key. The engine picks it rather than the screen,
   * because which of them is talking is half of what makes the answer worth having.
   */
  lineKey: string;
  /** The brief this advice would set, if he takes it. */
  brief: string | null;
  bond: number;
  /** The conversation did more harm than good, which happens with some of them. */
  misfired?: boolean;
}

/**
 * The questions on the table this week. Some of them only make sense at a certain point
 * in a career, and a list that never changes is a list nobody reads twice.
 */
export function mentorTopics(state: CareerState, age: number): MentorTopic[] {
  const topics: MentorTopic[] = ['advice', 'path'];
  const inAcademy = state.player.squadRole === 'academy' || Boolean(state.world.youth);
  if (inAcademy) topics.push('firstTeam');
  topics.push('club');
  if (age >= 17 && age <= 30) topics.push('abroad');
  if (age >= 26 || state.player.condition.injuryHistory.length >= 2) topics.push('body');
  if (state.player.fame >= 20 || state.relationships.media < 45) topics.push('pressure');
  if (state.contract) topics.push('money');
  if ((state.mentor?.talks ?? 0) >= 4) topics.push('regret');
  topics.push('support');
  return topics;
}

/** How long he waits between calls. A mentor who is always available is not a mentor. */
export const MENTOR_COOLDOWN_WEEKS = 6;

/** Which mentors will take an interest, given who the player is and how known he is. */
export function availableMentors(state: CareerState): MentorDef[] {
  const own = mentorsFor(state.player.birthCountry);
  // Once he is a name in his own right, the ones from abroad start answering too.
  if (state.player.reputation < 62) return own;
  const abroad = MENTORS.filter((mentor) => mentor.country !== state.player.birthCountry);
  return [...own, ...abroad];
}

export function mentorById(id: string): MentorDef | undefined {
  return MENTORS.find((mentor) => mentor.id === id);
}

export function canTalkToMentor(state: CareerState): boolean {
  if (!state.mentor) return false;
  const absoluteWeek = state.world.season * 52 + state.world.week;
  return absoluteWeek - state.mentor.lastTalkWeek >= MENTOR_COOLDOWN_WEEKS;
}

/**
 * What he sees when he looks at the player's season. This is deliberately the same
 * reading a manager or an agent would make - the point of a mentor is not secret
 * information, it is somebody telling him the obvious thing he is avoiding.
 */
export function readSituation(state: CareerState, minutesShare: number): MentorSituation {
  const player = state.player;
  const age = state.world.season - player.birthYear;
  const ovr = overall(player.attributes, player.primaryPos, player.secondaryPos);
  const injuryWeeks = player.condition.injuries.reduce((sum, injury) => sum + injury.weeksRemaining, 0);
  const contractYearsLeft = state.contract ? state.contract.endSeason - state.world.season : 0;

  // A body that keeps breaking down is the only thing that ends a career early, so it
  // comes before everything else.
  if (injuryWeeks > 6 || player.condition.fatigue > 82) return 'watchTheBody';

  // A young player not playing is the classic mistake, and every one of them made it or
  // watched somebody make it.
  if (minutesShare < 0.2) {
    if (age <= 21) return 'goOnLoan';
    return 'needMinutes';
  }

  if (state.transferOffers.length > 0) {
    const best = state.transferOffers.reduce((a, b) => (b.interestLevel > a.interestLevel ? b : a));
    if (best.interestLevel > 72 && minutesShare > 0.5) return 'stepUp';
    return 'signTheDeal';
  }

  if (contractYearsLeft <= 0 && state.contract) return 'holdOut';

  // Playing well and going nowhere: the season a career either turns or stalls.
  if (minutesShare > 0.6 && player.form > 62) {
    if (age >= 28) return 'leadThem';
    if (ovr >= 72) return 'stepUp';
    return 'enjoyIt';
  }

  if (state.flags['transferListed'] || state.managerTrust < 32) return 'leaveNow';
  return 'stayAndFight';
}

/**
 * How the situation is coloured by who is doing the talking. A wanderer sees a reason to
 * move where a one-club man sees a reason to dig in, and both of them are right about
 * their own career - which is exactly why choosing a mentor matters.
 */
function colourBy(voice: MentorVoice, situation: MentorSituation): MentorSituation {
  if (voice === 'wanderer' && situation === 'stayAndFight') return 'leaveNow';
  if (voice === 'wanderer' && situation === 'enjoyIt') return 'stepUp';
  if (voice === 'grinder' && situation === 'leaveNow') return 'stayAndFight';
  if (voice === 'grinder' && situation === 'stepUp') return 'needMinutes';
  if (voice === 'winner' && situation === 'enjoyIt') return 'stepUp';
  if (voice === 'winner' && situation === 'stayAndFight') return 'stepUp';
  if (voice === 'captain' && situation === 'enjoyIt') return 'leadThem';
  if (voice === 'artist' && situation === 'needMinutes') return 'enjoyIt';
  if (voice === 'wall' && situation === 'stepUp') return 'watchTheBody';
  return situation;
}

/** The agent brief a piece of advice amounts to, if he acts on it. */
const BRIEF_FOR: Partial<Record<MentorSituation, string>> = {
  needMinutes: 'aimMinutes',
  goOnLoan: 'wantsLoan',
  stepUp: 'aimHigh',
  leaveNow: 'exploringMove',
  holdOut: 'holdingOut',
  watchTheBody: 'reducedLoad',
};

/**
 * A conversation. Advice reads the season and says what he would do; a path question is
 * the same thing pointed at the next few years; support is somebody telling him he is
 * still a footballer on the week he does not believe it.
 */
export function talkToMentor(
  rng: Rng,
  state: CareerState,
  topic: MentorTopic,
  minutesShare: number,
): MentorReply | null {
  const held = state.mentor;
  if (!held) return null;
  const mentor = mentorById(held.id);
  if (!mentor) return null;
  if (!canTalkToMentor(state)) return null;

  held.lastTalkWeek = state.world.season * 52 + state.world.week;
  held.talks += 1;
  held.bond = clamp(held.bond + rng.range(2, 5), 0, 100);

  const player = state.player;
  const read = colourBy(mentor.voice, readSituation(state, minutesShare));

  if (topic === 'support') {
    // Not advice. Just an hour with somebody who has had the same week.
    player.morale = clamp(player.morale + 6 + held.bond / 25, 0, 100);
    player.personality.pressureHandling = clamp(player.personality.pressureHandling + 0.5, 1, 99);
    return {
      topic, mentorId: mentor.id, voice: mentor.voice, situation: read,
      lineKey: `mentor.support.${mentor.voice}`, brief: null, bond: held.bond,
    };
  }

  // The questions that are about a subject rather than about this week. They are not
  // advice the agent can act on - they are the old player telling him how it went for
  // him, which is the part a career page cannot give him.
  if (topic !== 'advice' && topic !== 'path') {
    applyTopicEffect(topic, player, held.bond);
    return {
      topic, mentorId: mentor.id, voice: mentor.voice, situation: read,
      lineKey: `mentor.answer.${topic}.${mentor.voice}`, brief: null, bond: held.bond,
    };
  }

  // A great player is not automatically a great teacher, and some of them have never
  // understood why the rest of the world finds it hard. Early on, before he knows what
  // he is looking at, the session can leave a young player worse than it found him.
  const misfires = rng.chance(clamp(0.3 - held.bond / 260, 0.06, 0.3));
  if (misfires) {
    const shaken = rng.pick(['composure', 'decisions', 'concentration'] as const);
    player.attributes[shaken] = clamp(player.attributes[shaken] - rng.range(0.3, 1.0), 1, 99);
    player.morale = clamp(player.morale - 4, 0, 100);
    return {
      topic,
      mentorId: mentor.id,
      voice: mentor.voice,
      situation: read,
      lineKey: `mentor.misfire.${mentor.voice}`,
      brief: null,
      bond: held.bond,
      misfired: true,
    };
  }

  // Time with a great player rubs off, and what rubs off is whatever he was.
  const rub = 0.4 + held.bond / 120;
  switch (mentor.voice) {
    case 'winner':
      player.personality.ambition = clamp(player.personality.ambition + rub, 1, 99);
      break;
    case 'artist':
      player.attributes.composure = clamp(player.attributes.composure + rub, 1, 99);
      break;
    case 'grinder':
      player.personality.professionalism = clamp(player.personality.professionalism + rub, 1, 99);
      break;
    case 'captain':
      player.attributes.leadership = clamp(player.attributes.leadership + rub, 1, 99);
      break;
    case 'wanderer':
      player.personality.adaptability = clamp(player.personality.adaptability + rub, 1, 99);
      break;
    case 'wall':
      player.attributes.concentration = clamp(player.attributes.concentration + rub, 1, 99);
      break;
  }
  player.morale = clamp(player.morale + 3, 0, 100);

  return {
    topic,
    mentorId: mentor.id,
    voice: mentor.voice,
    situation: read,
    // Six men read the same season and six men say different things about it.
    lineKey: `mentor.say.${read}.${mentor.voice}`,
    brief: BRIEF_FOR[read] ?? null,
    bond: held.bond,
  };
}

/**
 * What an hour on one subject leaves behind. None of these is advice the agent acts on,
 * so what they move is the player himself.
 */
function applyTopicEffect(topic: MentorTopic, player: CareerState['player'], bond: number): void {
  const weight = 0.4 + bond / 140;
  switch (topic) {
    case 'club':
      player.personality.loyalty = clamp(player.personality.loyalty + weight, 1, 99);
      break;
    case 'abroad':
      player.personality.adaptability = clamp(player.personality.adaptability + weight, 1, 99);
      break;
    case 'body':
      player.attributes.stamina = clamp(player.attributes.stamina + weight * 0.6, 1, 99);
      player.personality.professionalism = clamp(player.personality.professionalism + weight, 1, 99);
      break;
    case 'pressure':
      player.personality.pressureHandling = clamp(player.personality.pressureHandling + weight, 1, 99);
      break;
    case 'money':
      player.personality.ambition = clamp(player.personality.ambition + weight * 0.7, 1, 99);
      break;
    case 'firstTeam':
      player.attributes.decisions = clamp(player.attributes.decisions + weight * 0.6, 1, 99);
      player.personality.determination = clamp(player.personality.determination + weight, 1, 99);
      break;
    case 'regret':
      // The one conversation that costs nothing and changes how he sees the whole thing.
      player.personality.consistency = clamp(player.personality.consistency + weight * 0.8, 1, 99);
      player.morale = clamp(player.morale + 4, 0, 100);
      break;
    default:
      break;
  }
}

/**
 * Taking the advice. The brief goes to the agent, and the mentor notices - a player who
 * listens gets more out of him than one who only turns up to be told he is doing fine.
 */
export function followAdvice(state: CareerState, reply: MentorReply): void {
  if (!state.mentor || !reply.brief) return;
  state.flags[reply.brief] = true;
  state.mentor.followed += 1;
  state.mentor.bond = clamp(state.mentor.bond + 6, 0, 100);
  state.player.morale = clamp(state.player.morale + 2, 0, 100);
}

/**
 * The call he did not make.
 *
 * A mentor who only ever answers is a help page with a face. The ones worth having ring
 * you up in the week you played badly and ask you something you were avoiding - and what
 * you answer tells him, and you, what kind of player you are turning into.
 */
export type MentorPromptId =
  | 'whyThatPass'
  | 'areYouEnjoyingIt'
  | 'whoDoYouListenTo'
  | 'whatAreYouAfraidOf'
  | 'wouldYouLeave'
  | 'whoAreYouDoingItFor';

export interface MentorPromptAnswer {
  id: string;
  bond: number;
  morale?: number;
  personality?: Partial<Record<keyof CareerState['player']['personality'], number>>;
  attributes?: Partial<Record<keyof CareerState['player']['attributes'], number>>;
}

export interface MentorPromptDef {
  id: MentorPromptId;
  answers: MentorPromptAnswer[];
}

/**
 * The questions they ask. Each answer is a small trade in character, not a reward - the
 * honest one costs a little pride, the defiant one costs the closeness.
 */
export const MENTOR_PROMPTS: MentorPromptDef[] = [
  {
    id: 'whyThatPass',
    answers: [
      { id: 'sawIt', bond: 5, personality: { ambition: 0.6 }, attributes: { vision: 0.8 } },
      { id: 'panicked', bond: 8, morale: -2, attributes: { composure: 1 } },
      { id: 'itWasOn', bond: -3, personality: { determination: 0.8 }, attributes: { decisions: -0.4 } },
    ],
  },
  {
    id: 'areYouEnjoyingIt',
    answers: [
      { id: 'yes', bond: 4, morale: 4 },
      { id: 'notLately', bond: 9, morale: -3, personality: { professionalism: 0.9 } },
      { id: 'notTheQuestion', bond: -2, personality: { ambition: 1 }, attributes: { concentration: 0.5 } },
    ],
  },
  {
    id: 'whoDoYouListenTo',
    answers: [
      { id: 'theCoach', bond: 4, personality: { professionalism: 1 } },
      { id: 'myself', bond: -2, personality: { determination: 1.1, adaptability: -0.5 } },
      { id: 'you', bond: 10, personality: { adaptability: 0.8, ambition: -0.4 } },
    ],
  },
  {
    id: 'whatAreYouAfraidOf',
    answers: [
      { id: 'notMakingIt', bond: 9, morale: -3, personality: { determination: 1.2 } },
      { id: 'gettingHurt', bond: 7, attributes: { concentration: 0.6 }, personality: { pressureHandling: 0.6 } },
      { id: 'nothing', bond: -3, personality: { pressureHandling: -0.6, ambition: 0.8 } },
    ],
  },
  {
    id: 'wouldYouLeave',
    answers: [
      { id: 'tomorrow', bond: 3, personality: { ambition: 1.2, loyalty: -1 } },
      { id: 'notYet', bond: 6, personality: { loyalty: 1.1, ambition: -0.5 } },
      { id: 'dependsWhoAsks', bond: 5, personality: { adaptability: 0.9 } },
    ],
  },
  {
    id: 'whoAreYouDoingItFor',
    answers: [
      { id: 'family', bond: 8, morale: 4, personality: { loyalty: 1 } },
      { id: 'myself', bond: 4, personality: { ambition: 1.1 } },
      { id: 'toProveThem', bond: 6, personality: { determination: 1.3, pressureHandling: -0.5 } },
    ],
  },
];

export function mentorPromptById(id: MentorPromptId): MentorPromptDef | undefined {
  return MENTOR_PROMPTS.find((prompt) => prompt.id === id);
}

/**
 * Whether he gets in touch this week, and about what. He asks when something has just
 * happened - a bad run, a big night, a rumour - and never twice in a hurry.
 */
export function mentorReachesOut(
  rng: Rng,
  state: CareerState,
  ctx: { recentRating: number | null; minutesPct: number; rumoured: boolean },
): MentorPromptId | null {
  const held = state.mentor;
  if (!held) return null;
  const absolute = state.world.season * 52 + state.world.week;
  if (absolute - Number(state.flags['mentorAskedWeek'] ?? -99) < 10) return null;
  // He has to know the player a little before he starts asking him things like this.
  if (held.talks < 2) return null;
  if (!rng.chance(0.22)) return null;

  const asked = new Set(String(state.flags['mentorAsked'] ?? '').split(',').filter(Boolean));
  const pool: MentorPromptId[] = [];
  if (ctx.recentRating !== null && ctx.recentRating < 6.3) pool.push('whyThatPass', 'whatAreYouAfraidOf');
  if (ctx.minutesPct < 0.25) pool.push('areYouEnjoyingIt', 'wouldYouLeave');
  if (ctx.rumoured) pool.push('wouldYouLeave');
  if (ctx.recentRating !== null && ctx.recentRating > 7.2) pool.push('whoAreYouDoingItFor', 'whoDoYouListenTo');
  pool.push('whoDoYouListenTo', 'areYouEnjoyingIt');

  const fresh = pool.filter((id) => !asked.has(id));
  const from = fresh.length > 0 ? fresh : pool;
  return from[rng.int(0, from.length - 1)] ?? null;
}

/** Answering him. Bond moves, and so does a little of who he is. */
export function answerMentorPrompt(state: CareerState, answer: MentorPromptAnswer): void {
  const held = state.mentor;
  if (!held) return;
  held.bond = clamp(held.bond + answer.bond, 0, 100);
  const player = state.player;
  if (answer.morale) player.morale = clamp(player.morale + answer.morale, 0, 100);
  for (const [key, delta] of Object.entries(answer.personality ?? {})) {
    const trait = key as keyof CareerState['player']['personality'];
    player.personality[trait] = clamp(player.personality[trait] + delta, 1, 99);
  }
  // A word from an old player is still training, and training stops at the ceiling: the
  // same rule the development engine and the career events already keep. Without it a
  // player could be talked past his own potential.
  const ceilingReached =
    overall(player.attributes, player.primaryPos, player.secondaryPos) >= player.potential;
  for (const [key, delta] of Object.entries(answer.attributes ?? {})) {
    if (delta > 0 && ceilingReached) continue;
    const attribute = key as keyof CareerState['player']['attributes'];
    player.attributes[attribute] = clamp(player.attributes[attribute] + delta, 1, 99);
  }
}
