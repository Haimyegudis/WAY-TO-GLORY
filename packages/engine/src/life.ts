/**
 * The half of a footballer's life that is not the football.
 *
 * The game already had money, fame and a personality, and nothing to do with any of
 * them: the balance went up every week and sat there. A career is also the boot deal
 * that arrives when people start noticing him, the flat he buys when he can finally
 * afford one, the gym he puts in it, and the thing he does with his money that has
 * nothing to do with him at all.
 *
 * Two systems, both small on purpose. Sponsors pay weekly and want fame in return -
 * they arrive when he is worth having and leave when he is not. Things he buys cost
 * once and change how the weeks feel afterwards: a quieter home, a gym downstairs, a
 * charity that makes the crowd his. Neither of them makes him a better footballer by
 * itself; both of them make the money mean something.
 */
import { Rng, clamp } from './rng.js';
import type { CareerState } from './types.js';

export interface SponsorDeal {
  id: string;
  /** Which sort of company this is; the copy is per kind, not per invented brand. */
  kind: 'boots' | 'energy' | 'bank' | 'fashion' | 'car' | 'game';
  /** Paid every week the deal is live. */
  weekly: number;
  /** What being on their posters is worth, per week. */
  fameWeekly: number;
  /** Seasons the deal runs for, counted from the season it was signed. */
  seasons: number;
  signedSeason: number;
}

export interface LifeState {
  sponsors: SponsorDeal[];
  /** Things he has bought and still owns. */
  owned: string[];
  /** Offers on the table, waiting for an answer. */
  offers: SponsorDeal[];
  /** The last week a company came calling, so they do not call every week. */
  lastOfferWeek?: number;
}

export function emptyLife(): LifeState {
  return { sponsors: [], owned: [], offers: [] };
}

/* ----------------------------------------------------------------- sponsors */

/** What each sort of company pays, relative to how well known he is. */
const SPONSOR_KINDS: { kind: SponsorDeal['kind']; fame: number; rate: number; fameWeekly: number; seasons: number }[] = [
  { kind: 'boots', fame: 25, rate: 26, fameWeekly: 0.06, seasons: 3 },
  { kind: 'energy', fame: 40, rate: 34, fameWeekly: 0.1, seasons: 2 },
  { kind: 'game', fame: 55, rate: 48, fameWeekly: 0.12, seasons: 2 },
  { kind: 'car', fame: 62, rate: 62, fameWeekly: 0.08, seasons: 3 },
  { kind: 'bank', fame: 70, rate: 78, fameWeekly: 0.05, seasons: 4 },
  { kind: 'fashion', fame: 78, rate: 95, fameWeekly: 0.16, seasons: 2 },
];

/** How long a player is left alone between approaches. */
const SPONSOR_COOLDOWN = 16;

/**
 * Who wants him this week.
 *
 * A company approaches when he is famous enough to be worth putting on a poster, and
 * pays in proportion to that fame rather than to his wage - which is why a boot deal
 * can be worth more to a boy in a small league than his club is.
 */
export function raiseSponsorOffers(rng: Rng, state: CareerState): SponsorDeal[] {
  const life = state.life ?? emptyLife();
  const absolute = state.world.season * 52 + state.world.week;
  if (absolute - (life.lastOfferWeek ?? -999) < SPONSOR_COOLDOWN) return [];
  if (life.offers.length > 0) return [];

  const fame = state.player.fame;
  const available = SPONSOR_KINDS.filter(
    (kind) => fame >= kind.fame && !life.sponsors.some((deal) => deal.kind === kind.kind),
  );
  if (available.length === 0) return [];
  if (!rng.chance(0.35)) return [];

  const picked = available.slice(-2);
  const offers = picked.map((kind) => ({
    id: `sponsor_${kind.kind}_${state.world.season}_${state.world.week}`,
    kind: kind.kind,
    weekly: Math.round(kind.rate * (0.6 + fame / 90) * rng.range(0.85, 1.25)),
    fameWeekly: kind.fameWeekly,
    seasons: kind.seasons,
    signedSeason: state.world.season,
  }));

  life.lastOfferWeek = absolute;
  life.offers = offers;
  state.life = life;
  return offers;
}

