import type { CareerEventDef, CareerEventOption, EventEffect, EventOutcome, EventTrigger } from '@fc/engine';

/**
 * The decisions with no right answer.
 *
 * Everything else in the event list is a small trade: a little morale for a little
 * fitness. These are different - each one can make a career or cost a season, and
 * which it turns out to be is rolled when the choice is made and tilted by the player
 * himself. Ask an agent to force a move abroad and it might end with a big club and a
 * bigger wage, or with a manager who never trusts you again and a season in the
 * stands. The same choice, on another career, plays out the other way.
 */

type Kind = EventEffect['kind'];

function e(kind: Kind, value: number, key?: string, chance?: number): EventEffect {
  return { kind, value, ...(key ? { key } : {}), ...(chance !== undefined ? { chance } : {}) };
}

function outcome(
  key: string,
  weight: number,
  effects: EventEffect[],
  swayedBy?: EventOutcome['swayedBy'],
  sway?: number,
): EventOutcome {
  return { key, weight, effects, ...(swayedBy ? { swayedBy } : {}), ...(sway !== undefined ? { sway } : {}) };
}

function opt(
  eventId: string,
  id: string,
  effects: EventEffect[],
  outcomes?: EventOutcome[],
  riskKey?: string,
): CareerEventOption {
  return {
    id,
    labelKey: `event.${eventId}.${id}`,
    ...(riskKey ? { riskKey } : {}),
    effects,
    ...(outcomes ? { outcomes } : {}),
  };
}

function ev(
  id: string,
  category: CareerEventDef['category'],
  weight: number,
  cooldownWeeks: number,
  trigger: EventTrigger,
  options: CareerEventOption[],
): CareerEventDef {
  return { id, category, weight, cooldownWeeks, trigger, textKey: `event.${id}`, options };
}

