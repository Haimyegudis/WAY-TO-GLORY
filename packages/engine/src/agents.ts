import { Rng, clamp } from './rng.js';
import { pickName } from './generate.js';
import type { PackIndex } from './data.js';
import type { Agent, AgentTier, Player } from './types.js';

const TIER_ORDER: AgentTier[] = ['local', 'national', 'international', 'superAgent'];

const TIER_PROFILE: Record<Exclude<AgentTier, 'none'>, {
  connections: [number, number];
  negotiation: [number, number];
  commission: [number, number];
  reachCountries: number;
  minReputation: number;
}> = {
  local: { connections: [20, 45], negotiation: [15, 45], commission: [0.03, 0.05], reachCountries: 1, minReputation: 0 },
  national: { connections: [40, 65], negotiation: [35, 62], commission: [0.04, 0.07], reachCountries: 2, minReputation: 22 },
  international: { connections: [60, 85], negotiation: [55, 82], commission: [0.06, 0.1], reachCountries: 4, minReputation: 45 },
  superAgent: { connections: [82, 98], negotiation: [78, 96], commission: [0.08, 0.14], reachCountries: 8, minReputation: 68 },
};

let agentCounter = 0;

export function generateAgent(rng: Rng, index: PackIndex, tier: Exclude<AgentTier, 'none'>, homeCountry: string): Agent {
  const profile = TIER_PROFILE[tier];
  const pool = index.namesByLocale.get(index.countryByCode.get(homeCountry)?.nameLocale ?? 'en')
    ?? index.namesByLocale.get('en')!;
  const { firstName, lastName } = pickName(rng, pool);

  const allCountries = index.pack.countries.map((c) => c.code).filter((c) => c !== homeCountry);
  const reach = [homeCountry, ...rng.shuffle(allCountries).slice(0, Math.max(0, profile.reachCountries - 1))];

  agentCounter = (agentCounter + 1) % 100000;

  return {
    id: `agent_${tier}_${agentCounter}`,
    name: `${firstName} ${lastName}`,
    tier,
    connections: Math.round(rng.range(profile.connections[0], profile.connections[1])),
    negotiation: Math.round(rng.range(profile.negotiation[0], profile.negotiation[1])),
    loyalty: Math.round(rng.gaussIn(55, 18, 5, 95)),
    greed: Math.round(rng.gaussIn(tier === 'superAgent' ? 70 : 45, 18, 5, 98)),
    careerPlanning: Math.round(rng.gaussIn(tier === 'local' ? 45 : 60, 18, 5, 98)),
    internationalNetwork: Math.round(
      clamp(rng.gaussIn(tier === 'superAgent' ? 90 : tier === 'international' ? 72 : tier === 'national' ? 40 : 18, 12, 2, 99), 2, 99),
    ),
    commissionPct: Number(rng.range(profile.commission[0], profile.commission[1]).toFixed(3)),
    relationship: Math.round(rng.gaussIn(60, 10, 30, 85)),
    countries: reach,
  };
}

/** Which agents would take this player on right now. */
export function availableAgentTiers(reputation: number, ovr: number, age: number): AgentTier[] {
  const score = reputation * 0.7 + ovr * 0.4 - Math.max(0, age - 30) * 2;
  return TIER_ORDER.filter((tier) => {
    if (tier === 'none') return true;
    const profile = TIER_PROFILE[tier as Exclude<AgentTier, 'none'>];
    return score >= profile.minReputation;
  });
}

export function generateAgentOffers(
  rng: Rng,
  index: PackIndex,
  player: Player,
  ovr: number,
  age: number,
  count = 3,
): Agent[] {
  const tiers = availableAgentTiers(player.reputation, ovr, age);
  const offers: Agent[] = [];
  for (let i = 0; i < count; i++) {
    const tier = rng.weighted(tiers, (t) => (t === 'superAgent' ? 0.4 : t === 'international' ? 0.8 : 1));
    if (!tier || tier === 'none') continue;
    offers.push(generateAgent(rng, index, tier as Exclude<AgentTier, 'none'>, player.birthCountry));
  }
  return offers;
}

/**
 * A pushy agent nudges the player toward moves that suit the agent, not the career.
 * Low careerPlanning + high greed = the agent that sends a 19-year-old to a bench in England.
 */
export function agentMovePressure(agent: Agent | null): number {
  if (!agent) return 0;
  return clamp((agent.greed - agent.careerPlanning) / 100, -0.5, 0.6);
}

export function agentCommission(agent: Agent | null, amount: number): number {
  if (!agent) return 0;
  return Math.round(amount * agent.commissionPct);
}
