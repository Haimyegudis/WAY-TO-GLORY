import { Rng, clamp } from './rng.js';
import { overall } from './positions.js';
import { rollInjury } from './injury.js';
import type {
  AttributeKey,
  CareerEventDef,
  CareerState,
  EventEffect,
  PersonalityKey,
  PendingDecision,
  Position,
  SquadRole,
} from './types.js';

export interface EventContext {
  age: number;
  absoluteWeek: number;
  seasonWeek: number;
  minutesPct: number;
  squadRole: SquadRole;
  ovr: number;
  morale: number;
  managerTrust: number;
  hasAgent: boolean;
  injured: boolean;
  tier: number;
  contractYearsLeft: number | null;
}

export function isEligible(def: CareerEventDef, ctx: EventContext, state: CareerState): boolean {
  if (def.oncePerCareer && state.firedOnceEvents.includes(def.id)) return false;
  const cooldownUntil = state.eventCooldowns[def.id];
  if (cooldownUntil !== undefined && ctx.absoluteWeek < cooldownUntil) return false;

  const t = def.trigger;
  if (t.ageRange && (ctx.age < t.ageRange[0] || ctx.age > t.ageRange[1])) return false;
  if (t.seasonWeekRange && (ctx.seasonWeek < t.seasonWeekRange[0] || ctx.seasonWeek > t.seasonWeekRange[1])) return false;
  if (t.minMinutesSeasonPct !== undefined && ctx.minutesPct < t.minMinutesSeasonPct) return false;
  if (t.maxMinutesSeasonPct !== undefined && ctx.minutesPct > t.maxMinutesSeasonPct) return false;
  if (t.squadRoleIn && !t.squadRoleIn.includes(ctx.squadRole)) return false;
  if (t.minOvr !== undefined && ctx.ovr < t.minOvr) return false;
  if (t.maxOvr !== undefined && ctx.ovr > t.maxOvr) return false;
  if (t.minMorale !== undefined && ctx.morale < t.minMorale) return false;
  if (t.maxMorale !== undefined && ctx.morale > t.maxMorale) return false;
  if (t.minManagerTrust !== undefined && ctx.managerTrust < t.minManagerTrust) return false;
  if (t.maxManagerTrust !== undefined && ctx.managerTrust > t.maxManagerTrust) return false;
  if (t.hasAgent !== undefined && t.hasAgent !== ctx.hasAgent) return false;
  if (t.injured !== undefined && t.injured !== ctx.injured) return false;
  if (t.tierIn && !t.tierIn.includes(ctx.tier)) return false;
  if (t.requiresContractExpiringIn !== undefined) {
    if (ctx.contractYearsLeft === null || ctx.contractYearsLeft > t.requiresContractExpiringIn) return false;
  }
  return true;
}

export function pickEvent(
  rng: Rng,
  defs: CareerEventDef[],
  ctx: EventContext,
  state: CareerState,
): CareerEventDef | null {
  const eligible = defs.filter((d) => isEligible(d, ctx, state));
  if (eligible.length === 0) return null;
  return rng.weighted(eligible, (d) => d.weight);
}

export function toPendingDecision(
  def: CareerEventDef,
  absoluteWeek: number,
  args?: Record<string, string | number>,
): PendingDecision {
  return {
    id: `dec_${def.id}_${absoluteWeek}`,
    eventId: def.id,
    category: def.category,
    textKey: def.textKey,
    ...(args ? { textArgs: args } : {}),
    options: def.options,
    expiresWeek: absoluteWeek + 3,
  };
}

const ATTRIBUTE_SET = new Set<string>([
  'pace', 'acceleration', 'strength', 'stamina', 'agility', 'balance', 'jumping',
  'shooting', 'finishing', 'passing', 'crossing', 'dribbling', 'ballControl',
  'tackling', 'marking', 'heading', 'firstTouch',
  'reflexes', 'handling', 'positioningGK', 'kicking',
  'decisions', 'composure', 'workRate', 'positioning', 'vision', 'concentration', 'leadership',
]);

export interface EffectOutcome {
  applied: string[];
  injuryTriggered: boolean;
}

