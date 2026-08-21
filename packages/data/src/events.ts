import type { CareerEventDef, CareerEventOption, EventEffect, EventTrigger } from '@fc/engine';

/**
 * Career events. Everything here is data: the engine only reads triggers, weights
 * and effects, so a new dilemma is a new entry, not new code.
 *
 * Outcomes are deliberately described as risk in the UI, never as percentages.
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

export const EVENTS: CareerEventDef[] = [
  // ---------------------------------------------------------------- academy
  ev('academy_extra_training', 'club', 40, 26, { ageRange: [15, 19] }, [
    opt('academy_extra_training', 'accept', [e('attribute', 1.5, 'ballControl'), e('fatigue', 10), e('personality', 2, 'professionalism')], 'risk.low'),
    opt('academy_extra_training', 'decline', [e('managerTrust', -3)]),
  ]),
  ev('academy_coach_criticism', 'manager', 35, 30, { ageRange: [15, 20], maxMinutesSeasonPct: 0.4 }, [
    opt('academy_coach_criticism', 'listen', [e('personality', 3, 'professionalism'), e('managerTrust', 6), e('morale', -3)]),
    opt('academy_coach_criticism', 'argue', [e('managerTrust', -10), e('morale', 5), e('personality', -2, 'discipline')]),
  ]),
  ev('academy_school_conflict', 'personal', 30, 40, { ageRange: [15, 18] }, [
    opt('academy_school_conflict', 'football', [
      e('attribute', 1.4, 'firstTouch'),
      e('personality', 3, 'determination'),
      e('morale', -3),
      e('custom', 1, 'noFallbackPlan'),
    ]),
    opt('academy_school_conflict', 'school', [
      e('attribute', 1, 'decisions'),
      e('attribute', 0.8, 'concentration'),
      e('morale', 4),
      e('managerTrust', -2),
    ]),
    opt('academy_school_conflict', 'balance', [
      e('fatigue', 10),
      e('personality', 2, 'determination'),
      e('personality', 1, 'professionalism'),
    ]),
  ]),
  ev('academy_trial_abroad', 'agent', 22, 52, { ageRange: [15, 18], minCareerApps: 12 }, [
    opt('academy_trial_abroad', 'go', [e('reputation', 4), e('fame', 2), e('personality', 3, 'adaptability'), e('fatigue', 12), e('custom', 1, 'trialAbroad')], 'risk.medium'),
    opt('academy_trial_abroad', 'stay', [e('managerTrust', 5)]),
  ]),
  ev('first_team_training_callup', 'club', 30, 40, { ageRange: [16, 20], minOvr: 45 }, [
    opt('first_team_training_callup', 'aggressive', [e('managerTrust', 8), e('injuryRisk', 12), e('reputation', 2)], 'risk.medium'),
    opt('first_team_training_callup', 'safe', [e('managerTrust', 2)]),
  ]),
  ev('youth_captain', 'club', 18, 60, { ageRange: [16, 20], minOvr: 48 }, [
    opt('youth_captain', 'accept', [e('attribute', 2, 'leadership'), e('personality', 3, 'determination'), e('managerTrust', 5)]),
    opt('youth_captain', 'decline', [e('managerTrust', -4)]),
  ]),

  // ---------------------------------------------------------------- manager
  ev('manager_position_switch', 'manager', 30, 45, { ageRange: [17, 32], minMinutesSeasonPct: 0.15 }, [
    opt('manager_position_switch', 'accept', [e('managerTrust', 9), e('morale', -3)]),
    opt('manager_position_switch', 'decline', [e('managerTrust', -11), e('morale', 4)]),
  ]),
  ev('manager_bench_talk', 'manager', 45, 20, { ageRange: [17, 36], maxMinutesSeasonPct: 0.25, maxMorale: 65 }, [
    opt('manager_bench_talk', 'patient', [e('managerTrust', 5), e('morale', -4), e('personality', 2, 'professionalism')]),
    opt('manager_bench_talk', 'demand', [e('managerTrust', -8), e('morale', 6)], 'risk.medium'),
    opt('manager_bench_talk', 'media', [e('managerTrust', -18), e('fame', 5), e('morale', 3)], 'risk.high'),
    opt('manager_bench_talk', 'transferRequest', [e('transferRequest', 1), e('managerTrust', -14), e('morale', 2)], 'risk.high'),
  ]),
  ev('manager_new_arrival', 'manager', 28, 40, { ageRange: [17, 37] }, [
    opt('manager_new_arrival', 'impress', [e('managerTrust', 7), e('fatigue', 8)]),
    opt('manager_new_arrival', 'normal', [e('managerTrust', 1)]),
  ]),
  ev('manager_tactical_homework', 'manager', 32, 26, { ageRange: [17, 35] }, [
    opt('manager_tactical_homework', 'study', [e('attribute', 1.6, 'positioning'), e('attribute', 1.2, 'decisions'), e('managerTrust', 4)]),
    opt('manager_tactical_homework', 'skip', [e('managerTrust', -6), e('morale', 2), e('attribute', -0.4, 'positioning')]),
  ]),
  ev('manager_captaincy', 'manager', 12, 80, { ageRange: [24, 36], minOvr: 70, minManagerTrust: 65 }, [
    opt('manager_captaincy', 'accept', [e('attribute', 3, 'leadership'), e('reputation', 4), e('morale', 8), e('managerTrust', 6)]),
    opt('manager_captaincy', 'decline', [e('managerTrust', -6)]),
  ]),
  ev('manager_dropped_after_error', 'manager', 26, 30, { ageRange: [17, 36], maxManagerTrust: 55 }, [
    opt('manager_dropped_after_error', 'work', [e('managerTrust', 6), e('fatigue', 6), e('attribute', 1, 'concentration')]),
    opt('manager_dropped_after_error', 'sulk', [e('managerTrust', -7), e('morale', -6), e('form', -8)]),
  ]),

  // ---------------------------------------------------------------- training and body
  ev('training_extra_gym', 'club', 34, 20, { ageRange: [17, 34] }, [
    opt('training_extra_gym', 'yes', [e('attribute', 1.8, 'strength'), e('fatigue', 12), e('injuryRisk', 6)], 'risk.low'),
    opt('training_extra_gym', 'no', []),
  ]),
  ev('training_sprint_program', 'club', 30, 30, { ageRange: [16, 30] }, [
    opt('training_sprint_program', 'yes', [e('attribute', 1.5, 'acceleration'), e('attribute', 1.2, 'pace'), e('fatigue', 14), e('injuryRisk', 10)], 'risk.medium'),
    opt('training_sprint_program', 'no', []),
  ]),
  ev('nutritionist_offer', 'personal', 24, 60, { ageRange: [17, 36] }, [
    opt('nutritionist_offer', 'hire', [e('money', -25000), e('fitness', 6), e('personality', 3, 'professionalism')]),
    opt('nutritionist_offer', 'decline', []),
  ]),
  ev('late_night_out', 'personal', 28, 24, { ageRange: [17, 30] }, [
    opt('late_night_out', 'go', [e('morale', 7), e('fitness', -8), e('fatigue', 10), e('personality', -2, 'professionalism'), e('managerTrust', -4, undefined, 0.35)], 'risk.medium'),
    opt('late_night_out', 'stay', [e('morale', -2), e('personality', 2, 'professionalism')]),
  ]),
  ev('fitness_coach_warning', 'medical', 22, 30, { ageRange: [18, 36] }, [
    opt('fitness_coach_warning', 'rest', [e('fatigue', -20), e('managerTrust', -3)]),
    opt('fitness_coach_warning', 'push', [e('injuryRisk', 22), e('managerTrust', 4)], 'risk.high'),
  ]),

  // ---------------------------------------------------------------- medical
  ev('injury_treatment_choice', 'medical', 40, 12, { ageRange: [16, 40], injured: true }, [
    opt('injury_treatment_choice', 'surgery', [e('custom', 1, 'treatmentSurgery')], 'risk.low'),
    opt('injury_treatment_choice', 'conservative', [e('custom', 1, 'treatmentConservative')], 'risk.medium'),
    opt('injury_treatment_choice', 'playThrough', [e('custom', 1, 'treatmentPlayThrough'), e('managerTrust', 6), e('injuryRisk', 55)], 'risk.high'),
  ]),
  ev('play_final_injured', 'medical', 16, 52, { ageRange: [18, 36], injured: true, minManagerTrust: 45 }, [
    opt('play_final_injured', 'play', [e('custom', 1, 'clearedForInjuredFinal'), e('managerTrust', 12), e('fame', 6), e('injuryRisk', 45), e('reputation', 3)], 'risk.high'),
    opt('play_final_injured', 'rest', [e('managerTrust', -6), e('morale', -5)]),
  ]),
  ev('painkiller_offer', 'medical', 18, 40, { ageRange: [20, 36], injured: true }, [
    opt('painkiller_offer', 'take', [e('injuryRisk', 35), e('managerTrust', 5)], 'risk.high'),
    opt('painkiller_offer', 'refuse', [e('personality', 3, 'professionalism')]),
  ]),
  ev('rehab_specialist', 'medical', 20, 40, { ageRange: [18, 38], injured: true }, [
    opt('rehab_specialist', 'pay', [e('money', -60000), e('fitness', 10), e('injuryRisk', -10)]),
    opt('rehab_specialist', 'club', []),
  ]),

  // ---------------------------------------------------------------- agent
  ev('agent_wants_move', 'agent', 30, 40, { ageRange: [17, 32], hasAgent: true }, [
    opt('agent_wants_move', 'trust', [e('agentRelationship', 8), e('transferRequest', 1)], 'risk.medium'),
    opt('agent_wants_move', 'refuse', [e('agentRelationship', -12), e('managerTrust', 4)]),
  ]),
  ev('agent_commission_dispute', 'agent', 20, 60, { ageRange: [18, 36], hasAgent: true }, [
    opt('agent_commission_dispute', 'pay', [e('money', -120000), e('agentRelationship', 12)]),
    opt('agent_commission_dispute', 'negotiate', [e('agentRelationship', -8), e('money', -40000)]),
    opt('agent_commission_dispute', 'fire', [e('agentRelationship', -40), e('custom', 1, 'agentFired')], 'risk.medium'),
  ]),
  ev('agent_media_plan', 'agent', 22, 40, { ageRange: [18, 34], hasAgent: true, minOvr: 65 }, [
    opt('agent_media_plan', 'accept', [e('fame', 10), e('reputation', 3), e('managerTrust', -3)]),
    opt('agent_media_plan', 'decline', [e('agentRelationship', -5), e('relationship', 3, 'manager'), e('fame', -1)]),
  ]),
  ev('agent_rival_approach', 'agent', 18, 52, { ageRange: [18, 34], hasAgent: true }, [
    opt('agent_rival_approach', 'switch', [e('custom', 1, 'agentSwitchOffer'), e('agentRelationship', -30)], 'risk.medium'),
    opt('agent_rival_approach', 'stay', [e('agentRelationship', 10)]),
  ]),

  // ---------------------------------------------------------------- transfer and contract
  ev('loan_offer_generic', 'transfer', 26, 40, { ageRange: [17, 23], maxMinutesSeasonPct: 0.25 }, [
    opt('loan_offer_generic', 'accept', [e('custom', 1, 'wantsLoan'), e('morale', 4)]),
    opt('loan_offer_generic', 'reject', [e('managerTrust', -5), e('morale', -3)]),
  ]),
  ev('contract_renewal_talks', 'club', 30, 30, { ageRange: [17, 36], requiresContractExpiringIn: 1 }, [
    opt('contract_renewal_talks', 'sign', [e('morale', 8), e('managerTrust', 6), e('custom', 1, 'wantsRenewal')]),
    opt('contract_renewal_talks', 'holdOut', [e('managerTrust', -8), e('custom', 1, 'holdingOut')], 'risk.medium'),
    opt('contract_renewal_talks', 'refuse', [e('managerTrust', -14), e('morale', -4)], 'risk.high'),
  ]),
  ev('release_clause_insert', 'agent', 16, 60, { ageRange: [19, 30], hasAgent: true, minOvr: 68 }, [
    opt('release_clause_insert', 'insert', [e('custom', 1, 'releaseClause'), e('managerTrust', -4)]),
    opt('release_clause_insert', 'skip', [e('managerTrust', 3)]),
  ]),
  ev('bigger_club_scouting', 'transfer', 24, 30, { ageRange: [17, 30], minMinutesSeasonPct: 0.4, minOvr: 60 }, [
    // Whichever way he plays it, they file a report and act on it. Trying to force it
    // is worth a little more in the stand and a little less in his legs.
    opt('bigger_club_scouting', 'impress', [e('form', 6), e('fatigue', 8), e('reputation', 3), e('custom', 1, 'scoutedByBiggerClub')]),
    opt('bigger_club_scouting', 'ignore', [e('personality', 2, 'consistency'), e('custom', 1, 'scoutedByBiggerClub')]),
  ]),
  ev('former_club_return', 'transfer', 10, 80, { ageRange: [28, 38] }, [
    opt('former_club_return', 'consider', [e('morale', 6), e('custom', 1, 'wantsHomecoming')]),
    opt('former_club_return', 'decline', []),
  ]),

  // ---------------------------------------------------------------- media and fame
  ev('media_interview_request', 'media', 34, 20, { ageRange: [17, 38], minOvr: 55 }, [
    opt('media_interview_request', 'humble', [e('fame', 3), e('managerTrust', 3), e('reputation', 1)]),
    opt('media_interview_request', 'bold', [e('fame', 8), e('managerTrust', -5), e('reputation', 2)], 'risk.medium'),
    opt('media_interview_request', 'decline', [e('fame', -2), e('relationship', -3, 'media')]),
  ]),
  ev('media_criticism', 'media', 26, 30, { ageRange: [17, 38], maxMorale: 60 }, [
    opt('media_criticism', 'respond', [e('fame', 5), e('morale', 4), e('managerTrust', -6)], 'risk.medium'),
    opt('media_criticism', 'silence', [e('personality', 2, 'pressureHandling'), e('morale', -2)]),
  ]),
  ev('social_media_post', 'media', 24, 26, { ageRange: [17, 32] }, [
    opt('social_media_post', 'post', [e('fame', 6), e('managerTrust', -4, undefined, 0.4)], 'risk.medium'),
    opt('social_media_post', 'skip', []),
  ]),
  ev('documentary_offer', 'media', 12, 90, { ageRange: [21, 36], minOvr: 75 }, [
    opt('documentary_offer', 'accept', [e('fame', 14), e('money', 400000), e('fatigue', 8), e('managerTrust', -4)]),
    opt('documentary_offer', 'decline', [e('personality', 2, 'professionalism')]),
  ]),

  // ---------------------------------------------------------------- sponsors and money
  ev('boot_sponsor_offer', 'sponsor', 22, 60, { ageRange: [17, 34], minOvr: 60 }, [
    opt('boot_sponsor_offer', 'accept', [e('money', 250000), e('fame', 5)]),
    opt('boot_sponsor_offer', 'holdOut', [e('custom', 1, 'sponsorHoldOut')], 'risk.low'),
  ]),
  ev('big_brand_offer', 'sponsor', 12, 90, { ageRange: [20, 34], minOvr: 78 }, [
    opt('big_brand_offer', 'accept', [e('money', 1500000), e('fame', 12), e('fatigue', 6)]),
    opt('big_brand_offer', 'decline', [e('personality', 2, 'professionalism')]),
  ]),
  ev('betting_ad_offer', 'sponsor', 10, 90, { ageRange: [20, 36], minOvr: 70 }, [
    opt('betting_ad_offer', 'accept', [e('money', 900000), e('fame', 6), e('reputation', -4)], 'risk.medium'),
    opt('betting_ad_offer', 'refuse', [e('reputation', 2), e('personality', 2, 'professionalism')]),
  ]),
  ev('family_business_investment', 'personal', 16, 80, { ageRange: [22, 38] }, [
    opt('family_business_investment', 'invest', [e('money', -500000), e('custom', 1, 'investment')], 'risk.medium'),
    opt('family_business_investment', 'decline', []),
  ]),
  ev('charity_project', 'personal', 18, 70, { ageRange: [20, 40] }, [
    opt('charity_project', 'fund', [e('money', -200000), e('reputation', 5), e('fame', 4), e('morale', 5)]),
    opt('charity_project', 'skip', []),
  ]),

  // ---------------------------------------------------------------- national team
  ev('national_switch_question', 'national', 14, 100, { ageRange: [17, 27] }, [
    opt('national_switch_question', 'wait', [e('custom', 1, 'ntWait')]),
    opt('national_switch_question', 'commit', [e('custom', 1, 'ntCommit'), e('morale', 5)]),
  ]),
  ev('national_friendly_withdrawal', 'national', 18, 40, { ageRange: [19, 36] }, [
    opt('national_friendly_withdrawal', 'withdraw', [e('fatigue', -18), e('managerTrust', 6), e('reputation', -3)]),
    opt('national_friendly_withdrawal', 'travel', [e('fatigue', 14), e('reputation', 3), e('injuryRisk', 8)], 'risk.medium'),
  ]),
  ev('national_captain_offer', 'national', 8, 120, { ageRange: [25, 36], minOvr: 78 }, [
    opt('national_captain_offer', 'accept', [e('attribute', 3, 'leadership'), e('fame', 8), e('reputation', 6), e('morale', 10)]),
    opt('national_captain_offer', 'decline', [e('reputation', -3)]),
  ]),
  ev('tournament_squad_fight', 'national', 14, 60, { ageRange: [19, 35], minOvr: 68 }, [
    opt('tournament_squad_fight', 'push', [e('fatigue', 12), e('form', 5), e('reputation', 3)], 'risk.medium'),
    opt('tournament_squad_fight', 'rest', [e('fatigue', -14), e('reputation', -2)]),
  ]),

  // ---------------------------------------------------------------- dressing room
  ev('teammate_conflict', 'club', 24, 40, { ageRange: [17, 37] }, [
    opt('teammate_conflict', 'confront', [e('morale', 4), e('managerTrust', -4), e('personality', 2, 'determination')], 'risk.medium'),
    opt('teammate_conflict', 'defuse', [e('personality', 3, 'adaptability'), e('managerTrust', 3)]),
    opt('teammate_conflict', 'ignore', [e('morale', -4)]),
  ]),
  ev('senior_player_mentorship', 'club', 26, 50, { ageRange: [17, 23] }, [
    opt('senior_player_mentorship', 'accept', [e('attribute', 1.4, 'decisions'), e('attribute', 1.2, 'composure'), e('personality', 3, 'professionalism')]),
    opt('senior_player_mentorship', 'decline', [e('morale', 2)]),
  ]),
  ev('mentor_young_player', 'club', 20, 50, { ageRange: [28, 38] }, [
    opt('mentor_young_player', 'accept', [e('attribute', 2, 'leadership'), e('managerTrust', 5), e('reputation', 2)]),
    opt('mentor_young_player', 'decline', []),
  ]),
  ev('dressing_room_vote', 'club', 16, 60, { ageRange: [22, 36], minOvr: 68 }, [
    opt('dressing_room_vote', 'support', [e('managerTrust', 6), e('morale', -3)]),
    opt('dressing_room_vote', 'oppose', [e('managerTrust', -10), e('morale', 6), e('reputation', 2)], 'risk.medium'),
  ]),

  // ---------------------------------------------------------------- personal life
  ev('family_move_abroad', 'personal', 18, 70, { ageRange: [19, 34] }, [
    opt('family_move_abroad', 'bring', [e('morale', 8), e('money', -150000)]),
    opt('family_move_abroad', 'alone', [e('morale', -6), e('personality', 2, 'determination')]),
  ]),
  ev('language_lessons', 'personal', 20, 60, { ageRange: [17, 34] }, [
    opt('language_lessons', 'take', [e('personality', 4, 'adaptability'), e('morale', 3), e('fatigue', 4)]),
    opt('language_lessons', 'skip', [e('personality', -2, 'adaptability')]),
  ]),
  ev('homesickness', 'personal', 22, 40, { ageRange: [17, 26], maxMorale: 55 }, [
    opt('homesickness', 'visit', [e('morale', 10), e('fatigue', 6), e('managerTrust', -3)]),
    opt('homesickness', 'stay', [e('morale', -4), e('personality', 3, 'determination')]),
  ]),
  ev('new_baby', 'personal', 12, 120, { ageRange: [23, 36] }, [
    opt('new_baby', 'timeOff', [e('morale', 12), e('managerTrust', -3), e('fatigue', 8)]),
    opt('new_baby', 'stayFocused', [e('morale', 4), e('managerTrust', 3), e('personality', 2, 'professionalism')]),
  ]),

  // ---------------------------------------------------------------- discipline
  ev('training_ground_bust_up', 'club', 16, 60, { ageRange: [18, 34], maxMorale: 50 }, [
    opt('training_ground_bust_up', 'apologise', [e('managerTrust', 4), e('personality', 2, 'discipline')]),
    opt('training_ground_bust_up', 'standGround', [e('managerTrust', -12), e('morale', 5), e('personality', -3, 'discipline')], 'risk.high'),
  ]),
  ev('late_for_training', 'club', 18, 40, { ageRange: [17, 34], maxManagerTrust: 60 }, [
    opt('late_for_training', 'ownUp', [e('managerTrust', -3), e('relationship', 3, 'teammates')]),
    opt('late_for_training', 'excuse', [
      e('managerTrust', -8, undefined, 0.5),
      e('personality', -2, 'professionalism'),
      e('custom', 1, 'incidentWithManager', 0.5),
    ], 'risk.medium'),
  ]),
  ev('referee_confrontation', 'club', 14, 50, { ageRange: [18, 36] }, [
    opt('referee_confrontation', 'apologise', [e('reputation', -1), e('personality', 2, 'discipline')]),
    opt('referee_confrontation', 'defend', [e('fame', 4), e('reputation', -3), e('managerTrust', -5)], 'risk.medium'),
  ]),

  // ---------------------------------------------------------------- form and confidence
  ev('confidence_crisis', 'personal', 26, 30, { ageRange: [17, 36], maxMorale: 40 }, [
    opt('confidence_crisis', 'psychologist', [e('money', -30000), e('morale', 12), e('attribute', 1.5, 'composure'), e('personality', 3, 'pressureHandling')]),
    opt('confidence_crisis', 'workHarder', [e('fatigue', 14), e('form', 6), e('injuryRisk', 8)], 'risk.medium'),
    opt('confidence_crisis', 'waitItOut', [e('morale', -2)]),
  ]),
  ev('hot_streak', 'club', 22, 26, { ageRange: [17, 38], minMorale: 70 }, [
    opt('hot_streak', 'ride', [e('form', 8), e('fatigue', 10)], 'risk.low'),
    opt('hot_streak', 'manage', [e('fatigue', -8), e('form', 2)]),
  ]),
  ev('penalty_duty_offer', 'manager', 20, 60, { ageRange: [18, 36], minMinutesSeasonPct: 0.4 }, [
    opt('penalty_duty_offer', 'accept', [e('custom', 1, 'penaltyTaker'), e('attribute', 1.5, 'composure'), e('reputation', 2)], 'risk.medium'),
    opt('penalty_duty_offer', 'decline', [e('managerTrust', -2)]),
  ]),
  ev('free_kick_practice', 'club', 24, 40, { ageRange: [17, 34] }, [
    opt('free_kick_practice', 'practice', [e('attribute', 2, 'shooting'), e('attribute', 1, 'crossing'), e('fatigue', 6)]),
    opt('free_kick_practice', 'skip', []),
  ]),

  // ---------------------------------------------------------------- veteran and retirement
  ev('body_warning_sign', 'medical', 22, 40, { ageRange: [31, 40] }, [
    opt('body_warning_sign', 'lighten', [e('fatigue', -18), e('managerTrust', -4), e('custom', 1, 'reducedLoad')]),
    opt('body_warning_sign', 'ignore', [e('injuryRisk', 30)], 'risk.high'),
  ]),
  ev('coaching_badges', 'personal', 18, 60, { ageRange: [30, 40] }, [
    opt('coaching_badges', 'start', [e('attribute', 2, 'leadership'), e('attribute', 1.5, 'decisions'), e('custom', 1, 'coachingBadges')]),
    opt('coaching_badges', 'later', []),
  ]),
  ev('retirement_question', 'personal', 24, 40, { ageRange: [33, 42] }, [
    opt('retirement_question', 'continue', [e('morale', 4), e('personality', 3, 'determination')]),
    opt('retirement_question', 'retire', [e('custom', 1, 'wantsRetirement')], 'risk.high'),
  ]),
  ev('farewell_season_offer', 'club', 12, 100, { ageRange: [34, 42] }, [
    opt('farewell_season_offer', 'accept', [e('morale', 12), e('fame', 6), e('custom', 1, 'farewellSeason')]),
    opt('farewell_season_offer', 'decline', []),
  ]),
  ev('drop_down_league', 'transfer', 16, 60, { ageRange: [32, 42], maxMinutesSeasonPct: 0.3 }, [
    opt('drop_down_league', 'consider', [e('custom', 1, 'openToLowerLeague'), e('morale', -3)]),
    opt('drop_down_league', 'refuse', [e('morale', 3)]),
  ]),

  // ---------------------------------------------------------------- misc club life
  ev('preseason_tour', 'club', 22, 52, { seasonWeekRange: [1, 4], ageRange: [17, 38] }, [
    opt('preseason_tour', 'travel', [e('fatigue', 12), e('fame', 3), e('managerTrust', 4)]),
    opt('preseason_tour', 'stayBack', [e('fatigue', -6), e('managerTrust', -5)]),
  ]),
  ev('winter_break_holiday', 'personal', 20, 52, { seasonWeekRange: [24, 28], ageRange: [17, 40] }, [
    opt('winter_break_holiday', 'holiday', [e('fatigue', -20), e('morale', 8), e('fitness', -5)]),
    opt('winter_break_holiday', 'train', [e('fitness', 6), e('form', 4), e('fatigue', 6)]),
  ]),
  ev('fan_meeting', 'media', 20, 40, { ageRange: [17, 40] }, [
    opt('fan_meeting', 'attend', [e('fame', 4), e('reputation', 2), e('fatigue', 3)]),
    opt('fan_meeting', 'skip', [e('reputation', -2)]),
  ]),
  ev('derby_week_pressure', 'club', 24, 30, { ageRange: [17, 40] }, [
    opt('derby_week_pressure', 'embrace', [e('form', 5), e('personality', 2, 'pressureHandling'), e('fatigue', 6)]),
    opt('derby_week_pressure', 'routine', [e('personality', 1, 'consistency')]),
  ]),
  ev('club_financial_trouble', 'club', 14, 80, { ageRange: [17, 40], tierIn: [2, 3] }, [
    opt('club_financial_trouble', 'takeCut', [e('money', -80000), e('managerTrust', 8), e('reputation', 3)]),
    opt('club_financial_trouble', 'refuse', [e('relationship', -10, 'board'), e('relationship', -5, 'teammates')]),
  ]),
  ev('new_signing_rival', 'club', 26, 30, { ageRange: [17, 36], minMinutesSeasonPct: 0.3 }, [
    opt('new_signing_rival', 'compete', [e('form', 4), e('fatigue', 8), e('managerTrust', 4)]),
    opt('new_signing_rival', 'complain', [e('managerTrust', -8), e('morale', -4)], 'risk.medium'),
  ]),
  ev('youth_academy_visit', 'club', 16, 60, { ageRange: [25, 40] }, [
    opt('youth_academy_visit', 'go', [e('reputation', 2), e('morale', 4), e('attribute', 1, 'leadership')]),
    opt('youth_academy_visit', 'skip', []),
  ]),
  ev('boot_deal_expiry', 'sponsor', 16, 70, { ageRange: [20, 36], minOvr: 65 }, [
    opt('boot_deal_expiry', 'renew', [e('money', 300000), e('fame', 2)]),
    opt('boot_deal_expiry', 'shop', [e('money', 550000, undefined, 0.55), e('fame', 3)], 'risk.medium'),
  ]),
  ev('goal_celebration_controversy', 'media', 12, 70, { ageRange: [18, 34], minOvr: 65 }, [
    opt('goal_celebration_controversy', 'apologise', [e('reputation', 1), e('fame', 2)]),
    opt('goal_celebration_controversy', 'doubleDown', [e('fame', 9), e('reputation', -4), e('managerTrust', -5)], 'risk.high'),
  ]),
  ev('champions_league_night', 'club', 14, 60, { ageRange: [18, 38], minOvr: 72, tierIn: [1] }, [
    opt('champions_league_night', 'goForIt', [e('form', 6), e('fame', 6), e('fatigue', 10)], 'risk.low'),
    opt('champions_league_night', 'stayCalm', [e('personality', 2, 'pressureHandling')]),
  ]),
  ev('first_pro_contract', 'club', 40, 500, { ageRange: [16, 19] }, [
    opt('first_pro_contract', 'sign', [e('morale', 12), e('money', 20000), e('managerTrust', 5)]),
    opt('first_pro_contract', 'negotiate', [e('money', 60000, undefined, 0.5), e('managerTrust', -4)], 'risk.medium'),
  ], true),
];