export function signSponsor(state: CareerState, offerId: string): SponsorDeal | null {
  const life = state.life ?? emptyLife();
  const at = life.offers.findIndex((offer) => offer.id === offerId);
  if (at === -1) return null;
  const deal = { ...life.offers[at]!, signedSeason: state.world.season };
  life.sponsors.push(deal);
  life.offers = [];
  state.life = life;
  return deal;
}

export function declineSponsors(state: CareerState): void {
  const life = state.life ?? emptyLife();
  life.offers = [];
  state.life = life;
}

/* -------------------------------------------------------------- things to own */

export type LifeCategory = 'car' | 'home' | 'luxury' | 'lifestyle';

export interface LifeItem {
  id: string;
  cost: number;
  /** Which shelf it sits on, so the shop reads like a shop. */
  category: LifeCategory;
  /** What owning it does, every week, for as long as he owns it. */
  weekly?: { morale?: number; fame?: number; fatigue?: number; upkeep?: number };
  /** What it does the day he buys it. */
  once?: { morale?: number; fame?: number; fans?: number };
  /** Fame he has to have before anybody will sell it to him at all. */
  needsFame?: number;
}

/**
 * The things a footballer's money actually goes on, and every one of them is a trade.
 *
 * Nothing here buys ability. A car is fame and a lift in the mood; a gym at home takes
 * the edge off a hard week; a house out of town is worth a point of recovery and costs
 * him the crowd's attention. The charity pays nothing back except what the stands think
 * of him, which is the point of it.
 *
 * They come in price bands, and a band holds more than one thing, because two players on
 * the same money do not buy the same car. The alternatives cost exactly the same and are
 * not the same choice: the coupe is seen and the estate is not, the sailing yacht is a
 * summer and the motor yacht is a photograph.
 */
export const LIFE_ITEMS: LifeItem[] = [
  // ------------------------------------------------------------------- cars
  { id: 'firstCar', category: 'car', cost: 35_000, once: { morale: 6, fame: 2 }, weekly: { upkeep: 40 } },
  { id: 'familyEstate', category: 'car', cost: 35_000, once: { morale: 5 }, weekly: { morale: 0.1, upkeep: 30 } },
  { id: 'germanSaloon', category: 'car', cost: 260_000, needsFame: 35, once: { morale: 7, fame: 3 }, weekly: { upkeep: 180 } },
  { id: 'electricGT', category: 'car', cost: 260_000, needsFame: 35, once: { morale: 6, fame: 4 }, weekly: { upkeep: 120 } },
  { id: 'supercar', category: 'car', cost: 900_000, needsFame: 60, once: { morale: 9, fame: 6 }, weekly: { upkeep: 600 } },
  { id: 'grandTourer', category: 'car', cost: 900_000, needsFame: 60, once: { morale: 10, fame: 4 }, weekly: { morale: 0.1, upkeep: 520 } },

  // ------------------------------------------------------------------ homes
  { id: 'flat', category: 'home', cost: 140_000, once: { morale: 8 }, weekly: { morale: 0.25, upkeep: 90 } },
  { id: 'townhouse', category: 'home', cost: 140_000, once: { morale: 7 }, weekly: { morale: 0.2, fatigue: -0.2, upkeep: 110 } },
  { id: 'quietHouse', category: 'home', cost: 420_000, needsFame: 45, once: { morale: 10, fame: -2 }, weekly: { morale: 0.4, fatigue: -0.5, upkeep: 220 } },
  { id: 'poolVilla', category: 'home', cost: 420_000, needsFame: 45, once: { morale: 11, fame: 2 }, weekly: { morale: 0.3, fatigue: -0.3, upkeep: 300 } },
  { id: 'penthouse', category: 'home', cost: 2_200_000, needsFame: 65, once: { morale: 12, fame: 5 }, weekly: { morale: 0.35, upkeep: 900 } },
  { id: 'seafrontMansion', category: 'home', cost: 2_200_000, needsFame: 65, once: { morale: 13, fame: 3 }, weekly: { morale: 0.45, fatigue: -0.4, upkeep: 1_200 } },

  // ---------------------------------------------------------------- luxury
  { id: 'sailingYacht', category: 'luxury', cost: 4_500_000, needsFame: 70, once: { morale: 14, fame: 4 }, weekly: { morale: 0.3, fatigue: -0.4, upkeep: 2_400 } },
  { id: 'motorYacht', category: 'luxury', cost: 4_500_000, needsFame: 70, once: { morale: 12, fame: 9 }, weekly: { morale: 0.2, upkeep: 3_200 } },
  { id: 'lightJet', category: 'luxury', cost: 9_000_000, needsFame: 80, once: { morale: 12, fame: 8 }, weekly: { fatigue: -0.8, upkeep: 5_000 } },
  { id: 'longRangeJet', category: 'luxury', cost: 14_000_000, needsFame: 88, once: { morale: 15, fame: 12 }, weekly: { fatigue: -1.2, upkeep: 8_500 } },

  // ------------------------------------------------------------- lifestyle
  { id: 'homeGym', category: 'lifestyle', cost: 60_000, once: { morale: 3 }, weekly: { fatigue: -0.9, upkeep: 30 } },
  { id: 'charity', category: 'lifestyle', cost: 250_000, once: { morale: 5, fans: 8 }, weekly: { fame: 0.05, upkeep: 400 } },
  { id: 'watchCollection', category: 'lifestyle', cost: 300_000, needsFame: 50, once: { morale: 6, fame: 5 }, weekly: { upkeep: 60 } },
];

