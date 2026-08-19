import { Rng, clamp } from './rng.js';
import { overall } from './positions.js';
import { rollInjury } from './injury.js';
import { adjustRelationship, evaluateConsequences, track } from './social.js';
import type {
  AppliedChange,
  AttributeKey,
  CareerEventDef,
  CareerState,
  DecisionResult,
  EventEffect,
  PersonalityKey,
  PendingDecision,
  Position,
  RelationshipKey,
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
    kind: 'event',
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
  changes: AppliedChange[];
  injuryTriggered: boolean;
}

/**
 * Apply an option's effects and record what each one did, so the game can tell the
 * player exactly why his morale dropped or why the manager cooled on him.
 */
export function applyEffects(
  rng: Rng,
  state: CareerState,
  effects: EventEffect[],
  args?: Record<string, string | number>,
): EffectOutcome {
  const changes: AppliedChange[] = [];
  let injuryTriggered = false;
  const player = state.player;

  for (const effect of effects) {
    if (effect.chance !== undefined && !rng.chance(effect.chance)) continue;
    const value = effect.value ?? 0;

    switch (effect.kind) {
      case 'morale': {
        const before = player.morale;
        player.morale = clamp(before + value, 0, 100);
        track(changes, 'change.morale', before, player.morale);
        break;
      }
      case 'managerTrust': {
        adjustRelationship(state, 'manager', value, changes);
        break;
      }
      case 'relationship': {
        const key = (effect.key ?? 'manager') as RelationshipKey;
        adjustRelationship(state, key, value, changes);
        break;
      }
      case 'form': {
        const before = player.form;
        player.form = clamp(before + value, 0, 100);
        track(changes, 'change.form', before, player.form);
        break;
      }
      case 'fitness': {
        const before = player.fitness;
        player.fitness = clamp(before + value, 0, 100);
        track(changes, 'change.fitness', before, player.fitness);
        break;
      }
      case 'fatigue': {
        const before = player.condition.fatigue;
        player.condition.fatigue = clamp(before + value, 0, 100);
        track(changes, 'change.fatigue', before, player.condition.fatigue, false);
        break;
      }
      case 'reputation': {
        const before = player.reputation;
        player.reputation = clamp(before + value, 0, 100);
        track(changes, 'change.reputation', before, player.reputation);
        break;
      }
      case 'fame': {
        const before = player.fame;
        player.fame = clamp(before + value, 0, 100);
        track(changes, 'change.fame', before, player.fame);
        break;
      }
      case 'attribute': {
        const key = (effect.key ?? '') as AttributeKey;
        if (ATTRIBUTE_SET.has(key)) {
          const ovrBefore = overall(player.attributes, player.primaryPos, player.secondaryPos);
          const before = player.attributes[key];
          player.attributes[key] = clamp(before + value, 1, 99);
          // Training events are still training: they cannot push a player past the
          // ceiling the development engine enforces everywhere else.
          if (value > 0 && ovrBefore >= player.potential) {
            player.attributes[key] = before;
          } else {
            track(changes, 'change.attr.' + key, before, player.attributes[key]);
          }
        }
        break;
      }
      case 'personality': {
        const key = (effect.key ?? '') as PersonalityKey;
        if (key in player.personality) {
          const before = player.personality[key];
          player.personality[key] = clamp(before + value, 1, 99);
          track(changes, 'change.personality.' + key, before, player.personality[key]);
        }
        break;
      }
      case 'potential': {
        const before = player.potential;
        player.potential = clamp(before + value, 40, 99);
        // Potential stays hidden: the player is told something moved, not the number.
        if (Math.abs(player.potential - before) >= 1) {
          changes.push({
            key: 'change.potential',
            delta: player.potential > before ? 1 : -1,
            before: 0,
            after: 0,
            tone: player.potential > before ? 'good' : 'bad',
          });
        }
        break;
      }
      case 'injuryRisk': {
        if (rng.chance(clamp(value / 100, 0, 1))) {
          const injury = rollInjury(rng, player, state.world.season, 1.4);
          player.condition.injuries.push(injury);
          injuryTriggered = true;
        }
        break;
      }
      case 'money': {
        const before = state.finances.balance;
        state.finances.balance += value;
        if (value > 0) state.finances.careerEarnings += value;
        track(changes, 'change.money', before, state.finances.balance);
        break;
      }
      case 'squadRole':
        if (effect.key) player.squadRole = effect.key as SquadRole;
        break;
      case 'learnPosition': {
        const raw = effect.key === '$offeredPos' ? String(args?.['offeredPos'] ?? '') : effect.key ?? '';
        const pos = raw as Position;
        if (pos && !player.secondaryPos.includes(pos) && player.primaryPos !== pos) {
          player.secondaryPos.push(pos);
          changes.push({ key: 'change.newPosition', delta: 1, before: 0, after: 0, tone: 'good' });
        }
        break;
      }
      case 'transferRequest':
        state.flags['transferRequested'] = true;
        changes.push({ key: 'change.transferRequested', delta: 1, before: 0, after: 0, tone: 'neutral' });
        break;
      case 'agentRelationship':
        if (state.agent) {
          const before = state.agent.relationship;
          state.agent.relationship = clamp(before + value, 0, 100);
          track(changes, 'change.agent', before, state.agent.relationship);
        }
        break;
      case 'custom':
        if (effect.key) state.flags[effect.key] = value || true;
        break;
    }
  }

  return { changes, injuryTriggered };
}

