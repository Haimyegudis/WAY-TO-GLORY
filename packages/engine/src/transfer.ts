import { Rng, clamp, logistic } from './rng.js';
import { overall } from './positions.js';
import { clubBaseOvr } from './generate.js';
import { expectedWage, marketValue } from './value.js';
import type { PackIndex } from './data.js';
import type {
  Agent,
  CareerState,
  Club,
  Competition,
  SquadRole,
  TransferOffer,
} from './types.js';

export const SUMMER_WINDOW: [number, number] = [1, 9];
export const WINTER_WINDOW: [number, number] = [27, 31];

/**
 * When each country's windows are open, in season weeks, with week 1 as the start of
 * July. Most of Europe runs 1 July to 1 September and the whole of January; the ones
 * listed here differ enough to be worth writing down. Everyone else takes the default.
 */
const COUNTRY_WINDOWS: Record<string, { summer: [number, number]; winter: [number, number] }> = {
  ENG: { summer: [1, 9], winter: [27, 31] },
  ESP: { summer: [1, 9], winter: [27, 31] },
  ITA: { summer: [1, 9], winter: [27, 31] },
  GER: { summer: [1, 9], winter: [27, 31] },
  FRA: { summer: [1, 9], winter: [27, 31] },
  POR: { summer: [1, 9], winter: [27, 31] },
  NED: { summer: [1, 9], winter: [27, 31] },
  BEL: { summer: [1, 10], winter: [27, 31] },
  TUR: { summer: [1, 10], winter: [27, 31] },
  GRE: { summer: [1, 10], winter: [27, 32] },
  SCO: { summer: [1, 9], winter: [27, 31] },
  AUT: { summer: [1, 9], winter: [27, 32] },
  // The Israeli window opens a little later and the winter one runs into February.
  ISR: { summer: [2, 11], winter: [27, 33] },
  // Countries playing a spring-to-autumn calendar move their windows with it.
  SWE: { summer: [5, 12], winter: [30, 36] },
  NOR: { summer: [5, 12], winter: [30, 36] },
  DEN: { summer: [1, 9], winter: [27, 32] },
};

function windowsFor(country?: string): { summer: [number, number]; winter: [number, number] } {
  return (country && COUNTRY_WINDOWS[country]) || { summer: SUMMER_WINDOW, winter: WINTER_WINDOW };
}

/** True in the weeks leading up to a window, when agents start making calls. */
export function isWindowApproaching(week: number, country?: string, lead = 4): boolean {
  const { summer, winter } = windowsFor(country);
  const before = (range: [number, number]) => week >= range[0] - lead && week < range[0];
  return before(summer) || before(winter);
}

export function isTransferWindow(week: number, country?: string): boolean {
  const { summer, winter } = windowsFor(country);
  return (
    (week >= summer[0] && week <= summer[1]) ||
    (week >= winter[0] && week <= winter[1])
  );
}

/** Which window a week belongs to, for "one approach per window" bookkeeping. */
export function windowIdFor(season: number, week: number, country?: string): string {
  const { summer } = windowsFor(country);
  return `${season}:${week <= summer[1] + 6 ? 'summer' : 'winter'}`;
}

/** Which countries a club can realistically scout the player in. */
function agentReach(agent: Agent | null, club: Club, playerCountry: string): number {
  if (!agent) {
    // Without an agent you are visible mostly at home.
    return club.country === playerCountry ? 0.8 : 0.18;
  }
  const inNetwork = agent.countries.includes(club.country);
  const base = inNetwork ? 1 : agent.internationalNetwork / 130;
  const tierBonus =
    agent.tier === 'superAgent' ? 0.35 : agent.tier === 'international' ? 0.22 : agent.tier === 'national' ? 0.1 : 0;
  return clamp(base + tierBonus, 0.1, 1.35);
}

export interface InterestInput {
  club: Club;
  competition: Competition;
  ovr: number;
  potential: number;
  age: number;
  form: number;
  reputation: number;
  value: number;
  agent: Agent | null;
  playerCountry: string;
  currentClubStrength: number;
  /** Standing of the league he plays in now, which is how far a move really is. */
  currentLeagueReputation: number;
  minutesPct: number;
}

