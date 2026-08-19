/**
 * The moments somebody puts a microphone in front of him.
 *
 * Not every week. Nobody asks a squad player anything in October. But there are half a
 * dozen nights in a career when the answer he gives is remembered: his debut, the derby,
 * the first game back at a club that sold him, the week the rumours start, the night he
 * scores the goal that wins something.
 *
 * What he says moves real numbers in both directions. Saying the brave thing in front of
 * a camera and then having to go and do it is how composure is built, and it is also how
 * a nineteen year old talks himself into a season of being booed. There is no safe
 * answer here - the quiet one costs him the crowd, the loud one costs him if he fails.
 */
import { Rng, clamp } from './rng.js';
import { overall } from './positions.js';
import { track } from './social.js';
import type {
  AppliedChange,
  AttributeKey,
  CareerState,
  DecisionResult,
  MatchImportance,
  PersonalityKey,
} from './types.js';

export type MilestoneId =
  | 'debut'
  | 'firstGoal'
  | 'derby'
  | 'bigMatch'
  | 'firstAfterTransfer'
  | 'againstOldClub'
  | 'transferRumour'
  | 'trophyNight'
  // The weeks nobody plans for. A microphone after a hat-trick and a microphone after
  // a red card are the same microphone, and they are the ones that decide how he is
  // written about for the rest of the season.
  | 'hatTrick'
  | 'sentOff'
  | 'dropped'
  | 'goalDrought'
  | 'badRun'
  | 'punditCriticism'
  | 'rivalDig'
  | 'injuryReturn'
  | 'nationalCallUp'
  | 'youthBreakout'
  | 'relegationFight'
  | 'contractStandoff';

export interface MilestoneAnswer {
  id: string;
  /**
   * How exposed the answer leaves him, shown next to it before he gives it. The player
   * should never have to guess whether he is about to say something that costs him.
   */
  risk: 'low' | 'medium' | 'high';
  /** Attributes moved, up or down, when this answer is given. */
  attributes?: Partial<Record<AttributeKey, number>>;
  personality?: Partial<Record<PersonalityKey, number>>;
  morale?: number;
  fame?: number;
  reputation?: number;
  relationships?: Partial<Record<'manager' | 'teammates' | 'fans' | 'board' | 'media', number>>;
  /**
   * The claim he has just made in public. It is rolled against how he then plays: back it
   * up and it is worth more than he said; fail and it costs him more than he saved.
   */
  backsItUp?: { attribute: AttributeKey; swing: number };
  /**
   * Somebody he has just made an enemy of. Football gives you the fixture back, and when
   * it does, everything he does in it is worth double in both directions.
   */
  grudge?: { against: 'nextOpponent' | 'oldClub' };
}

export interface MilestoneQuestion {
  id: MilestoneId;
  answers: MilestoneAnswer[];
}

/** A claim that has been settled: whether he backed it up, and what it moved. */
export interface ClaimSettlement {
  carried: boolean;
  result: DecisionResult;
}

/**
 * The questions. Each answer is a trade, never a bonus: the bold one risks something the
 * careful one does not, and the careful one gives away something the bold one takes.
 */