/** The order the shop shows its shelves in. */
export const LIFE_CATEGORIES: LifeCategory[] = ['car', 'home', 'luxury', 'lifestyle'];

export function itemById(id: string): LifeItem | undefined {
  return LIFE_ITEMS.find((item) => item.id === id);
}

/** Whether he could buy it today: the money, the standing, and not owning it already. */
export function canBuy(state: CareerState, id: string): 'yes' | 'owned' | 'money' | 'fame' | 'unknown' {
  const item = itemById(id);
  if (!item) return 'unknown';
  const life = state.life ?? emptyLife();
  if (life.owned.includes(id)) return 'owned';
  if (item.needsFame !== undefined && state.player.fame < item.needsFame) return 'fame';
  if (state.finances.balance < item.cost) return 'money';
  return 'yes';
}

export function buyItem(state: CareerState, id: string): LifeItem | null {
  if (canBuy(state, id) !== 'yes') return null;
  const item = itemById(id)!;
  const life = state.life ?? emptyLife();

  state.finances.balance -= item.cost;
  life.owned.push(id);
  state.life = life;

  const player = state.player;
  if (item.once?.morale) player.morale = clamp(player.morale + item.once.morale, 0, 100);
  if (item.once?.fame) player.fame = clamp(player.fame + item.once.fame, 0, 100);
  if (item.once?.fans) {
    state.relationships.fans = clamp(state.relationships.fans + item.once.fans, 0, 100);
  }
  return item;
}

/* ------------------------------------------------------------------ the week */

export interface LifeWeek {
  income: number;
  upkeep: number;
  expired: SponsorDeal[];
}

/**
 * What the life outside football does to a week: what it pays, what it costs to keep,
 * and which deals have run out.
 */
export function runLifeWeek(state: CareerState): LifeWeek {
  const life = state.life ?? emptyLife();
  const player = state.player;
  let income = 0;
  let upkeep = 0;

  const expired: SponsorDeal[] = [];
  life.sponsors = life.sponsors.filter((deal) => {
    if (state.world.season - deal.signedSeason >= deal.seasons) {
      expired.push(deal);
      return false;
    }
    income += deal.weekly;
    player.fame = clamp(player.fame + deal.fameWeekly, 0, 100);
    return true;
  });

  for (const id of life.owned) {
    const item = itemById(id);
    if (!item?.weekly) continue;
    if (item.weekly.upkeep) upkeep += item.weekly.upkeep;
    if (item.weekly.morale) player.morale = clamp(player.morale + item.weekly.morale, 0, 100);
    if (item.weekly.fame) player.fame = clamp(player.fame + item.weekly.fame, 0, 100);
    if (item.weekly.fatigue) {
      player.condition.fatigue = clamp(player.condition.fatigue + item.weekly.fatigue, 0, 100);
    }
  }

  // Money he does not have is money he does not spend: the upkeep takes what is there.
  const paid = Math.min(upkeep, Math.max(0, state.finances.balance + income));
  state.finances.balance = Math.max(0, state.finances.balance + income - paid);
  state.finances.careerEarnings += income;
  state.life = life;

  return { income, upkeep: paid, expired };
}
