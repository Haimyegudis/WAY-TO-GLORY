import { Rng, clamp, logistic } from './rng.js';
import { agentMovePressure } from './agents.js';
import { overall } from './positions.js';
import { clubBaseOvr } from './generate.js';
import { SENIOR_MIN_AGE } from './selection.js';
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

/**
 * What a good academy sees in a boy.
 *
 * A first-team scout asks whether he can play for the club now, and for a fifteen year
 * old the answer is always no - which is why the senior model returns nothing for
 * Barcelona looking at a boy in Israel, and why he never heard from a better academy in
 * his life. An academy is not buying a player, it is buying a ceiling: how high he
 * projects against the boys they already have, how visible he has made himself, and how
 * many years of development are left in him. Distance still counts, because a family
 * does not move countries for a maybe.
 */
function academyInterest(input: {
  club: Club;
  potential: number;
  age: number;
  form: number;
  reputation: number;
  minutesPct: number;
  agent: Agent | null;
  playerCountry: string;
}): number {
  // The standard of prospect that academy already has on its books.
  const bar = 52 + input.club.academy * 0.35;
  const promise = input.potential - bar;
  if (promise < -6) return 0;

  // Potential is hidden. They can only act on the boy they have actually watched.
  const seen = clamp(0.3 + input.minutesPct * 0.55 + input.reputation / 150, 0.3, 1);
  // Years left to develop him. Past nineteen an academy is not the point any more.
  const window = input.age <= 15 ? 1.15
    : input.age <= 17 ? 1
    : input.age === 18 ? 0.72
    : input.age === 19 ? 0.45
    : 0.15;
  const abroad = input.club.country !== input.playerCountry ? -9 : 0;
  const raw = (46 + promise * 2.6) * seen * window + abroad + (input.form - 50) * 0.15;
  return clamp(raw * agentReach(input.agent, input.club, input.playerCountry), 0, 100);
}

/**
 * How a move reads against where he is now: the division first, then the standing of the
 * league, then the strength of the squad. Deliberately blunt, because it is shown to the
 * player as three words rather than a number.
 */
export function levelStepFor(from: Club | undefined, fromComp: Competition | undefined, to: Club, toComp: Competition): 'up' | 'sideways' | 'down' {
  if (!from || !fromComp) return 'up';
  if (to.tier < from.tier) return 'up';
  if (to.tier > from.tier) return 'down';
  const reputation = toComp.reputation - fromComp.reputation;
  const strength = clubBaseOvr(to) - clubBaseOvr(from);
  const gap = reputation * 0.6 + strength * 0.8;
  if (gap >= 4) return 'up';
  if (gap <= -4) return 'down';
  return 'sideways';
}