/**
 * How badly a club wants this player, 0-100.
 * Clubs sign players near their own level; big clubs also gamble on young potential.
 */
export function transferInterest(input: InterestInput): number {
  const clubLevel = clubBaseOvr(input.club);
  const gap = input.ovr - clubLevel;

  // Football has a ladder, and almost nobody skips it. A seventeen year old in the
  // Israeli league does not go straight to a European giant: he moves to a mid-table
  // side in a stronger league first, does it there, and is bought from that shop
  // window. Only a genuinely exceptional player jumps two rungs at once.
  const leagueJump = input.competition.reputation - input.currentLeagueReputation;
  if (leagueJump > 26) {
    const exceptional = input.ovr >= clubLevel - 6 && input.reputation >= 58;
    if (!exceptional) return 0;
  } else if (leagueJump > 15) {
    const ready = input.ovr >= clubLevel - 12 && input.reputation >= 38;
    if (!ready) return 0;
  }

  // A club does not sign a player who is nowhere near its level. Real Madrid do not
  // bid for a 45-rated seventeen year old, and if they ever do it is because he is a
  // wonderkid the whole continent has already heard of - which means real potential
  // and a reputation to match, not one good month in a youth team.
  const shortfall = clubLevel - input.ovr;
  if (shortfall > 26) return 0;
  if (shortfall > 16) {
    const wonderkid =
      input.age <= 20 &&
      input.potential >= clubLevel - 3 &&
      input.reputation >= 42 + (clubLevel - 70) * 0.5;
    if (!wonderkid) return 0;
  }

  // Best fit is a player slightly better than the current squad average.
  const fitScore = 100 * Math.exp(-((gap - 2) ** 2) / 90);

  const potentialGap = Math.max(0, input.potential - input.ovr);
  // Potential is hidden from the world: clubs are reading a player they have watched,
  // so how much his ceiling counts depends on how visible he is - minutes on the pitch
  // and a name people know.
  const scoutingConfidence = clamp(0.25 + input.minutesPct * 0.6 + input.reputation / 180, 0.25, 1);
  const youthAppeal =
    input.age <= 23 ? clamp(potentialGap * (input.club.reputation / 100) * 1.6 * scoutingConfidence, 0, 45) : 0;

  const formScore = (input.form - 50) * 0.28;
  const repScore = (input.reputation - clubLevel * 0.6) * 0.22;
  const minutesScore = (input.minutesPct - 0.35) * 22;

  const affordability = logistic((input.club.finances * 1.6e6 - input.value) / 8e6) * 26 - 8;
  const reach = agentReach(input.agent, input.club, input.playerCountry);

  const raw = (fitScore * 0.55 + youthAppeal + formScore + repScore + minutesScore + affordability) * reach;
  return clamp(raw, 0, 100);
}

function roleForOvr(ovr: number, clubLevel: number, age: number): SquadRole {
  const gap = ovr - clubLevel;
  if (age <= 18) return gap > 0 ? 'prospect' : 'futureProspect';
  if (gap >= 8) return 'star';
  if (gap >= 4) return 'key';
  if (gap >= 1) return 'important';
  if (gap >= -3) return 'starter';
  if (gap >= -7) return 'rotation';
  if (gap >= -11) return 'bench';
  return 'fringe';
}

const ROLE_MINUTES: Record<SquadRole, number> = {
  academy: 0.05,
  futureProspect: 0.08,
  prospect: 0.2,
  fringe: 0.12,
  bench: 0.25,
  rotation: 0.45,
  starter: 0.68,
  important: 0.78,
  key: 0.86,
  star: 0.9,
};

export function expectedMinutesFor(role: SquadRole): number {
  return ROLE_MINUTES[role];
}

export interface OfferGenInput {
  state: CareerState;
  index: PackIndex;
  rng: Rng;
  minutesPct: number;
  maxOffers?: number;
}