export function resolveDecision(
  rng: Rng,
  state: CareerState,
  decisionId: string,
  optionId: string,
  defs: CareerEventDef[],
): DecisionResult | null {
  const index = state.pendingDecisions.findIndex((d) => d.id === decisionId);
  if (index === -1) return null;
  const decision = state.pendingDecisions[index]!;
  const option = decision.options.find((o) => o.id === optionId);
  if (!option) return null;

  const outcome = applyEffects(rng, state, option.effects, decision.textArgs);

  // Some choices are gambles: the option is taken, and then it either comes off or it
  // does not. What tilts the roll is the player himself - his standing, his form, the
  // trust he has built - so the same decision reads differently on another career.
  let branchKey: string | null = null;
  if (option.outcomes && option.outcomes.length > 0) {
    const branch = rng.weighted(option.outcomes, (candidate) => {
      const quality = (() => {
        switch (candidate.swayedBy) {
          case 'reputation': return state.player.reputation;
          case 'form': return state.player.form;
          case 'managerTrust': return state.relationships.manager;
          case 'determination': return state.player.personality.determination;
          case 'fame': return state.player.fame;
          default: return 50;
        }
      })();
      const tilt = ((quality - 50) / 50) * (candidate.sway ?? 0);
      return Math.max(0.05, candidate.weight * (1 + tilt));
    });
    if (branch) {
      branchKey = branch.key;
      const extra = applyEffects(rng, state, branch.effects, decision.textArgs);
      outcome.changes.push(...extra.changes);
      outcome.injuryTriggered = outcome.injuryTriggered || extra.injuryTriggered;
    }
  }

  const def = defs.find((d) => d.id === decision.eventId);
  const absoluteWeek = state.world.season * 52 + state.world.week;
  if (def) {
    state.eventCooldowns[def.id] = absoluteWeek + def.cooldownWeeks;
    if (def.oncePerCareer) state.firedOnceEvents.push(def.id);
    // Keep the same category from firing twice in a row.
    state.eventCooldowns['cat:' + def.category] = absoluteWeek + 2;
  }

  state.pendingDecisions.splice(index, 1);

  const consequences = evaluateConsequences(rng, state);
  if (outcome.injuryTriggered) consequences.push({ id: 'injuryPickedUp' });

  const result: DecisionResult = {
    changes: outcome.changes,
    consequences,
    narrativeKey: branchKey
      ? `${decision.textKey}.${option.id}.${branchKey}`
      : `${decision.textKey}.${option.id}.outcome`,
  };
  state.lastResult = result;
  return result;
}