function roleForOvr(ovr: number, clubLevel: number, age: number): SquadRole {
  const gap = ovr - clubLevel;
  // Age describes patience, not the team. A sixteen-year-old who is already above a
  // club's first-team level is offered first-team football, not mislabeled as another
  // academy prospect. Only a player still well short of that level gets a development role.
  if (age <= 18 && gap < -7) return 'futureProspect';
  if (age <= 20 && gap < -4) return 'prospect';
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

/**
 * How much better another club's academy is than the one he is in.
 *
 * Two things decide it: the coaching, and the standard of the boys he trains against
 * every day. A negative number is a step down, and a step down is not a youth move -
 * it is a senior offer or it is nothing.
 */
function academyStep(club: Club, current: Club | undefined): number {
  if (!current) return 0;
  return (club.academy - current.academy) * 0.6 + (clubBaseOvr(club) - clubBaseOvr(current)) * 0.4;
}

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
  const academyPlayer = player.squadRole === 'academy';
  const youthCompetition = academyPlayer && currentClub
    ? Object.values(state.world.youth?.competitions ?? {}).find((competition) => competition.table[currentClub.id])
    : undefined;
  const youthClubMatches = currentClub ? youthCompetition?.table[currentClub.id]?.played ?? 0 : 0;
  const playingShare = academyPlayer && youthClubMatches > 0
    ? clamp((state.world.youth?.form.minutes ?? 0) / (youthClubMatches * 90), 0, 1)
    : input.minutesPct;

  const value = marketValue(player, {
    season,
    leagueReputation: currentComp?.reputation ?? 40,
    contract: state.contract,
    internationalCaps: state.nationalTeam.caps,
  });

  /*
   * What the market measures him against.
   *
   * A player without a club used to be measured against a thirty-rated league, which is
   * below every division in the game - so every real league read as a two-rung jump, the
   * ladder rule refused all of it, and a released player never heard from anybody again.
   * He is measured against the last league he actually played in.
   */
  const lastLevel = Number(state.flags['lastClubLevel'] ?? 0);
  const lastReputation = Number(state.flags['lastLeagueReputation'] ?? 0);
  const currentLevel = currentClub ? clubBaseOvr(currentClub) : lastLevel || 30;
  const currentReputation = currentComp?.reputation ?? (lastReputation || 30);
  const listed = Boolean(state.flags['transferListed']);
  // A player at Napoli is not offered a place in the Israeli third tier. A club has to
  // be a step forward, or at least a sideways move that gets him playing - unless he
  // has been told he can leave, in which case he takes what he can get.
  // Divisions matter more than a strength number here: the bands overlap, so a
  // mid-table second-tier club and a good third-tier club look similar on paper while
  // being nothing alike as a move.
  const currentTier = currentClub?.tier ?? Number(state.flags['lastTier'] ?? 3);
  // What he told his agent to look for. A brief is not a wish list: it changes which
  // clubs ring back. Asking only for the biggest names means fewer calls, not better
  // ones, and saying he will drop a division opens doors that were shut.
  const aimHigh = Boolean(state.flags['aimHigh']);
  const aimMinutes = Boolean(state.flags['aimMinutes']);
  const homecoming = Boolean(state.flags['wantsHomecoming']);
  const lowerLeague = Boolean(state.flags['openToLowerLeague']);
  const exploring = Boolean(state.flags['exploringMove']);
  const desperate = listed || lowerLeague || playingShare < 0.12;
  // Greed minus career planning: positive pushes him up the ladder, negative toward games.
  const pressure = agentMovePressure(state.agent);
  /*
   * Established, which is not only a minutes column.
   *
   * A man who plays half his club's football, or holds a first-team role above rotation,
   * is not somebody a club a division down rings about - he is somebody they would have
   * to outbid. The old test was a bare 55% of minutes, which a top-flight starter fails
   * every August and after every mid-season move, and August is exactly when a smaller
   * club turned up on his phone offering him a level below the one he already had.
   */
  const seniorShirt = player.squadRole === 'starter'
    || player.squadRole === 'important'
    || player.squadRole === 'key'
    || player.squadRole === 'star';
  const regularStarter = !desperate && (playingShare >= 0.45 || seniorShirt);
  /*
   * A free agent takes what he can get.
   *
   * With a club, the floor is the level he is already at: nobody drops two divisions to
   * be a squad player somewhere worse. Without one, that floor is exactly what keeps him
   * unemployed - a boy released by a Championship club was still being shown only
   * Championship-level clubs, none of which wanted a forty-five rated nineteen year old.
   * So the floor follows him rather than the club that let him go, and every division is
   * open. The ladder rule above still measures the jump from the league he last played
   * in, so signing upwards is no easier than it ever was.
   */
  const clubless = !currentClub;
  const floor = clubless
    ? Math.min(currentLevel - 10, ovr - 8)
    : academyPlayer ? Math.min(currentLevel - 12, ovr - 7)
    : desperate ? currentLevel - 10 : currentLevel - 2;
  const competitionFloor = clubless
    ? Math.min(currentReputation - 12, 18)
    : academyPlayer ? currentReputation - 24
    : desperate ? currentReputation - 12 : currentReputation - 3;

  const candidates: {
    club: Club;
    comp: Competition;
    interest: number;
    role: SquadRole;
    joinAs?: 'academy' | 'senior';
  }[] = [];
  for (const club of Object.values(state.world.clubs)) {
    if (club.id === player.clubId) continue;
    const comp = index.competitionById.get(club.competitionId);
    if (!comp) continue;

    // A club well below his level, or a division well below the one he plays in, has
    // no business bidding for him.
    if (clubBaseOvr(club) < floor) continue;
    if (comp.reputation < competitionFloor) continue;
    // Minutes are the only honest reason to step down. A regular starter at a stronger
    // club is not recruited into a weaker project; a substitute or excluded player can
    // trade status for a genuine place in the side.
    if (
      regularStarter && currentClub && !academyPlayer && (
        club.tier > currentTier
        || comp.reputation < currentReputation - 2
        || clubBaseOvr(club) < currentLevel - 2
      )
    ) continue;
    // A division below is only on the table for someone who is not playing at all,
    // and two divisions below never is.
    const offeredRole = roleForOvr(ovr, clubBaseOvr(club), age);
    let joinAs: 'academy' | 'senior' | undefined;
    if (academyPlayer) {
      /*
       * A boy in an academy is offered one of two entirely different things, and the
       * offer has to know which.
       *
       * A better academy is progress in itself: a stronger club, a stronger age group,
       * better coaching. A weaker club is only ever worth it for first-team football,
       * and first-team football he is actually old enough to play - which is why a
       * fifteen year old at a good club now hears nothing from the third division,
       * where before he was offered a "rotation" place he could not legally take.
       */
      const betterAcademy = academyStep(club, currentClub) >= (regularStarter ? 4 : 0)
        && club.tier <= currentTier
        && comp.reputation >= currentReputation - 2;
      if (betterAcademy) {
        joinAs = 'academy';
      } else {
        /*
         * Not a better academy, so this is a senior offer or it is nothing.
         *
         * Every senior offer a boy gets is from a smaller club - a top-flight first team
         * does not sign a sixteen year old to play - and that is a real and often correct
         * move: men's football two divisions down is how a career starts. It is not a
         * move anybody puts to a boy who is doing well at a good academy and has already
         * been called up by the first team, though, and it was being put to
         * sixteen-year-olds tearing up their age group. From seventeen, and only when
         * the club he is at is not already taking him upstairs.
         */
        if (age < SENIOR_MIN_AGE + 1) continue;
        // If the first team has already asked to have a look at him, nobody is selling
        // him to the third division at seventeen.
        if (Boolean(state.flags['calledUpToSeniors']) && age < 18) continue;
        if (expectedMinutesFor(offeredRole) < expectedMinutesFor('rotation')) continue;
        if (club.tier > currentTier + 2) continue;
        joinAs = 'senior';
      }
    } else {
      if (club.tier > currentTier && !desperate && !clubless) continue;
      if (!clubless && club.tier > currentTier + 1) continue;
    }
    const interest = joinAs === 'academy'
      ? academyInterest({
        club,
        potential: player.potential,
        age,
        form: player.form,
        reputation: player.reputation,
        minutesPct: playingShare,
        agent: state.agent,
        playerCountry: player.birthCountry,
      })
      : transferInterest({
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
      currentClubStrength: currentClub?.strength ?? (lastLevel || 40),
      currentLeagueReputation: currentReputation,
      minutesPct: playingShare,
    });
    let weighted = interest;
    /*
     * The man on the phone, and what he is really selling.
     *
     * An agent's greed and his interest in the career were generated, saved and never
     * read, so every agent behaved identically and the only thing separating a super
     * agent from a local one was his commission. One who is paid on the size of the deal
     * pushes the biggest name that will take the call, whether or not there is a shirt
     * in it; one who plans a career walks past those and brings back the club where the
     * boy plays. It is worth a few points of interest either way, which is enough to
     * change which clubs actually ring.
     */
    if (pressure !== 0) {
      const stepUp = clubBaseOvr(club) - currentLevel;
      const room = ovr - clubBaseOvr(club);
      weighted += pressure > 0
        ? clamp(stepUp, -6, 14) * pressure * 1.6
        : clamp(room, -10, 10) * -pressure * 1.4;
    }
    // Aiming high: only clubs that are a real step up are worth his agent's time.
    if (aimHigh) {
      const stepUp = clubBaseOvr(club) - currentLevel;
      if (stepUp < 3) continue;
      weighted += Math.min(stepUp, 12);
    }
    // Aiming for minutes: a club where he walks into the side, not one where he waits.
    if (aimMinutes) {
      const room = ovr - clubBaseOvr(club);
      weighted += clamp(room * 2.2, -20, 16);
    }
    // Home is home, and the clubs there know exactly who he is.
    if (homecoming && club.country === player.birthCountry) weighted += 18;
    /*
     * How much a club has to want him before it picks up the phone.
     *
     * Forty-two is the bar for a player under contract, where signing him costs a fee
     * and a negotiation. A free agent costs nothing but wages, and a club two divisions
     * down will take a released nineteen year old on a Tuesday - so the bar for a player
     * with no club is far lower, which is the difference between a hard year and a
     * career that quietly ends at nineteen.
     */
    // A better academy signs a boy on his potential, not on whether he would walk into
    // a first team he is years away from, so the bar it has to clear is its own.
    const bar = joinAs === 'academy' ? 30 : clubless ? 16 : 42;
    if (weighted > bar) {
      candidates.push({
        club,
        comp,
        interest: weighted,
        role: joinAs === 'academy' ? 'academy' : offeredRole,
        ...(joinAs ? { joinAs } : {}),
      });
    }
  }

  candidates.sort((a, b) => b.interest - a.interest);
  const shortlist = candidates.slice(0, 16);
  const chosen: TransferOffer[] = [];
  // An agent working the phones brings back more; a player who only wants the elite
  // hears from fewer people.
  const maxOffers = Math.max(1, (input.maxOffers ?? 4) + (exploring ? 2 : 0) - (aimHigh ? 1 : 0));

  for (const candidate of rng.shuffle(shortlist)) {
    if (chosen.length >= maxOffers) break;
    // Interest is not the same as actually bidding.
    const floorForChance = candidate.joinAs === 'academy' ? 28 : clubless ? 14 : 40;
    if (!rng.chance(clamp((candidate.interest - floorForChance) / 90, 0.05, 0.75) * (exploring ? 1.4 : 1))) continue;

    const clubLevel = clubBaseOvr(candidate.club);
    const role = candidate.role;
    // A boy joining another academy is not loaned out on his first day.
    /*
     * A club that signs a boy it cannot play yet lends him out. It does not do that to a
     * man who is already somebody's first-choice: buying a starter and farming him out in
     * the same summer is not a transfer anybody would accept, and it was being offered.
     */
    const isLoan = candidate.joinAs !== 'academy'
      && !seniorShirt
      && (Boolean(state.flags['wantsLoan']) || (age <= 21 && ovr < clubLevel - 4 && rng.chance(0.35)));

    const joiningAcademy = candidate.joinAs === 'academy';
    const feeMultiplier = clamp(rng.range(0.75, 1.55) * (1 + (candidate.interest - 60) / 200), 0.5, 2.2);
    // An academy signs a boy for training compensation, not a transfer fee, and pays
    // him a scholar's wage rather than a first-team one.
    const fee = isLoan ? 0
      : joiningAcademy ? Math.round((value * 0.22) / 10_000) * 10_000
      : Math.round((value * feeMultiplier) / 50_000) * 50_000;
    const wage = joiningAcademy
      ? Math.round(clamp(150 + candidate.club.finances * 12 + candidate.club.reputation * 6, 150, 2_500))
      : expectedWage(player, ovr, candidate.club.finances, candidate.comp, age);

    chosen.push({
      id: `offer_${season}_${state.world.week}_${candidate.club.id}`,
      clubId: candidate.club.id,
      fee,
      salaryPerWeek: Math.round(wage * rng.range(0.9, 1.25)),
      years: isLoan ? 1
        : joiningAcademy ? rng.int(2, 3)
        : age < 21 ? rng.int(3, 5) : age < 30 ? rng.int(3, 4) : rng.int(1, 2),
      squadRole: isLoan ? 'starter' : role,
      expectedMinutesPct: expectedMinutesFor(isLoan ? 'starter' : role),
      isLoan,
      season,
      week: state.world.week,
      interestLevel: Math.round(candidate.interest),
      competitionId: candidate.club.competitionId,
      // Always stated, never inferred. An offer that does not say whether it is the
      // first team or the academy is an offer a player cannot answer honestly.
      joinAs: candidate.joinAs ?? 'senior',
      levelStep: levelStepFor(currentClub, currentComp, candidate.club, candidate.comp),
      // The old flag, kept because saves and screens read it: it means exactly what it
      // says now, which is that he is leaving academy football behind.
      ...(academyPlayer && candidate.joinAs !== 'academy' ? { seniorPathway: true } : {}),
    });
  }

  return chosen;
}