/** Scan the world for clubs that would move for the player right now. */
export function generateOffers(input: OfferGenInput): TransferOffer[] {
  const { state, index, rng } = input;
  const player = state.player;
  const season = state.world.season;
  const age = season - player.birthYear;
  const ovr = overall(player.attributes, player.primaryPos, player.secondaryPos);
  const currentClub = player.clubId ? state.world.clubs[player.clubId] : undefined;
  const currentComp = currentClub ? index.competitionById.get(currentClub.competitionId) : undefined;

  const value = marketValue(player, {
    season,
    leagueReputation: currentComp?.reputation ?? 40,
    contract: state.contract,
    internationalCaps: state.nationalTeam.caps,
  });

  const currentLevel = currentClub ? clubBaseOvr(currentClub) : 30;
  const currentReputation = currentComp?.reputation ?? 30;
  const listed = Boolean(state.flags['transferListed']);
  const shortOfMinutes = input.minutesPct < 0.25;
  // A player at Napoli is not offered a place in the Israeli third tier. A club has to
  // be a step forward, or at least a sideways move that gets him playing - unless he
  // has been told he can leave, in which case he takes what he can get.
  // Divisions matter more than a strength number here: the bands overlap, so a
  // mid-table second-tier club and a good third-tier club look similar on paper while
  // being nothing alike as a move.
  const currentTier = currentClub?.tier ?? 3;
  const desperate = listed || input.minutesPct < 0.12;
  const floor = desperate ? currentLevel - 10 : currentLevel - 2;
  const competitionFloor = desperate ? currentReputation - 12 : currentReputation - 3;

  const candidates: { club: Club; comp: Competition; interest: number }[] = [];
  for (const club of Object.values(state.world.clubs)) {
    if (club.id === player.clubId) continue;
    const comp = index.competitionById.get(club.competitionId);
    if (!comp) continue;

    // A club well below his level, or a division well below the one he plays in, has
    // no business bidding for him.
    if (clubBaseOvr(club) < floor) continue;
    if (comp.reputation < competitionFloor) continue;
    // A division below is only on the table for someone who is not playing at all,
    // and two divisions below never is.
    if (club.tier > currentTier && !desperate) continue;
    if (club.tier > currentTier + 1) continue;
    const interest = transferInterest({
      club,
      competition: comp,
      ovr,
      potential: player.potential,
      age,
      form: player.form,
      reputation: player.reputation,
      value,
      agent: state.agent,
      playerCountry: player.birthCountry,
      currentClubStrength: currentClub?.strength ?? 40,
      currentLeagueReputation: currentComp?.reputation ?? 30,
      minutesPct: input.minutesPct,
    });
    if (interest > 42) candidates.push({ club, comp, interest });
  }

  candidates.sort((a, b) => b.interest - a.interest);
  const shortlist = candidates.slice(0, 16);
  const chosen: TransferOffer[] = [];
  const maxOffers = input.maxOffers ?? 4;

  for (const candidate of rng.shuffle(shortlist)) {
    if (chosen.length >= maxOffers) break;
    // Interest is not the same as actually bidding.
    if (!rng.chance(clamp((candidate.interest - 40) / 90, 0.05, 0.75))) continue;

    const clubLevel = clubBaseOvr(candidate.club);
    const role = roleForOvr(ovr, clubLevel, age);
    const isLoan = age <= 21 && ovr < clubLevel - 4 && rng.chance(0.35);

    const feeMultiplier = clamp(rng.range(0.75, 1.55) * (1 + (candidate.interest - 60) / 200), 0.5, 2.2);
    const fee = isLoan ? 0 : Math.round((value * feeMultiplier) / 50_000) * 50_000;
    const wage = expectedWage(player, ovr, candidate.club.finances, candidate.comp, age);

    chosen.push({
      id: `offer_${season}_${state.world.week}_${candidate.club.id}`,
      clubId: candidate.club.id,
      fee,
      salaryPerWeek: Math.round(wage * rng.range(0.9, 1.25)),
      years: isLoan ? 1 : age < 21 ? rng.int(3, 5) : age < 30 ? rng.int(3, 4) : rng.int(1, 2),
      squadRole: isLoan ? 'starter' : role,
      expectedMinutesPct: expectedMinutesFor(isLoan ? 'starter' : role),
      isLoan,
      season,
      week: state.world.week,
      interestLevel: Math.round(candidate.interest),
      competitionId: candidate.club.competitionId,
    });
  }

  return chosen;
}