export const EVENTS_DILEMMAS: CareerEventDef[] = [
  // The agent wants to force a move abroad.
  ev('agent_push_abroad', 'agent', 20, 60, { ageRange: [18, 30], hasAgent: true }, [
    opt('agent_push_abroad', 'let_him_push', [e('agentRelationship', 6)], [
      outcome('landed', 5, [
        e('reputation', 7), e('fame', 5), e('morale', 8), e('relationship', -6, 'manager'),
      ], 'reputation', 0.8),
      outcome('collapsed', 5, [
        e('relationship', -18, 'manager'), e('squadRole', -1), e('morale', -12), e('reputation', -3),
      ], 'reputation', -0.6),
    ], 'risk.high'),
    opt('agent_push_abroad', 'stay_quiet', [
      e('relationship', 5, 'manager'), e('agentRelationship', -8), e('morale', -3),
    ]),
  ]),

  // A bigger club wants him, but as a squad player.
  ev('big_club_bench_offer', 'transfer', 18, 52, { ageRange: [19, 29] }, [
    opt('big_club_bench_offer', 'chase_it', [e('morale', 4)], [
      outcome('breaks_in', 4, [
        e('reputation', 9), e('fame', 6), e('attribute', 1.5, 'composure'), e('morale', 6),
      ], 'form', 0.9),
      outcome('lost_year', 6, [
        e('form', -14), e('morale', -12), e('attribute', -1.2, 'concentration'), e('reputation', -2),
      ], 'form', -0.7),
    ], 'risk.high'),
    opt('big_club_bench_offer', 'stay_and_play', [
      e('relationship', 6, 'manager'), e('morale', 3), e('personality', 1, 'loyalty'),
    ]),
  ]),

  // Play through a knock in a match that matters.
  ev('play_through_knock', 'medical', 22, 40, { ageRange: [17, 36] }, [
    opt('play_through_knock', 'play', [e('relationship', 8, 'manager'), e('relationship', 6, 'fans')], [
      outcome('held_up', 5, [e('morale', 8), e('reputation', 4), e('relationship', 5, 'teammates')], 'determination', 0.5),
      outcome('broke_down', 5, [e('injuryRisk', 40), e('morale', -10), e('fitness', -12)], 'determination', -0.4),
    ], 'risk.high'),
    opt('play_through_knock', 'pull_out', [
      e('relationship', -7, 'manager'), e('relationship', -5, 'fans'), e('injuryRisk', -15), e('personality', 2, 'professionalism'),
    ]),
  ]),

  // The manager asks him to learn a new position.
  ev('new_position_ask', 'manager', 20, 48, { ageRange: [17, 32] }, [
    opt('new_position_ask', 'learn_it', [e('relationship', 9, 'manager')], [
      outcome('took_to_it', 6, [
        e('learnPosition', 1), e('attribute', 1.6, 'positioning'), e('morale', 5), e('reputation', 3),
      ], 'determination', 0.6),
      outcome('never_settled', 4, [
        e('form', -10), e('morale', -8), e('relationship', -5, 'manager'),
      ], 'determination', -0.5),
    ], 'risk.medium'),
    opt('new_position_ask', 'refuse', [
      e('relationship', -10, 'manager'), e('morale', 2), e('personality', -1, 'adaptability'),
    ]),
  ]),

  // A sponsor wants him for a campaign in the middle of the season.
  ev('sponsor_campaign', 'sponsor', 16, 44, { ageRange: [18, 34] }, [
    opt('sponsor_campaign', 'sign_it', [e('money', 60_000), e('fame', 5)], [
      outcome('handled_it', 5, [e('morale', 6), e('reputation', 3)], 'determination', 0.4),
      outcome('distracted', 5, [e('form', -9), e('relationship', -7, 'manager'), e('personality', -1, 'professionalism')]),
    ], 'risk.medium'),
    opt('sponsor_campaign', 'after_the_season', [e('relationship', 4, 'manager'), e('money', 10_000)]),
  ]),

  // The captain's armband, offered early.
  ev('early_armband', 'club', 15, 60, { ageRange: [21, 32] }, [
    opt('early_armband', 'take_it', [e('relationship', 5, 'board')], [
      outcome('grew_into_it', 5, [
        e('attribute', 2.2, 'leadership'), e('relationship', 10, 'teammates'), e('reputation', 6), e('morale', 7),
      ], 'managerTrust', 0.7),
      outcome('too_soon', 5, [
        e('relationship', -8, 'teammates'), e('form', -8), e('morale', -8),
      ], 'managerTrust', -0.6),
    ], 'risk.high'),
    opt('early_armband', 'not_yet', [e('relationship', 3, 'teammates'), e('morale', -2)]),
  ]),

  // Speak out publicly about not playing.
  ev('speak_out_minutes', 'media', 18, 40, { ageRange: [18, 34] }, [
    opt('speak_out_minutes', 'say_it', [e('relationship', 5, 'fans')], [
      outcome('got_a_run', 4, [
        e('squadRole', 1), e('morale', 8), e('relationship', 4, 'manager'),
      ], 'reputation', 0.9),
      outcome('frozen_out', 6, [
        e('relationship', -16, 'manager'), e('squadRole', -1), e('morale', -10),
      ], 'reputation', -0.8),
    ], 'risk.high'),
    opt('speak_out_minutes', 'keep_it_inside', [e('morale', -5), e('relationship', 4, 'manager')]),
  ]),

  // A country calls: switch allegiance for guaranteed caps.
  ev('switch_allegiance', 'national', 14, 80, { ageRange: [19, 30] }, [
    opt('switch_allegiance', 'consider_it', [e('fame', 3)], [
      outcome('capped', 5, [
        e('reputation', 8), e('fame', 7), e('morale', 8), e('relationship', -6, 'fans'),
      ], 'fame', 0.5),
      outcome('left_out', 5, [
        e('morale', -10), e('relationship', -10, 'fans'), e('reputation', -3),
      ]),
    ], 'risk.high'),
    opt('switch_allegiance', 'stay_loyal', [e('relationship', 8, 'fans'), e('personality', 2, 'loyalty')]),
  ]),

  // Train with a specialist abroad in the off-season, at the club's displeasure.
  ev('private_coach_abroad', 'personal', 16, 52, { ageRange: [18, 33] }, [
    opt('private_coach_abroad', 'go', [e('money', -40_000), e('relationship', -5, 'manager')], [
      outcome('transformed', 5, [
        e('attribute', 2.4, 'finishing'), e('attribute', 1.6, 'firstTouch'), e('morale', 6),
      ], 'determination', 0.8),
      outcome('wasted', 5, [
        e('fatigue', 18), e('morale', -6), e('form', -6),
      ], 'determination', -0.5),
    ], 'risk.medium'),
    opt('private_coach_abroad', 'club_programme', [e('relationship', 5, 'manager'), e('fitness', 4)]),
  ]),

  // A move to a league nobody watches, for a lot of money.
  ev('money_league_offer', 'transfer', 14, 60, { ageRange: [24, 36] }, [
    opt('money_league_offer', 'take_the_money', [e('money', 400_000), e('morale', 5)], [
      outcome('comfortable', 6, [e('reputation', -8), e('fame', -4), e('form', -5)]),
      outcome('reinvented', 4, [e('reputation', 3), e('morale', 8), e('attribute', 1.2, 'composure')], 'determination', 0.6),
    ], 'risk.medium'),
    opt('money_league_offer', 'stay_competitive', [e('relationship', 6, 'fans'), e('personality', 1, 'ambition')]),
  ]),
];