/** Apply an option's effects. Chance-gated effects are rolled here, never shown as numbers. */
export function applyEffects(
  rng: Rng,
  state: CareerState,
  effects: EventEffect[],
  args?: Record<string, string | number>,
): EffectOutcome {
  const applied: string[] = [];
  let injuryTriggered = false;
  const player = state.player;

  for (const effect of effects) {
    if (effect.chance !== undefined && !rng.chance(effect.chance)) continue;
    const value = effect.value ?? 0;

    switch (effect.kind) {
      case 'morale':
        player.morale = clamp(player.morale + value, 0, 100);
        break;
      case 'managerTrust':
        state.managerTrust = clamp(state.managerTrust + value, 0, 100);
        break;
      case 'form':
        player.form = clamp(player.form + value, 0, 100);
        break;
      case 'fitness':
        player.fitness = clamp(player.fitness + value, 0, 100);
        break;
      case 'fatigue':
        player.condition.fatigue = clamp(player.condition.fatigue + value, 0, 100);
        break;
      case 'reputation':
        player.reputation = clamp(player.reputation + value, 0, 100);
        break;
      case 'fame':
        player.fame = clamp(player.fame + value, 0, 100);
        break;
      case 'attribute': {
        const key = (effect.key ?? '') as AttributeKey;
        if (ATTRIBUTE_SET.has(key)) {
          const before = overall(player.attributes, player.primaryPos, player.secondaryPos);
          player.attributes[key] = clamp(player.attributes[key] + value, 1, 99);
          // Training events are still training: they cannot push a player past the
          // ceiling the development engine enforces everywhere else.
          if (value > 0 && before >= player.potential) {
            player.attributes[key] = clamp(player.attributes[key] - value, 1, 99);
          }
        }
        break;
      }
      case 'personality': {
        const key = (effect.key ?? '') as PersonalityKey;
        if (key in player.personality) {
          player.personality[key] = clamp(player.personality[key] + value, 1, 99);
        }
        break;
      }
      case 'potential':
        player.potential = clamp(player.potential + value, 40, 99);
        break;
      case 'injuryRisk': {
        if (rng.chance(clamp(value / 100, 0, 1))) {
          const injury = rollInjury(rng, player, state.world.season, 1.4);
          player.condition.injuries.push(injury);
          injuryTriggered = true;
        }
        break;
      }
      case 'money':
        state.finances.balance += value;
        if (value > 0) state.finances.careerEarnings += value;
        break;
      case 'squadRole':
        if (effect.key) player.squadRole = effect.key as SquadRole;
        break;
      case 'learnPosition': {
        const raw = effect.key === '$offeredPos' ? String(args?.['offeredPos'] ?? '') : effect.key ?? '';
        const pos = raw as Position;
        if (pos && !player.secondaryPos.includes(pos) && player.primaryPos !== pos) {
          player.secondaryPos.push(pos);
        }
        break;
      }
      case 'transferRequest':
        state.flags['transferRequested'] = true;
        break;
      case 'agentRelationship':
        if (state.agent) state.agent.relationship = clamp(state.agent.relationship + value, 0, 100);
        break;
      case 'custom':
        if (effect.key) state.flags[effect.key] = value || true;
        break;
    }
    applied.push(`${effect.kind}${effect.key ? `:${effect.key}` : ''}=${value}`);
  }

  return { applied, injuryTriggered };
}

export function resolveDecision(
  rng: Rng,
  state: CareerState,
  decisionId: string,
  optionId: string,
  defs: CareerEventDef[],
): EffectOutcome | null {
  const index = state.pendingDecisions.findIndex((d) => d.id === decisionId);
  if (index === -1) return null;
  const decision = state.pendingDecisions[index]!;
  const option = decision.options.find((o) => o.id === optionId);
  if (!option) return null;

  const outcome = applyEffects(rng, state, option.effects, decision.textArgs);

  const def = defs.find((d) => d.id === decision.eventId);
  const absoluteWeek = state.world.season * 52 + state.world.week;
  if (def) {
    state.eventCooldowns[def.id] = absoluteWeek + def.cooldownWeeks;
    if (def.oncePerCareer) state.firedOnceEvents.push(def.id);
  }

  state.pendingDecisions.splice(index, 1);
  return outcome;
}