/** Whether the current club wants to keep the player when the contract runs down. */
export function renewalIntent(
  rng: Rng,
  ovr: number,
  clubLevel: number,
  age: number,
  minutesPct: number,
  managerTrust: number,
): 'extend' | 'letExpire' | 'release' {
  const score =
    (ovr - clubLevel) * 3 + minutesPct * 40 + (managerTrust - 50) * 0.4 - Math.max(0, age - 31) * 6 + rng.gauss(0, 6);
  if (score > 8) return 'extend';
  if (score > -12) return 'letExpire';
  return 'release';
}

/**
 * Loan offers for a young player who is not getting on the pitch.
 *
 * This is how a career at a big club actually works: the coaching and the facilities
 * make him better faster, but the first team is full of internationals, so the only
 * way to turn training-ground ability into a footballer is a season somewhere he will
 * start every week. Smaller clubs cannot buy him, but they can borrow him - they get
 * a player above their level for a season, he gets the minutes.
 */
export function generateLoanOffers(input: {
  state: CareerState;
  index: PackIndex;
  rng: Rng;
  minutesPct: number;
  maxOffers?: number;
}): TransferOffer[] {
  const { state, index, rng } = input;
  const player = state.player;
  const season = state.world.season;
  const age = season - player.birthYear;
  const ovr = overall(player.attributes, player.primaryPos, player.secondaryPos);
  const currentClub = player.clubId ? state.world.clubs[player.clubId] : undefined;
  if (!currentClub) return [];

  const parentLevel = clubBaseOvr(currentClub);
  // He has to be young, short of minutes, and behind the standard of his own club.
  if (age > 24 || input.minutesPct > 0.3 || parentLevel - ovr < 4) return [];

  const candidates: { club: Club; comp: Competition; fit: number }[] = [];
  for (const club of Object.values(state.world.clubs)) {
    if (club.id === currentClub.id) continue;
    const comp = index.competitionById.get(club.competitionId);
    if (!comp) continue;

    const level = clubBaseOvr(club);
    // The club has to be weak enough that he walks into the side, but not so weak
    // that a season there teaches him nothing.
    if (level > ovr + 2 || level < ovr - 14) continue;

    // Clubs prefer a loan from a bigger club in their own country, and a player whose
    // potential says he is worth the risk.
    const sameCountry = club.country === currentClub.country ? 8 : 0;
    const prestigeGap = clamp(parentLevel - level, 0, 25);
    const fit = 40 + prestigeGap * 1.3 + (player.potential - 60) * 0.5 + sameCountry + rng.gauss(0, 6);
    if (fit > 45) candidates.push({ club, comp, fit });
  }

  candidates.sort((a, b) => b.fit - a.fit);
  const shortlist = rng.shuffle(candidates.slice(0, 14));
  const offers: TransferOffer[] = [];
  const max = input.maxOffers ?? 3;

  for (const candidate of shortlist) {
    if (offers.length >= max) break;
    const level = clubBaseOvr(candidate.club);
    // A loan is cheap by design: a fee the size of a fortnight's wages, no more.
    const role: SquadRole = ovr >= level + 4 ? 'starter' : 'rotation';
    offers.push({
      id: `loan_${season}_${state.world.week}_${candidate.club.id}`,
      clubId: candidate.club.id,
      fee: 0,
      salaryPerWeek: expectedWage(player, ovr, candidate.club.finances, candidate.comp, age),
      years: 1,
      squadRole: role,
      expectedMinutesPct: expectedMinutesFor(role),
      isLoan: true,
      season,
      week: state.world.week,
      interestLevel: Math.round(clamp(candidate.fit, 40, 99)),
      competitionId: candidate.club.competitionId,
    });
  }
  return offers;
}
