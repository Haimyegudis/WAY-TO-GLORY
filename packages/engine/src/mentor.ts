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

export type MentorTopic = 'advice' | 'path' | 'support';

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
  /** The brief this advice would set, if he takes it. */
  brief: string | null;
  bond: number;
  /** The conversation did more harm than good, which happens with some of them. */
  misfired?: boolean;
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
    return { topic, mentorId: mentor.id, voice: mentor.voice, situation: read, brief: null, bond: held.bond };
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
    brief: BRIEF_FOR[read] ?? null,
    bond: held.bond,
  };
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
