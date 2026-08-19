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
import type { AttributeKey, CareerState, MatchImportance, PersonalityKey } from './types.js';

export type MilestoneId =
  | 'debut'
  | 'firstGoal'
  | 'derby'
  | 'bigMatch'
  | 'firstAfterTransfer'
  | 'againstOldClub'
  | 'transferRumour'
  | 'trophyNight';

export interface MilestoneAnswer {
  id: string;
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
}

export interface MilestoneQuestion {
  id: MilestoneId;
  answers: MilestoneAnswer[];
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
        personality: { professionalism: 1.2, ambition: -0.6 },
        relationships: { manager: 5, media: -2 },
        morale: 2,
      },
      {
        // Tells the country he belongs here. Now he has to look like he does.
        id: 'bold',
        attributes: { composure: 1.4 },
        personality: { ambition: 1.4, pressureHandling: -0.8 },
        relationships: { fans: 7, media: 6, teammates: -4 },
        fame: 3,
        backsItUp: { attribute: 'composure', swing: 2.2 },
      },
      {
        // Thanks the people who got him here. Cheap, warm, and forgotten by Tuesday.
        id: 'family',
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
        personality: { professionalism: 1 },
        relationships: { teammates: 8, manager: 4, media: -3 },
      },
      {
        id: 'moreToCome',
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
        attributes: { concentration: 1 },
        personality: { professionalism: 0.8 },
        relationships: { manager: 5, fans: -5 },
      },
      {
        // Tells the other lot exactly what is coming. The crowd loves it. The other lot
        // read it too.
        id: 'fire',
        attributes: { composure: -1.1 },
        personality: { determination: 1.4, discipline: -1 },
        relationships: { fans: 12, media: 7, manager: -4 },
        fame: 4,
        backsItUp: { attribute: 'composure', swing: 2.6 },
      },
      {
        id: 'deflect',
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
        attributes: { concentration: 1.1 },
        personality: { pressureHandling: 1 },
        relationships: { manager: 4, media: -3 },
      },
      {
        id: 'ourNight',
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
        personality: { ambition: 1.2, pressureHandling: -1 },
        relationships: { fans: 10, media: 5, teammates: -3 },
        reputation: 2,
        backsItUp: { attribute: 'decisions', swing: 2 },
      },
      {
        id: 'settleIn',
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
        personality: { loyalty: 1.5 },
        relationships: { fans: -6, media: 3 },
        morale: -3,
      },
      {
        id: 'movedOn',
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
        personality: { loyalty: 1.4, ambition: -1 },
        relationships: { board: 8, manager: 6, fans: 6 },
      },
      {
        // Refuses to rule it out, which in this business is a yes.
        id: 'flattered',
        personality: { ambition: 1.6, loyalty: -1.2 },
        relationships: { board: -8, fans: -7, manager: -5, media: 6 },
        reputation: 3,
      },
      {
        id: 'noComment',
        attributes: { concentration: 0.8 },
        relationships: { media: -5 },
      },
    ],
  },
  {
    id: 'trophyNight',
    answers: [
      {
        id: 'creditThem',
        personality: { professionalism: 1.3 },
        relationships: { teammates: 10, manager: 6, board: 4 },
        morale: 6,
      },
      {
        id: 'firstOfMany',
        attributes: { composure: 1 },
        personality: { ambition: 1.6, consistency: -0.8 },
        relationships: { fans: 8, media: 7 },
        fame: 6,
        backsItUp: { attribute: 'decisions', swing: 2.2 },
      },
    ],
  },
];

/**
 * Which question this moment asks, if it asks one at all. Most weeks it asks nothing,
 * which is the point: a microphone means something because it is not always there.
 */
export function milestoneFor(importance: MatchImportance, ctx: { weeksAtNewClub: number; rumoured: boolean }): MilestoneId | null {
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
      break;
  }
  if (ctx.weeksAtNewClub >= 0 && ctx.weeksAtNewClub <= 2) return 'firstAfterTransfer';
  if (ctx.rumoured) return 'transferRumour';
  return null;
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
export function applyMilestoneAnswer(state: CareerState, answer: MilestoneAnswer): void {
  const player = state.player;

  for (const [key, delta] of Object.entries(answer.attributes ?? {})) {
    const attribute = key as AttributeKey;
    player.attributes[attribute] = clamp(player.attributes[attribute] + delta, 1, 99);
  }
  for (const [key, delta] of Object.entries(answer.personality ?? {})) {
    const trait = key as PersonalityKey;
    player.personality[trait] = clamp(player.personality[trait] + delta, 1, 99);
  }
  for (const [key, delta] of Object.entries(answer.relationships ?? {})) {
    const who = key as 'manager' | 'teammates' | 'fans' | 'board' | 'media';
    state.relationships[who] = clamp(state.relationships[who] + delta, 0, 100);
    if (who === 'manager') state.managerTrust = clamp(state.managerTrust + delta, 0, 100);
  }

  if (answer.morale) player.morale = clamp(player.morale + answer.morale, 0, 100);
  if (answer.fame) player.fame = clamp(player.fame + answer.fame, 0, 100);
  if (answer.reputation) player.reputation = clamp(player.reputation + answer.reputation, 0, 100);

  if (answer.backsItUp) {
    state.flags['claimAttribute'] = answer.backsItUp.attribute;
    state.flags['claimSwing'] = answer.backsItUp.swing;
  }
}

/**
 * Settling what he said. The rating in the match that followed decides it: back the words
 * up and the attribute he staked goes up by more than he risked, fall short and it goes
 * down by more than he stood to gain. Nobody remembers a quiet man who had a bad game.
 */
export function settleClaim(rng: Rng, state: CareerState, rating: number): boolean | null {
  const attribute = state.flags['claimAttribute'];
  const swing = Number(state.flags['claimSwing'] ?? 0);
  if (typeof attribute !== 'string' || swing <= 0) return null;

  state.flags['claimAttribute'] = '';
  state.flags['claimSwing'] = 0;

  const key = attribute as AttributeKey;
  if (state.player.attributes[key] === undefined) return null;

  const performance = (rating - 6.7) / 1.3;
  const carried = performance + rng.gauss(0, 0.3) > 0;
  state.player.attributes[key] = clamp(state.player.attributes[key] + swing * (carried ? 1 : -1.15), 1, 99);
  state.player.morale = clamp(state.player.morale + (carried ? 6 : -8), 0, 100);
  state.relationships.media = clamp(state.relationships.media + (carried ? 6 : -8), 0, 100);
  state.relationships.fans = clamp(state.relationships.fans + (carried ? 7 : -9), 0, 100);
  return carried;
}
