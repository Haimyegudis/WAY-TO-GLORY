import type { CareerEventDef, CareerEventOption, EventEffect, EventTrigger } from '@fc/engine';

/**
 * A second wave of career events, written after playing the first set and finding
 * it repeated too soon. These lean on the relationship system: most of them move
 * the dressing room, the stands or the board rather than just a stat.
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
  category: CareerEventDef['category'],
  weight: number,
  cooldownWeeks: number,
  trigger: EventTrigger,
  options: CareerEventOption[],
  oncePerCareer = false,
): CareerEventDef {
  return {
    id,
    category,
    weight,
    cooldownWeeks,
    ...(oncePerCareer ? { oncePerCareer: true } : {}),
    trigger,
    textKey: `event.${id}`,
    options,
  };
}

export const EVENTS_EXTRA: CareerEventDef[] = [
  // ---------------------------------------------------------------- dressing room
  ev('captain_asks_standards', 'club', 26, 40, { ageRange: [17, 34] }, [
    opt('captain_asks_standards', 'follow', [e('relationship', 8, 'teammates'), e('personality', 2, 'professionalism'), e('fatigue', 5)]),
    opt('captain_asks_standards', 'ignore', [e('relationship', -7, 'teammates'), e('morale', 3)], 'risk.medium'),
  ]),
  ev('teammate_asks_cover', 'club', 24, 36, { ageRange: [18, 34] }, [
    opt('teammate_asks_cover', 'cover', [e('relationship', 9, 'teammates'), e('relationship', -5, 'manager', 0.4)], 'risk.medium'),
    opt('teammate_asks_cover', 'refuse', [e('relationship', -6, 'teammates'), e('relationship', 4, 'manager')]),
  ]),
  ev('young_player_asks_advice', 'club', 22, 40, { ageRange: [24, 38] }, [
    opt('young_player_asks_advice', 'help', [e('relationship', 7, 'teammates'), e('attribute', 1.2, 'leadership')]),
    opt('young_player_asks_advice', 'brush_off', [e('relationship', -5, 'teammates')]),
  ]),
  ev('dressing_room_music', 'club', 18, 30, { ageRange: [17, 30] }, [
    opt('dressing_room_music', 'take_over', [e('relationship', 5, 'teammates'), e('fame', 1)]),
    opt('dressing_room_music', 'leave_it', []),
  ]),
  ev('senior_criticises_you', 'club', 22, 34, { ageRange: [17, 28] }, [
    opt('senior_criticises_you', 'accept', [e('relationship', 6, 'teammates'), e('personality', 2, 'professionalism'), e('morale', -3)]),
    opt('senior_criticises_you', 'answer_back', [e('relationship', -9, 'teammates'), e('morale', 4)], 'risk.medium'),
  ]),

  // ---------------------------------------------------------------- supporters
  ev('fans_chant_your_name', 'media', 20, 34, { ageRange: [17, 38], minMorale: 45 }, [
    opt('fans_chant_your_name', 'salute', [e('relationship', 8, 'fans'), e('morale', 6), e('fame', 2)]),
    opt('fans_chant_your_name', 'stay_focused', [e('personality', 2, 'consistency'), e('relationship', 2, 'fans')]),
  ]),
  ev('fans_criticise_effort', 'media', 24, 30, { ageRange: [17, 38], maxMinutesSeasonPct: 0.75 }, [
    opt('fans_criticise_effort', 'answer_on_pitch', [e('form', 5), e('fatigue', 6), e('relationship', 3, 'fans')]),
    opt('fans_criticise_effort', 'answer_in_press', [e('relationship', -8, 'fans'), e('fame', 4), e('relationship', -3, 'manager')], 'risk.high'),
    opt('fans_criticise_effort', 'say_nothing', [e('relationship', -2, 'fans'), e('personality', 2, 'pressureHandling'), e('morale', -3)]),
  ]),
  ev('supporter_child_letter', 'personal', 18, 60, { ageRange: [18, 38] }, [
    opt('supporter_child_letter', 'reply', [e('relationship', 6, 'fans'), e('morale', 4)]),
    opt('supporter_child_letter', 'ignore', [e('relationship', -2, 'fans')]),
  ]),
  ev('ultras_meeting_request', 'media', 16, 60, { ageRange: [19, 36] }, [
    opt('ultras_meeting_request', 'meet', [e('relationship', 10, 'fans'), e('relationship', -3, 'board')], 'risk.medium'),
    opt('ultras_meeting_request', 'decline', [e('relationship', -4, 'fans'), e('relationship', 3, 'board')]),
  ]),
  ev('supporters_forum', 'media', 18, 52, { ageRange: [19, 36], minMinutesSeasonPct: 0.2 }, [
    opt('supporters_forum', 'listen', [e('relationship', 9, 'fans'), e('morale', -2), e('attribute', 1, 'leadership')]),
    opt('supporters_forum', 'promise_effort', [e('relationship', 6, 'fans'), e('form', 3), e('fatigue', 5)]),
    opt('supporters_forum', 'challenge_them', [e('relationship', -9, 'fans'), e('fame', 4), e('custom', 1, 'incidentWithFans')], 'risk.high'),
  ]),
  ev('shirt_number_offer', 'club', 16, 80, { ageRange: [18, 34], minOvr: 68 }, [
    opt('shirt_number_offer', 'take_ten', [e('fame', 6), e('relationship', 5, 'fans'), e('morale', 5)], 'risk.medium'),
    opt('shirt_number_offer', 'keep_yours', [e('personality', 2, 'consistency')]),
  ]),

  // ---------------------------------------------------------------- manager and staff
  ev('manager_private_video', 'manager', 24, 30, { ageRange: [17, 34] }, [
    opt('manager_private_video', 'study', [e('relationship', 6, 'manager'), e('attribute', 1.4, 'positioning')]),
    opt('manager_private_video', 'dismiss', [e('relationship', -6, 'manager')]),
  ]),
  ev('manager_new_role_test', 'manager', 20, 44, { ageRange: [18, 32], minMinutesSeasonPct: 0.25 }, [
    opt('manager_new_role_test', 'try', [e('relationship', 7, 'manager'), e('attribute', 1, 'decisions')]),
    opt('manager_new_role_test', 'refuse', [e('relationship', -8, 'manager')], 'risk.medium'),
  ]),
  ev('assistant_coach_conflict', 'manager', 18, 40, { ageRange: [18, 34] }, [
    opt('assistant_coach_conflict', 'smooth', [e('relationship', 4, 'manager'), e('personality', 2, 'adaptability')]),
    opt('assistant_coach_conflict', 'escalate', [e('relationship', -7, 'manager'), e('custom', 1, 'incidentWithManager')], 'risk.high'),
  ]),
  ev('manager_sacked', 'manager', 14, 60, { ageRange: [17, 38] }, [
    opt('manager_sacked', 'stay_professional', [e('relationship', 4, 'board'), e('personality', 2, 'professionalism')]),
    opt('manager_sacked', 'praise_him_publicly', [e('relationship', 6, 'fans'), e('relationship', -4, 'board')], 'risk.medium'),
  ]),
  ev('training_ground_test', 'manager', 22, 36, { ageRange: [17, 30] }, [
    opt('training_ground_test', 'go_hard', [e('relationship', 6, 'manager'), e('fatigue', 10), e('injuryRisk', 10)], 'risk.medium'),
    opt('training_ground_test', 'measured', [e('relationship', 2, 'manager')]),
  ]),
  ev('manager_role_review', 'manager', 20, 48, { ageRange: [18, 34], minMinutesSeasonPct: 0.2 }, [
    opt('manager_role_review', 'ask_clarity', [e('relationship', 5, 'manager'), e('attribute', 1, 'decisions')]),
    opt('manager_role_review', 'accept_flexible', [e('relationship', 8, 'manager'), e('personality', 2, 'adaptability'), e('morale', -3)]),
    opt('manager_role_review', 'challenge_role', [e('relationship', -8, 'manager'), e('morale', 5), e('personality', 1, 'determination')], 'risk.medium'),
  ]),

  // ---------------------------------------------------------------- board and money
  ev('board_bonus_offer', 'club', 18, 60, { ageRange: [18, 36], minOvr: 62 }, [
    opt('board_bonus_offer', 'accept_goals', [e('custom', 1, 'goalBonusDeal'), e('relationship', 3, 'board')]),
    opt('board_bonus_offer', 'accept_appearances', [e('custom', 1, 'appearanceBonusDeal'), e('relationship', 3, 'board')]),
    opt('board_bonus_offer', 'refuse', [e('relationship', -2, 'board')]),
  ]),
  ev('club_open_day', 'club', 20, 40, { ageRange: [17, 38] }, [
    opt('club_open_day', 'attend', [e('relationship', 6, 'fans'), e('relationship', 4, 'board'), e('fatigue', 4)]),
    opt('club_open_day', 'skip', [e('relationship', -4, 'board'), e('relationship', -3, 'fans')]),
  ]),
  ev('sponsor_photoshoot', 'sponsor', 20, 40, { ageRange: [18, 36], minOvr: 60 }, [
    opt('sponsor_photoshoot', 'do_it', [e('money', 60000), e('fame', 4), e('fatigue', 5)]),
    opt('sponsor_photoshoot', 'skip', [e('relationship', -3, 'board')]),
  ]),
  ev('wage_delay', 'club', 14, 70, { ageRange: [17, 38], tierIn: [2, 3] }, [
    opt('wage_delay', 'be_patient', [e('relationship', 8, 'board'), e('morale', -5)]),
    opt('wage_delay', 'go_public', [e('relationship', -12, 'board'), e('relationship', 5, 'teammates'), e('fame', 4)], 'risk.high'),
  ]),

  // ---------------------------------------------------------------- media
  ev('podcast_invite', 'media', 20, 44, { ageRange: [19, 36], minOvr: 64 }, [
    opt('podcast_invite', 'go_on', [e('fame', 7), e('relationship', 3, 'media'), e('relationship', -2, 'manager')]),
    opt('podcast_invite', 'decline', [e('relationship', -2, 'media')]),
  ]),
  ev('journalist_asks_about_manager', 'media', 22, 34, { ageRange: [18, 36] }, [
    opt('journalist_asks_about_manager', 'back_him', [e('relationship', 7, 'manager'), e('relationship', 2, 'media')]),
    opt('journalist_asks_about_manager', 'stay_neutral', [e('personality', 2, 'professionalism')]),
    opt('journalist_asks_about_manager', 'criticise', [e('relationship', -14, 'manager'), e('fame', 5), e('custom', 1, 'incidentWithManager')], 'risk.high'),
  ]),
  ev('rumour_about_move', 'media', 22, 30, { ageRange: [18, 34] }, [
    opt('rumour_about_move', 'deny', [e('relationship', 6, 'fans'), e('relationship', 4, 'board')]),
    opt('rumour_about_move', 'refuse_to_comment', [e('relationship', -5, 'fans'), e('fame', 3)], 'risk.medium'),
  ]),
  ev('viral_training_clip', 'media', 18, 44, { ageRange: [17, 32] }, [
    opt('viral_training_clip', 'enjoy_it', [e('fame', 8), e('relationship', 3, 'fans'), e('relationship', -3, 'manager')]),
    opt('viral_training_clip', 'ask_to_remove', [e('relationship', 4, 'manager'), e('fame', -2)]),
  ]),
  ev('press_asks_about_teammate', 'media', 18, 48, { ageRange: [20, 38], minMinutesSeasonPct: 0.25 }, [
    opt('press_asks_about_teammate', 'praise_him', [e('relationship', 7, 'teammates'), e('relationship', 2, 'media'), e('fame', -1)]),
    opt('press_asks_about_teammate', 'protect_him', [e('relationship', 9, 'teammates'), e('relationship', 3, 'manager'), e('relationship', -3, 'media')]),
    opt('press_asks_about_teammate', 'make_it_about_me', [e('fame', 5), e('relationship', -8, 'teammates'), e('relationship', -3, 'fans')], 'risk.medium'),
  ]),

  // ---------------------------------------------------------------- body and mind
  ev('sleep_problems', 'medical', 20, 36, { ageRange: [17, 36] }, [
    opt('sleep_problems', 'see_specialist', [e('money', -12000), e('fitness', 6), e('attribute', 0.8, 'concentration')]),
    opt('sleep_problems', 'push_through', [e('fitness', -5), e('injuryRisk', 12)], 'risk.medium'),
  ]),
  ev('nutrition_slip', 'medical', 18, 36, { ageRange: [17, 34] }, [
    opt('nutrition_slip', 'tighten_up', [e('personality', 2, 'professionalism'), e('fitness', 4)]),
    opt('nutrition_slip', 'carry_on', [e('fitness', -6), e('relationship', -3, 'manager', 0.4)]),
  ]),
  ev('psychologist_offer', 'medical', 18, 60, { ageRange: [17, 36], maxMorale: 55 }, [
    opt('psychologist_offer', 'start_sessions', [e('money', -20000), e('morale', 8), e('personality', 3, 'pressureHandling')]),
    opt('psychologist_offer', 'decline', []),
  ]),
  ev('recovery_tech_offer', 'medical', 16, 60, { ageRange: [20, 38] }, [
    opt('recovery_tech_offer', 'buy', [e('money', -80000), e('fatigue', -12), e('injuryRisk', -8)]),
    opt('recovery_tech_offer', 'skip', []),
  ]),

  // ---------------------------------------------------------------- life
  ev('house_move', 'personal', 16, 70, { ageRange: [19, 36] }, [
    opt('house_move', 'near_training', [e('fatigue', -8), e('personality', 2, 'professionalism'), e('money', -150000), e('fitness', 3)]),
    opt('house_move', 'city_centre', [e('morale', 6), e('fame', 3), e('money', -220000)]),
  ]),
  ev('old_friend_asks_money', 'personal', 16, 60, { ageRange: [19, 38] }, [
    opt('old_friend_asks_money', 'lend', [e('money', -70000), e('morale', 3)], 'risk.medium'),
    opt('old_friend_asks_money', 'refuse', [e('morale', -4), e('personality', 2, 'determination')]),
  ]),
  ev('driving_ban_risk', 'personal', 12, 80, { ageRange: [18, 32] }, [
    opt('driving_ban_risk', 'apologise_publicly', [e('relationship', -4, 'fans'), e('relationship', -3, 'board'), e('personality', 2, 'discipline')]),
    opt('driving_ban_risk', 'say_nothing', [e('relationship', -8, 'fans'), e('custom', 1, 'incidentWithFans')], 'risk.high'),
  ]),
  ev('charity_match_invite', 'personal', 18, 50, { ageRange: [19, 38] }, [
    opt('charity_match_invite', 'play', [e('relationship', 7, 'fans'), e('fatigue', 8), e('injuryRisk', 8)], 'risk.medium'),
    opt('charity_match_invite', 'send_shirt', [e('relationship', 3, 'fans')]),
  ]),
  ev('family_pressure_move_home', 'personal', 14, 70, { ageRange: [22, 36] }, [
    opt('family_pressure_move_home', 'listen', [e('custom', 1, 'wantsHomecoming'), e('morale', 4)]),
    opt('family_pressure_move_home', 'stay_put', [e('morale', -3), e('personality', 2, 'determination')]),
  ]),

  // ---------------------------------------------------------------- on the pitch
  ev('penalty_in_last_minute', 'club', 18, 40, { ageRange: [17, 38], minMinutesSeasonPct: 0.3 }, [
    opt('penalty_in_last_minute', 'take_it', [e('custom', 1, 'tookBigPenalty'), e('attribute', 1.4, 'composure'), e('relationship', 5, 'fans')], 'risk.high'),
    opt('penalty_in_last_minute', 'leave_it', [e('relationship', -3, 'fans'), e('relationship', -2, 'teammates')]),
  ]),
  ev('captain_armband_temporary', 'manager', 16, 60, { ageRange: [22, 36], minOvr: 68 }, [
    opt('captain_armband_temporary', 'accept', [e('attribute', 2, 'leadership'), e('relationship', 6, 'teammates'), e('relationship', 5, 'manager')]),
    opt('captain_armband_temporary', 'decline', [e('relationship', -4, 'manager')]),
  ]),
  ev('opponent_targets_you', 'club', 20, 34, { ageRange: [17, 36], minMinutesSeasonPct: 0.3 }, [
    opt('opponent_targets_you', 'stay_cool', [e('personality', 3, 'pressureHandling'), e('attribute', 1, 'composure')]),
    opt('opponent_targets_you', 'retaliate', [e('relationship', -5, 'manager'), e('fame', 3), e('injuryRisk', 10)], 'risk.high'),
  ]),
  ev('derby_goal_celebration', 'media', 16, 60, { ageRange: [18, 36] }, [
    opt('derby_goal_celebration', 'run_to_fans', [e('relationship', 12, 'fans'), e('fame', 5), e('relationship', -2, 'board')]),
    opt('derby_goal_celebration', 'stay_calm', [e('personality', 2, 'professionalism'), e('relationship', 3, 'board')]),
  ]),
  ev('missed_sitter', 'club', 22, 30, { ageRange: [17, 38], minMinutesSeasonPct: 0.25 }, [
    opt('missed_sitter', 'extra_finishing', [e('attribute', 1.5, 'finishing'), e('fatigue', 6)]),
    opt('missed_sitter', 'forget_it', [e('personality', 2, 'pressureHandling'), e('morale', 2)]),
  ]),
  ev('own_goal', 'club', 14, 50, { ageRange: [17, 38], minMinutesSeasonPct: 0.25 }, [
    opt('own_goal', 'front_up', [e('relationship', 5, 'teammates'), e('relationship', 4, 'fans'), e('morale', -4)]),
    opt('own_goal', 'hide', [e('morale', -8), e('form', -6)]),
  ]),

  // ---------------------------------------------------------------- career turns
  ev('agent_shortlist_review', 'agent', 18, 44, { ageRange: [18, 34], hasAgent: true }, [
    opt('agent_shortlist_review', 'aim_high', [e('custom', 1, 'aimHigh'), e('agentRelationship', 6)], 'risk.medium'),
    opt('agent_shortlist_review', 'aim_for_minutes', [e('custom', 1, 'aimMinutes'), e('agentRelationship', 3)]),
  ]),
  ev('national_coach_watching', 'national', 18, 40, { ageRange: [18, 32], minOvr: 66 }, [
    opt('national_coach_watching', 'show_everything', [e('form', 5), e('fatigue', 7), e('reputation', 3)], 'risk.medium'),
    opt('national_coach_watching', 'play_simple', [e('personality', 2, 'consistency'), e('reputation', 1)]),
  ]),
  ev('youth_call_from_other_country', 'national', 12, 90, { ageRange: [16, 22] }, [
    opt('youth_call_from_other_country', 'accept', [e('custom', 1, 'ntSwitchInterest'), e('reputation', 2)], 'risk.medium'),
    opt('youth_call_from_other_country', 'wait', [e('personality', 2, 'loyalty')]),
  ]),
  ev('contract_clause_dispute', 'agent', 14, 60, { ageRange: [20, 34], hasAgent: true }, [
    opt('contract_clause_dispute', 'push', [e('money', 200000, undefined, 0.5), e('relationship', -6, 'board')], 'risk.medium'),
    opt('contract_clause_dispute', 'drop_it', [e('relationship', 5, 'board'), e('agentRelationship', -4)]),
  ]),
  ev('winter_transfer_rumour', 'transfer', 20, 34, { ageRange: [18, 34], seasonWeekRange: [22, 30] }, [
    opt('winter_transfer_rumour', 'ask_agent_to_explore', [e('custom', 1, 'exploringMove'), e('relationship', -4, 'board')], 'risk.medium'),
    opt('winter_transfer_rumour', 'commit_publicly', [e('relationship', 8, 'fans'), e('relationship', 6, 'board'), e('agentRelationship', -5)]),
  ]),
];