export const MILESTONES: MilestoneQuestion[] = [
  {
    id: 'debut',
    answers: [
      {
        // Says the right things, gives nothing away, disappoints nobody and excites nobody.
        id: 'humble',
        risk: 'low',
        personality: { professionalism: 1.2, ambition: -0.6 },
        relationships: { manager: 5, media: -2 },
        morale: 2,
      },
      {
        // Tells the country he belongs here. Now he has to look like he does.
        id: 'bold',
        risk: 'high',
        attributes: { composure: 1.4 },
        personality: { ambition: 1.4, pressureHandling: -0.8 },
        relationships: { fans: 7, media: 6, teammates: -4 },
        fame: 3,
        backsItUp: { attribute: 'composure', swing: 2.2 },
      },
      {
        // Thanks the people who got him here. Cheap, warm, and forgotten by Tuesday.
        id: 'family',
        risk: 'low',
        personality: { loyalty: 1.2 },
        relationships: { fans: 4, media: -1 },
        morale: 4,
      },
    ],
  },
  {
    id: 'firstGoal',
    answers: [
      {
        id: 'team',
        risk: 'low',
        personality: { professionalism: 1 },
        relationships: { teammates: 8, manager: 4, media: -3 },
      },
      {
        id: 'moreToCome',
        risk: 'high',
        attributes: { finishing: 1.2 },
        personality: { ambition: 1.2, consistency: -0.7 },
        relationships: { media: 6, fans: 5 },
        fame: 3,
        backsItUp: { attribute: 'finishing', swing: 1.8 },
      },
    ],
  },
  {
    id: 'derby',
    answers: [
      {
        // Refuses to give them anything to pin on the dressing-room wall.
        id: 'respect',
        risk: 'medium',
        attributes: { concentration: 1 },
        personality: { professionalism: 0.8 },
        relationships: { manager: 5, fans: -5 },
      },
      {
        // Tells the other lot exactly what is coming. The crowd loves it. The other lot
        // read it too.
        id: 'fire',
        risk: 'high',
        attributes: { composure: -1.1 },
        personality: { determination: 1.4, discipline: -1 },
        relationships: { fans: 12, media: 7, manager: -4 },
        fame: 4,
        backsItUp: { attribute: 'composure', swing: 2.6 },
      },
      {
        id: 'deflect',
        risk: 'medium',
        personality: { professionalism: 0.6 },
        relationships: { media: -6, manager: 3 },
        morale: -2,
      },
    ],
  },
  {
    id: 'bigMatch',
    answers: [
      {
        id: 'businessAsUsual',
        risk: 'low',
        attributes: { concentration: 1.1 },
        personality: { pressureHandling: 1 },
        relationships: { manager: 4, media: -3 },
      },
      {
        id: 'ourNight',
        risk: 'high',
        attributes: { composure: 1.2 },
        personality: { ambition: 1.1, pressureHandling: -0.9 },
        relationships: { fans: 8, teammates: 4, media: 5 },
        fame: 3,
        backsItUp: { attribute: 'composure', swing: 2.4 },
      },
    ],
  },
  {
    id: 'firstAfterTransfer',
    answers: [
      {
        // Promises the new crowd everything before he has kicked a ball for them.
        id: 'promise',
        risk: 'high',
        personality: { ambition: 1.2, pressureHandling: -1 },
        relationships: { fans: 10, media: 5, teammates: -3 },
        reputation: 2,
        backsItUp: { attribute: 'decisions', swing: 2 },
      },
      {
        id: 'settleIn',
        risk: 'low',
        attributes: { concentration: 1 },
        personality: { adaptability: 1.3, ambition: -0.5 },
        relationships: { teammates: 7, manager: 4, fans: -3 },
      },
    ],
  },
  {
    id: 'againstOldClub',
    answers: [
      {
        // Will not celebrate. The old crowd remembers that; the new one notices too.
        id: 'wontCelebrate',
        risk: 'medium',
        personality: { loyalty: 1.5 },
        relationships: { fans: -6, media: 3 },
        morale: -3,
      },
      {
        id: 'movedOn',
        risk: 'high',
        attributes: { composure: 1.1, concentration: -0.6 },
        personality: { determination: 1.2 },
        relationships: { fans: 8, media: 5 },
        backsItUp: { attribute: 'composure', swing: 2 },
      },
    ],
  },
  {
    id: 'transferRumour',
    answers: [
      {
        // Denies everything. The club is delighted. The bigger club reads it as a no.
        id: 'deny',
        risk: 'low',
        personality: { loyalty: 1.4, ambition: -1 },
        relationships: { board: 8, manager: 6, fans: 6 },
      },
      {
        // Refuses to rule it out, which in this business is a yes.
        id: 'flattered',
        risk: 'high',
        personality: { ambition: 1.6, loyalty: -1.2 },
        relationships: { board: -8, fans: -7, manager: -5, media: 6 },
        reputation: 3,
      },
      {
        id: 'noComment',
        risk: 'medium',
        attributes: { concentration: 0.8 },
        relationships: { media: -5 },
      },
    ],
  },
  {
    id: 'trophyNight',
    answers: [
      {
        // Hands the night to everybody else. The dressing room will not forget it, and
        // neither will the people writing about somebody else's season.
        id: 'creditThem',
        risk: 'medium',
        personality: { professionalism: 1.3, ambition: -0.8 },
        relationships: { teammates: 10, manager: 6, board: 4, media: -4 },
        morale: 6,
        fame: -2,
      },
      {
        id: 'firstOfMany',
        risk: 'high',
        attributes: { composure: 1 },
        personality: { ambition: 1.6, consistency: -0.8 },
        relationships: { fans: 8, media: 7 },
        fame: 6,
        backsItUp: { attribute: 'decisions', swing: 2.2 },
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // The weeks nobody schedules. These are the ones that decide whether a career is
  // written about as a rise or as a warning.
  // ---------------------------------------------------------------------------

  {
    id: 'hatTrick',
    answers: [
      {
        // Three goals and he talks about the wingers. Nobody believes him, everybody
        // likes him for it.
        id: 'passers',
        risk: 'medium',
        personality: { professionalism: 1.2, ambition: -0.7 },
        relationships: { teammates: 11, manager: 5, media: -4 },
        fame: -1,
        morale: 4,
      },
      {
        // Says out loud what number he is going to finish the season on.
        id: 'nameTheNumber',
        risk: 'high',
        attributes: { finishing: 1.5 },
        personality: { ambition: 1.7, pressureHandling: -1.1 },
        relationships: { fans: 11, media: 9, teammates: -4 },
        fame: 6,
        reputation: 2,
        backsItUp: { attribute: 'finishing', swing: 2.6 },
      },
      {
        // Points out that he has been doing this for months and nobody was watching.
        id: 'aboutTime',
        risk: 'medium',
        attributes: { composure: -0.8 },
        personality: { determination: 1.4, professionalism: -0.9 },
        relationships: { media: -7, manager: -3, fans: 5 },
        reputation: 2,
      },
    ],
  },
  {
    id: 'sentOff',
    answers: [
      {
        // Takes it. Costs him nothing except the part of him that wanted to say more.
        id: 'ownIt',
        risk: 'medium',
        personality: { discipline: 1.6, determination: -0.6 },
        relationships: { manager: 8, board: 5, fans: -4 },
        morale: -4,
      },
      {
        // Says the referee decided it before the whistle. The association reads it too.
        id: 'blameTheRef',
        risk: 'high',
        personality: { discipline: -1.4, determination: 1.2 },
        relationships: { fans: 9, teammates: 5, board: -9, manager: -6, media: -5 },
        fame: 3,
      },
      {
        // Says the other one went down. Now there is a name attached to it.
        id: 'heDived',
        risk: 'high',
        attributes: { composure: -1 },
        personality: { determination: 1.5, professionalism: -1.2 },
        relationships: { fans: 7, media: 6, manager: -5 },
        fame: 4,
        grudge: { against: 'nextOpponent' },
      },
    ],
  },
  {
    id: 'dropped',
    answers: [
      {
        // Says he will train his way back in. The manager hears exactly that.
        id: 'trainBack',
        risk: 'medium',
        attributes: { workRate: 1.3 },
        personality: { professionalism: 1.4, ambition: -0.8 },
        relationships: { manager: 9, teammates: 4, media: -5 },
        morale: -3,
      },
      {
        // Says he is one of the best players at this club and everyone knows it.
        id: 'bestHere',
        risk: 'high',
        attributes: { composure: 1.2 },
        personality: { ambition: 1.8, loyalty: -1.2 },
        relationships: { fans: 8, media: 8, manager: -11, teammates: -5 },
        reputation: 3,
        backsItUp: { attribute: 'composure', swing: 2.8 },
      },
      {
        // Refuses to make it a story. The story runs anyway, smaller.
        id: 'noStory',
        risk: 'medium',
        attributes: { concentration: 1 },
        personality: { professionalism: 0.9 },
        relationships: { media: -6, manager: 3 },
        morale: -2,
      },
    ],
  },
  {
    id: 'goalDrought',
    answers: [
      {
        // Says the goals are coming. Every striker says it. He has now said it publicly.
        id: 'theyllCome',
        risk: 'high',
        attributes: { finishing: 1.3 },
        personality: { consistency: 1.1, pressureHandling: -1 },
        relationships: { fans: 6, media: 4, manager: -3 },
        backsItUp: { attribute: 'finishing', swing: 2.4 },
      },
      {
        // Says he is not being played where he scores. It is true. It is also a complaint.
        id: 'wrongRole',
        risk: 'high',
        personality: { ambition: 1.3, professionalism: -1 },
        relationships: { manager: -9, media: 5, teammates: -3 },
        morale: 3,
      },
      {
        // Talks about the work he does without the ball. Dull, honest, and the coaching
        // staff notice.
        id: 'theOtherWork',
        risk: 'medium',
        attributes: { workRate: 1.2, positioning: 0.9 },
        personality: { professionalism: 1.2, ambition: -0.9 },
        relationships: { manager: 6, fans: -5, media: -4 },
      },
    ],
  },
  {
    id: 'badRun',
    answers: [
      {
        // Admits he has been poor. Nobody expects it, so it lands.
        id: 'admit',
        risk: 'medium',
        attributes: { concentration: 1.1 },
        personality: { professionalism: 1.5, determination: -0.5 },
        relationships: { fans: 7, media: 6, board: -4 },
        morale: -5,
      },
      {
        // Says he will be the best player on the pitch on Saturday.
        id: 'saturday',
        risk: 'high',
        attributes: { composure: 1.3 },
        personality: { determination: 1.6, pressureHandling: -1.2 },
        relationships: { fans: 9, media: 7, teammates: -4 },
        fame: 4,
        backsItUp: { attribute: 'composure', swing: 3 },
      },
      {
        // Says the whole side has been poor. Which is true, and which the dressing room
        // will hear as him spreading it around.
        id: 'notJustMe',
        risk: 'high',
        personality: { determination: 1, loyalty: -1.3 },
        relationships: { teammates: -10, manager: -4, media: 5 },
        morale: 2,
      },
    ],
  },
  {
    id: 'punditCriticism',
    answers: [
      {
        // Says he does not watch it. He watched it four times.
        id: 'dontWatch',
        risk: 'medium',
        attributes: { concentration: 1.2 },
        personality: { professionalism: 1.3, determination: -0.6 },
        relationships: { manager: 5, media: -5, fans: -3 },
      },
      {
        // Names him back, on the record, with the years he last played.
        id: 'nameHimBack',
        risk: 'high',
        attributes: { composure: -1.2 },
        personality: { determination: 1.7, discipline: -1.4 },
        relationships: { fans: 13, teammates: 5, media: -8, board: -6 },
        fame: 7,
        reputation: 2,
      },
      {
        // Says he will answer it on the pitch, and puts a number on when.
        id: 'answerOnThePitch',
        risk: 'high',
        attributes: { composure: 1.1 },
        personality: { determination: 1.4, pressureHandling: -1 },
        relationships: { fans: 8, media: 5, manager: -3 },
        backsItUp: { attribute: 'composure', swing: 2.7 },
      },
    ],
  },
  {
    id: 'rivalDig',
    answers: [
      {
        // Lets it go. The crowd wanted more; the manager wanted exactly this.
        id: 'letItGo',
        risk: 'medium',
        personality: { professionalism: 1.4, determination: -0.7 },
        relationships: { manager: 7, board: 4, fans: -7, media: -4 },
      },
      {
        // Answers it. Now the fixture has a name on it.
        id: 'answerHim',
        risk: 'high',
        attributes: { composure: -1 },
        personality: { determination: 1.6, discipline: -1.2 },
        relationships: { fans: 12, media: 8, manager: -5 },
        fame: 6,
        grudge: { against: 'nextOpponent' },
      },
      {
        // Says he had to look him up. Colder than shouting, and it travels further.
        id: 'whoIsHe',
        risk: 'high',
        attributes: { composure: 1.2 },
        personality: { ambition: 1.3, professionalism: -0.8 },
        relationships: { fans: 10, media: 9, teammates: -3 },
        fame: 5,
        backsItUp: { attribute: 'composure', swing: 2.5 },
        grudge: { against: 'nextOpponent' },
      },
    ],
  },
  {
    id: 'injuryReturn',
    answers: [
      {
        // Says he is taking it week by week. The medical staff exhale.
        id: 'weekByWeek',
        risk: 'medium',
        attributes: { stamina: 1.1 },
        personality: { professionalism: 1.5, ambition: -0.9 },
        relationships: { manager: 7, board: 5, media: -5 },
        fame: -2,
      },
      {
        // Says he is stronger than before he went down.
        id: 'strongerNow',
        risk: 'high',
        attributes: { strength: 1.4 },
        personality: { determination: 1.5, pressureHandling: -0.9 },
        relationships: { fans: 9, media: 7, manager: -4 },
        fame: 3,
        backsItUp: { attribute: 'strength', swing: 2.5 },
      },
      {
        // Talks about the months in the gym nobody saw. Honest, and it costs him the
        // aura he had before.
        id: 'theDarkMonths',
        risk: 'low',
        attributes: { concentration: 1.2 },
        personality: { determination: 1.6, ambition: -0.7 },
        relationships: { fans: 8, teammates: 6, media: 4, board: -3 },
        morale: -3,
      },
    ],
  },
  {
    id: 'nationalCallUp',
    answers: [
      {
        // The proudest day. Says so, plainly, and means it.
        id: 'proudest',
        risk: 'low',
        personality: { professionalism: 1.2, ambition: -0.6 },
        relationships: { fans: 9, media: 5, teammates: 4, board: -3 },
        morale: 7,
      },
      {
        // Says he intends to keep the shirt.
        id: 'keepTheShirt',
        risk: 'high',
        attributes: { composure: 1.3 },
        personality: { ambition: 1.8, loyalty: -1 },
        relationships: { media: 8, fans: 7, manager: -4 },
        fame: 5,
        reputation: 3,
        backsItUp: { attribute: 'composure', swing: 2.6 },
      },
      {
        // Says it should have come a year ago. It probably should have.
        id: 'overdue',
        risk: 'medium',
        personality: { ambition: 1.5, professionalism: -1.1 },
        relationships: { media: -7, board: -4, fans: 6 },
        reputation: 2,
      },
    ],
  },
  {
    id: 'youthBreakout',
    answers: [
      {
        // A sixteen year old saying the right things. The academy staff nod.
        id: 'stayGrounded',
        risk: 'medium',
        personality: { professionalism: 1.6, ambition: -0.8 },
        relationships: { manager: 8, teammates: 5, media: -4 },
        morale: 3,
      },
      {
        // Says he is ready for the first team now, at sixteen, into a microphone.
        id: 'readyNow',
        risk: 'high',
        attributes: { composure: 1.2 },
        personality: { ambition: 1.9, pressureHandling: -1.3 },
        relationships: { fans: 8, media: 9, manager: -7, teammates: -5 },
        fame: 5,
        reputation: 3,
        backsItUp: { attribute: 'composure', swing: 2.8 },
      },
      {
        // Thanks the coach who has had him since he was twelve.
        id: 'theCoach',
        risk: 'low',
        personality: { loyalty: 1.7, ambition: -1 },
        relationships: { manager: 6, board: 5, media: -3 },
        morale: 5,
        fame: -1,
      },
    ],
  },
  {
    id: 'relegationFight',
    answers: [
      {
        // Says the squad is good enough. Says it in a week when it plainly is not.
        id: 'goodEnough',
        risk: 'high',
        attributes: { composure: 1.2 },
        personality: { determination: 1.5, pressureHandling: -1.1 },
        relationships: { teammates: 9, board: 6, media: -5 },
        backsItUp: { attribute: 'composure', swing: 2.7 },
      },
      {
        // Says the club has not been run well enough. True, and it goes upstairs.
        id: 'blameUpstairs',
        risk: 'high',
        personality: { determination: 1.4, professionalism: -1.3 },
        relationships: { fans: 12, teammates: 6, board: -14, manager: -4 },
        fame: 4,
      },
      {
        // Says nothing anyone can use. Survives the week, loses the room a little.
        id: 'sayNothing',
        risk: 'medium',
        attributes: { concentration: 1 },
        personality: { professionalism: 1 },
        relationships: { media: -6, fans: -5, board: 4 },
      },
    ],
  },
  {
    id: 'contractStandoff',
    answers: [
      {
        // Says he is happy here. The club stops worrying and stops improving the offer.
        id: 'happyHere',
        risk: 'low',
        personality: { loyalty: 1.6, ambition: -1.3 },
        relationships: { board: 10, fans: 9, manager: 6 },
        reputation: -2,
      },
      {
        // Says his future is being decided by people above him. Everyone knows who.
        id: 'notInMyHands',
        risk: 'high',
        personality: { ambition: 1.5, loyalty: -1.2 },
        relationships: { board: -11, fans: -6, media: 7 },
        reputation: 3,
      },
      {
        // Says he will sign the day the club shows him the plan. Reasonable, and public,
        // which makes it a deadline.
        id: 'showMeThePlan',
        risk: 'high',
        attributes: { composure: 1.1 },
        personality: { ambition: 1.2, professionalism: -0.6 },
        relationships: { board: -5, fans: 5, media: 4 },
        backsItUp: { attribute: 'composure', swing: 2.3 },
      },
    ],
  },
];

/**
 * Which question this moment asks, if it asks one at all. Most weeks it asks nothing,
 * which is the point: a microphone means something because it is not always there.
 */
export function milestoneFor(importance: MatchImportance, ctx: { weeksAtNewClub: number; rumoured: boolean }): MilestoneId | null {
  const occasion = occasionMilestone(importance);
  if (occasion) return occasion;
  if (ctx.weeksAtNewClub >= 0 && ctx.weeksAtNewClub <= 2) return 'firstAfterTransfer';
  if (ctx.rumoured) return 'transferRumour';
  return null;
}

/**
 * The question a fixture asks by itself. These outrank anything he has been doing,
 * because a debut is a debut - but a transfer rumour is not an occasion, it is
 * background noise, and it is left to the bottom of the pile so that a hat-trick, a
 * sending off or a month on the bench gets asked about first.
 */
export function occasionMilestone(importance: MatchImportance): MilestoneId | null {
  switch (importance) {
    case 'debut':
    case 'firstProMatch':
    case 'internationalDebut':
      return 'debut';
    case 'vsFormerClub':
      return 'againstOldClub';
    case 'derby':
    case 'rival':
      return 'derby';
    case 'cupFinal':
    case 'cupSemi':
    case 'titleDecider':
    case 'europeanNight':
      return 'bigMatch';
    default:
      return null;
  }
}

export function milestoneById(id: MilestoneId): MilestoneQuestion | undefined {
  return MILESTONES.find((question) => question.id === id);
}

/**
 * Applying the answer. Everything named in it moves in the direction it is written -
 * these are trades, so several of the numbers go down.
 *
 * A claim is not settled here. He has said it in front of a camera and now he has to go
 * out and look like he meant it, so the promise is held until the next time he plays.
 */
export function applyMilestoneAnswer(state: CareerState, answer: MilestoneAnswer): DecisionResult {
  const player = state.player;
  const changes: AppliedChange[] = [];

  // What he says in front of a camera can shake him or steady him, but it cannot train
  // him past his own ceiling: the same rule development and career events already keep.
  const atTheCeiling =
    overall(player.attributes, player.primaryPos, player.secondaryPos) >= player.potential;
  for (const [key, delta] of Object.entries(answer.attributes ?? {})) {
    if (delta > 0 && atTheCeiling) continue;
    const attribute = key as AttributeKey;
    const before = player.attributes[attribute];
    player.attributes[attribute] = clamp(before + delta, 1, 99);
    track(changes, `change.attr.${attribute}`, before, player.attributes[attribute]);
  }
  for (const [key, delta] of Object.entries(answer.personality ?? {})) {
    const trait = key as PersonalityKey;
    const before = player.personality[trait];
    player.personality[trait] = clamp(before + delta, 1, 99);
    track(changes, `change.personality.${trait}`, before, player.personality[trait]);
  }
  for (const [key, delta] of Object.entries(answer.relationships ?? {})) {
    const who = key as 'manager' | 'teammates' | 'fans' | 'board' | 'media';
    const before = state.relationships[who];
    state.relationships[who] = clamp(before + delta, 0, 100);
    if (who === 'manager') state.managerTrust = state.relationships[who];
    track(changes, `change.${who}`, before, state.relationships[who]);
  }

  if (answer.morale) {
    const before = player.morale;
    player.morale = clamp(before + answer.morale, 0, 100);
    track(changes, 'change.morale', before, player.morale);
  }
  if (answer.fame) {
    const before = player.fame;
    player.fame = clamp(before + answer.fame, 0, 100);
    track(changes, 'change.fame', before, player.fame);
  }
  if (answer.reputation) {
    const before = player.reputation;
    player.reputation = clamp(before + answer.reputation, 0, 100);
    track(changes, 'change.reputation', before, player.reputation);
  }

  if (answer.backsItUp) {
    state.flags['claimAttribute'] = answer.backsItUp.attribute;
    state.flags['claimSwing'] = answer.backsItUp.swing;
  }

  return {
    changes,
    consequences: [],
    ...(answer.backsItUp ? { narrativeKey: 'milestone.claimMade' } : {}),
  };
}

/**
 * Settling what he said. The rating in the match that followed decides it: back the words
 * up and the attribute he staked goes up by more than he risked, fall short and it goes
 * down by more than he stood to gain. Nobody remembers a quiet man who had a bad game.
 */
export function settleClaim(rng: Rng, state: CareerState, rating: number): ClaimSettlement | null {
  const attribute = state.flags['claimAttribute'];
  const swing = Number(state.flags['claimSwing'] ?? 0);
  if (typeof attribute !== 'string' || swing <= 0) return null;

  state.flags['claimAttribute'] = '';
  state.flags['claimSwing'] = 0;

  const key = attribute as AttributeKey;
  if (state.player.attributes[key] === undefined) return null;

  const performance = (rating - 6.7) / 1.3;
  const carried = performance + rng.gauss(0, 0.3) > 0;
  const changes: AppliedChange[] = [];

  const attrBefore = state.player.attributes[key];
  const room =
    overall(state.player.attributes, state.player.primaryPos, state.player.secondaryPos) <
    state.player.potential;
  const move = carried ? (room ? swing : 0) : -swing * 1.15;
  state.player.attributes[key] = clamp(attrBefore + move, 1, 99);
  track(changes, `change.attr.${key}`, attrBefore, state.player.attributes[key]);

  const moraleBefore = state.player.morale;
  state.player.morale = clamp(moraleBefore + (carried ? 6 : -8), 0, 100);
  track(changes, 'change.morale', moraleBefore, state.player.morale);

  const mediaBefore = state.relationships.media;
  state.relationships.media = clamp(mediaBefore + (carried ? 6 : -8), 0, 100);
  track(changes, 'change.media', mediaBefore, state.relationships.media);

  const fansBefore = state.relationships.fans;
  state.relationships.fans = clamp(fansBefore + (carried ? 7 : -9), 0, 100);
  track(changes, 'change.fans', fansBefore, state.relationships.fans);

  return {
    carried,
    result: {
      changes,
      consequences: [],
      narrativeKey: carried ? 'milestone.claimKept' : 'milestone.claimBroken',
    },
  };
}
