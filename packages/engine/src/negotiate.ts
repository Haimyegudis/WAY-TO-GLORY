/**
 * Talking terms.
 *
 * A player used to sign whatever was put in front of him. Real contracts are argued over,
 * and what is argued over is not only the wage: how long the deal runs, what he is being
 * signed as, whether there is a number written in that lets him leave, and how much lands
 * on the day he signs.
 *
 * Every ask is a real risk. The club's patience runs down with each one, and a club that
 * did not want him that badly to begin with will walk away rather than be haggled with -
 * which is exactly what makes holding out for one more thing a decision worth making.
 */
import { Rng, clamp } from './rng.js';
import type { Agent, SquadRole, TransferOffer } from './types.js';

export type ContractAsk = 'wage' | 'role' | 'length' | 'clause' | 'bonus';
export const CONTRACT_ASKS: ContractAsk[] = ['wage', 'role', 'length', 'clause', 'bonus'];

export interface NegotiationOutcome {
  ask: ContractAsk;
  /** They agreed and the offer on the table has changed. */
  agreed: boolean;
  /** They have had enough: the offer is gone. */
  withdrawn: boolean;
  offer: TransferOffer;
}

const ROLE_LADDER: SquadRole[] = [
  'academy', 'futureProspect', 'prospect', 'fringe', 'bench', 'rotation', 'starter', 'important', 'key', 'star',
];

/** A step up the ladder, or the same role when there is nowhere left to go. */
function betterRole(role: SquadRole): SquadRole {
  const at = ROLE_LADDER.indexOf(role);
  return at >= 0 && at < ROLE_LADDER.length - 1 ? ROLE_LADDER[at + 1]! : role;
}

/** How hard each ask is to win, before anything about the player is taken into account. */
const ASK_DIFFICULTY: Record<ContractAsk, number> = {
  // Money is what clubs guard hardest, and a promise of minutes is what managers guard
  // hardest. A clause is cheap to give and expensive later, which is why clubs say yes to
  // it more often than they should.
  wage: 0.30,
  role: 0.34,
  length: 0.18,
  clause: 0.22,
  bonus: 0.26,
};

export interface NegotiationInput {
  rng: Rng;
  offer: TransferOffer;
  agent: Agent | null;
  /** His current rating against what the club is worth, which is all the leverage he has. */
  ovr: number;
  clubLevel: number;
  form: number;
  reputation: number;
  /** How many clubs are waiting behind this one. */
  rivalOffers: number;
}

/**
 * One ask. The answer depends on how badly they want him, who is doing the talking, and
 * how many times he has already been back to the table.
 */
export function negotiate(input: NegotiationInput, ask: ContractAsk): NegotiationOutcome {
  const { rng, offer, agent } = input;
  const asksMade = offer.asksMade ?? 0;

  const wanted = clamp((offer.interestLevel - 45) / 55, -0.3, 0.6);
  const talker = agent ? (agent.negotiation - 45) / 160 : -0.12;
  const standing = clamp((input.ovr - input.clubLevel) / 22, -0.35, 0.35);
  const leverage = clamp(input.rivalOffers * 0.07 + (input.form - 55) / 260 + (input.reputation - 45) / 320, -0.1, 0.35);

  const chance = clamp(
    ASK_DIFFICULTY[ask] + wanted + talker + standing + leverage - asksMade * 0.22,
    0.04,
    0.9,
  );

  const agreed = rng.chance(chance);
  const updated: TransferOffer = { ...offer, asksMade: asksMade + 1 };

  if (agreed) {
    switch (ask) {
      case 'wage':
        updated.salaryPerWeek = Math.round(offer.salaryPerWeek * rng.range(1.12, 1.32));
        break;
      case 'role': {
        const role = betterRole(offer.squadRole);
        updated.squadRole = role;
        updated.expectedMinutesPct = Math.min(0.92, offer.expectedMinutesPct + rng.range(0.08, 0.18));
        break;
      }
      case 'length':
        updated.years = Math.min(6, offer.years + 1);
        break;
      case 'clause':
        // Priced off the wage, the way clauses are: a year's salary for every good season
        // they expect out of him.
        updated.releaseClause = Math.round(offer.salaryPerWeek * 52 * rng.range(3.5, 6.5));
        break;
      case 'bonus':
        updated.signingBonus = Math.round(offer.salaryPerWeek * rng.range(8, 22));
        break;
    }
    return { ask, agreed: true, withdrawn: false, offer: updated };
  }

  // A no is usually just a no. But a club that was lukewarm to start with, being asked for
  // a third time, stops returning calls.
  const patience = clamp(0.06 + asksMade * 0.13 - wanted * 0.22, 0.02, 0.55);
  const withdrawn = rng.chance(patience);
  return { ask, agreed: false, withdrawn, offer: updated };
}