/**
 * The verdict of a club that has actually watched him: a trial he flew out for, or a
 * stand full of their scouts on Saturday.
 *
 * The rest of the market is a scan of everybody who might move for him. This is one
 * named club making its mind up, so it answers either way - an offer, or nothing, which
 * is still an answer and is told to him as one.
 */
export function offerFromWatchingClub(input: {
  state: CareerState;
  index: PackIndex;
  rng: Rng;
  club: Club;
  minutesPct: number;
  /** How well the look at him went, -1 to 1. */
  impression: number;
}): TransferOffer | null {
  const { state, index, rng, club } = input;
  const player = state.player;
  const season = state.world.season;
  const age = season - player.birthYear;
  const ovr = overall(player.attributes, player.primaryPos, player.secondaryPos);
  const comp = index.competitionById.get(club.competitionId);
  if (!comp || club.id === player.clubId) return null;

  const currentClub = player.clubId ? state.world.clubs[player.clubId] : undefined;
  const currentComp = currentClub ? index.competitionById.get(currentClub.competitionId) : undefined;
  const academyPlayer = player.squadRole === 'academy';
  const value = marketValue(player, {
    season,
    leagueReputation: currentComp?.reputation ?? 40,
    contract: state.contract,
    internationalCaps: state.nationalTeam.caps,
  });

  /*
   * A boy is signed by the academy unless he is old enough, and good enough, for the
   * first team.
   *
   * "A boy" is not only somebody whose squad role still says academy: a sixteen year
   * old promoted to future prospect after a good camp is exactly the player a club
   * abroad takes into its youth setup. Judging him as a senior signing instead meant a
   * club flew him out, watched him for a week, and then decided he was not ready for a
   * first team he was two years away from - so nobody ever signed anybody.
   */
  const developmentRole = academyPlayer
    || player.squadRole === 'futureProspect'
    || player.squadRole === 'prospect';
  const joinAs: 'academy' | 'senior' =
    age < SENIOR_MIN_AGE || (developmentRole && age <= 19 && academyStep(club, currentClub) >= 0)
      ? 'academy'
      : 'senior';

  const interest = joinAs === 'academy'
    ? academyInterest({
      club,
      potential: player.potential,
      age,
      form: player.form,
      reputation: player.reputation,
      minutesPct: input.minutesPct,
      agent: state.agent,
      playerCountry: player.birthCountry,
    })
    : transferInterest({
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
      currentLeagueReputation: currentComp?.reputation ?? 40,
      minutesPct: input.minutesPct,
    });

  /*
   * They have seen him with their own eyes.
   *
   * Both interest models discount a club by how likely it is to have heard of him at
   * all - which for a boy with no agent and a club abroad is a factor of five, and is
   * why a club could fly him out for a week and then decide he was not worth a contract
   * it had already paid to look at. That discount has been spent: this club is in the
   * room. What remains is the judgement itself, and the week he actually had.
   */
  /*
   * Even a club that flew him out cannot offer him a step backwards.
   *
   * This path skips the whole market scan, so none of its rules applied to it: a scout
   * could watch a first-team regular in the top division and come back with an academy
   * place or a club two divisions below him. What they have seen decides how much they
   * want him; it does not decide whether the move is one a player in his position would
   * ever take.
   */
  const established = !state.flags['transferListed']
    && !state.flags['openToLowerLeague']
    && (input.minutesPct >= 0.45 || player.squadRole === 'starter' || player.squadRole === 'important'
      || player.squadRole === 'key' || player.squadRole === 'star');
  if (established && currentClub && currentComp) {
    const stepDown = club.tier > currentClub.tier
      || comp.reputation < currentComp.reputation - 2
      || clubBaseOvr(club) < clubBaseOvr(currentClub) - 2;
    if (stepDown) return null;
    // And nobody takes a first-team player and puts him in an age group.
    if (joinAs === 'academy' && !academyPlayer) return null;
  }

  const reach = agentReach(state.agent, club, player.birthCountry);
  const weighted = interest / clamp(reach, 0.15, 1.35) + input.impression * 14;
  // What it takes to be signed, which is not a fixed number: an academy with a name has
  // a hundred boys like him already and a modest one has room.
  const bar = joinAs === 'academy' ? 34 + club.academy * 0.28 : 30 + clubBaseOvr(club) * 0.25;
  if (weighted < bar) return null;

  const clubLevel = clubBaseOvr(club);
  const role = joinAs === 'academy' ? 'academy' : roleForOvr(ovr, clubLevel, age);
  // Too good to leave in his own reserves, not yet ready for theirs: they take him for
  // a season and send him somewhere he will play.
  const isLoan = joinAs === 'senior' && age <= 21 && ovr < clubLevel - 5;
  const fee = isLoan ? 0
    : joinAs === 'academy' ? Math.round((value * 0.22) / 10_000) * 10_000
    : Math.round((value * clamp(rng.range(0.8, 1.5), 0.5, 2.2)) / 50_000) * 50_000;

  return {
    id: `watched_${season}_${state.world.week}_${club.id}`,
    clubId: club.id,
    fee,
    salaryPerWeek: joinAs === 'academy'
      ? Math.round(clamp(150 + club.finances * 12 + club.reputation * 6, 150, 2_500))
      : Math.round(expectedWage(player, ovr, club.finances, comp, age) * rng.range(0.9, 1.2)),
    years: joinAs === 'academy' ? rng.int(2, 3) : isLoan ? 1 : rng.int(2, 4),
    squadRole: isLoan ? 'starter' : role,
    expectedMinutesPct: expectedMinutesFor(isLoan ? 'starter' : role),
    isLoan,
    season,
    week: state.world.week,
    interestLevel: Math.round(clamp(weighted, 0, 100)),
    competitionId: club.competitionId,
    joinAs,
    levelStep: levelStepFor(currentClub, currentComp, club, comp),
    ...(academyPlayer && joinAs !== 'academy' ? { seniorPathway: true } : {}),
  };
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
  // He has to be young, short of minutes, and behind the standard of his own club. A
  // first-team role is itself the answer to the question a loan asks, whatever the
  // minutes column happens to say in the week somebody looks at it.
  const firstTeam = player.squadRole === 'starter' || player.squadRole === 'important'
    || player.squadRole === 'key' || player.squadRole === 'star';
  if (age > 24 || input.minutesPct > 0.3 || parentLevel - ovr < 4 || firstTeam) return [];

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
      levelStep: levelStepFor(currentClub, index.competitionById.get(currentClub.competitionId), candidate.club, candidate.comp),
      // A loan is first-team football somewhere else, always. That is what it is for.
      joinAs: 'senior' as const,
      ...(player.squadRole === 'academy' ? { seniorPathway: true } : {}),
    });
  }
  return offers;
}
