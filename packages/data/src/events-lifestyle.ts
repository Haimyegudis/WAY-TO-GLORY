import type { CareerEventDef, CareerEventOption, EventEffect, EventTrigger } from '@fc/engine';

/**
 * The small stuff: shawarma with the lads, a late night on the console, a family
 * barbecue two days before a game. None of it decides a career on its own, and that
 * is the point - every option here costs a little and gives a little, and nothing it
 * does cannot be trained back within a few weeks. The player should feel the choice
 * without ever being stuck because of one.
 *
 * Scale, deliberately gentle: attributes move by at most a point, relationships by
 * five or six, fatigue by single digits.
 */

type Kind = EventEffect['kind'];

function e(kind: Kind, value: number, key?: string, chance?: number): EventEffect {
  return { kind, value, ...(key ? { key } : {}), ...(chance !== undefined ? { chance } : {}) };
}

function opt(eventId: string, id: string, effects: EventEffect[], riskKey?: string): CareerEventOption {
  return { id, labelKey: `event.${eventId}.${id}`, ...(riskKey ? { riskKey } : {}), effects };
}

function ev(
  id: string,
  weight: number,
  cooldownWeeks: number,
  trigger: EventTrigger,
  options: CareerEventOption[],
): CareerEventDef {
  return { id, category: 'personal', weight, cooldownWeeks, trigger, textKey: `event.${id}`, options };
}

export const EVENTS_LIFESTYLE: CareerEventDef[] = [
  // The one he asked for: the whole squad is going for shawarma.
  ev('lads_shawarma', 30, 14, { ageRange: [16, 38] }, [
    opt('lads_shawarma', 'join', [
      e('relationship', 6, 'teammates'), e('morale', 4),
      e('attribute', -0.8, 'pace'), e('attribute', -0.5, 'acceleration'), e('fatigue', 3),
    ]),
    opt('lads_shawarma', 'skip', [
      e('relationship', -5, 'teammates'), e('morale', -2), e('personality', 1, 'professionalism'),
    ]),
    opt('lads_shawarma', 'come_eat_light', [
      e('relationship', 3, 'teammates'), e('morale', 1), e('attribute', -0.2, 'pace'),
    ]),
  ]),
  ev('night_out_after_win', 28, 16, { ageRange: [17, 32] }, [
    opt('night_out_after_win', 'go', [
      e('relationship', 6, 'teammates'), e('morale', 5), e('fatigue', 8), e('fitness', -2),
    ], 'risk.low'),
    opt('night_out_after_win', 'one_hour', [e('relationship', 3, 'teammates'), e('morale', 2), e('fatigue', 3)]),
    opt('night_out_after_win', 'home', [e('relationship', -3, 'teammates'), e('fatigue', -3), e('personality', 1, 'professionalism')]),
  ]),
  ev('console_late', 26, 12, { ageRange: [16, 28] }, [
    opt('console_late', 'play_late', [e('morale', 4), e('fatigue', 7), e('attribute', -0.4, 'concentration')]),
    opt('console_late', 'lights_out', [e('fatigue', -4), e('attribute', 0.3, 'concentration')]),
  ]),
  ev('family_barbecue', 24, 18, { ageRange: [16, 38] }, [
    opt('family_barbecue', 'go_eat', [e('morale', 6), e('attribute', -0.6, 'stamina'), e('fatigue', 2)]),
    opt('family_barbecue', 'go_careful', [e('morale', 4), e('attribute', -0.15, 'stamina')]),
    opt('family_barbecue', 'stay_home', [e('morale', -3), e('personality', 1, 'professionalism')]),
  ]),
  ev('energy_drinks', 20, 20, { ageRange: [16, 30] }, [
    opt('energy_drinks', 'drink', [e('fatigue', -5), e('attribute', -0.5, 'concentration'), e('fitness', -1)]),
    opt('energy_drinks', 'water', [e('attribute', 0.3, 'stamina')]),
  ]),
  ev('beach_day_off', 22, 20, { ageRange: [16, 34] }, [
    opt('beach_day_off', 'beach', [e('morale', 5), e('relationship', 4, 'teammates'), e('fatigue', 2)]),
    opt('beach_day_off', 'extra_session', [e('attribute', 0.5, 'stamina'), e('fatigue', 5), e('relationship', -3, 'teammates')]),
    opt('beach_day_off', 'sleep_in', [e('fatigue', -7), e('morale', 2)]),
  ]),
  ev('teammate_birthday', 22, 22, { ageRange: [16, 36] }, [
    opt('teammate_birthday', 'go_all_in', [e('relationship', 7, 'teammates'), e('morale', 4), e('fatigue', 6), e('attribute', -0.4, 'pace')]),
    opt('teammate_birthday', 'show_face', [e('relationship', 4, 'teammates'), e('fatigue', 2)]),
    opt('teammate_birthday', 'send_message', [e('relationship', -4, 'teammates')]),
  ]),
  ev('ice_bath_routine', 18, 24, { ageRange: [17, 38] }, [
    opt('ice_bath_routine', 'commit', [e('fatigue', -6), e('injuryRisk', -4), e('morale', -2)]),
    opt('ice_bath_routine', 'skip_it', [e('morale', 2), e('injuryRisk', 3)]),
  ]),
  ev('sleep_tracking', 18, 26, { ageRange: [17, 36] }, [
    opt('sleep_tracking', 'follow_it', [e('fatigue', -5), e('attribute', 0.4, 'concentration'), e('morale', -2)]),
    opt('sleep_tracking', 'ignore_it', [e('morale', 2)]),
  ]),
  ev('street_football_kids', 20, 26, { ageRange: [16, 30] }, [
    opt('street_football_kids', 'play', [e('morale', 5), e('fame', 1), e('attribute', 0.4, 'dribbling'), e('fatigue', 4)], 'risk.low'),
    opt('street_football_kids', 'photos_only', [e('fame', 1), e('morale', 1)]),
  ]),
  ev('long_drive_home', 16, 24, { ageRange: [16, 38] }, [
    opt('long_drive_home', 'drive', [e('morale', 4), e('fatigue', 6)]),
    opt('long_drive_home', 'stay_near_club', [e('fatigue', -3), e('morale', -2)]),
  ]),
  ev('nutritionist_cheat_meal', 18, 20, { ageRange: [16, 38] }, [
    opt('nutritionist_cheat_meal', 'take_it', [e('morale', 5), e('attribute', -0.4, 'pace')]),
    opt('nutritionist_cheat_meal', 'stay_strict', [e('morale', -3), e('attribute', 0.3, 'stamina'), e('personality', 1, 'professionalism')]),
  ]),
];
