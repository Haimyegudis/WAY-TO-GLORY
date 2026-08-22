/**
 * Which flag he plays under.
 *
 * A player with two passports is not a player with one national team and a footnote: he
 * is a player two associations are competing for, and the competition is one of the few
 * genuinely national dramas in a career. Until a competitive senior cap ties him down,
 * both federations can call, and the one that gets there first with the better case
 * usually wins.
 *
 * This is the case each of them makes. Not "we would like you" - the reason: you would
 * be in the squad next month, we are going to a tournament and they are not, nobody else
 * is calling you. All of it is read off the world rather than written in advance, so the
 * argument is true whenever it is made.
 */
import { clamp } from './rng.js';
import type { PackIndex } from './data.js';
import type { CareerState } from './types.js';

/** Why an association is worth choosing, strongest true reason first. */
export type PitchReason = 'playNow' | 'tournament' | 'bigger' | 'onlyRoad' | 'wantYouMore';

export interface AssociationPitch {
  countryCode: string;
  countryName: string;
  reputation: number;
  interest: number;
  /** The association he would be turning down, when there is one calling. */
  rivalCode: string | null;
  rivalName: string;
  rivalReputation: number;
  rivalInterest: number;
  reason: PitchReason;
  /** A citizenship he holds but no federation had registered yet. */
  isNew: boolean;
}

/** The bar an association has to clear before it is worth ringing him at all. */
const APPROACH_INTEREST = 42;

/**
 * Seasons in a country before its federation may call a man who was not born there.
 *
 * Five years of residence is FIFA's rule and it is the reason half the smaller national
 * teams in the world look the way they do. Here it is counted in seasons at clubs in
 * that country, which is the same thing from a footballer's side of it.
 */
const RESIDENCY_SEASONS = 5;

/** Countries whose federation could claim him for having lived and played there. */
function residencyCountries(state: CareerState): string[] {
  const seasons = new Map<string, Set<number>>();
  for (const record of state.seasonHistory) {
    const club = record.clubId ? state.world.clubs[record.clubId] : undefined;
    if (!club || record.apps < 5) continue;
    const held = seasons.get(club.country) ?? new Set<number>();
    held.add(record.season);
    seasons.set(club.country, held);
  }
  return [...seasons.entries()]
    .filter(([country, played]) => played.size >= RESIDENCY_SEASONS && !state.player.citizenships.includes(country))
    .map(([country]) => country);
}

/**
 * The association that would call him this week, if one would.
 *
 * Nobody approaches a player who is already tied to somebody, and nobody approaches a
 * player his own federation is about to pick anyway - the second association's case
 * only exists while the first one is still thinking about it.
 */
export function associationApproach(state: CareerState, index: PackIndex): AssociationPitch | null {
  const nt = state.nationalTeam;
  if (nt.capturedBySenior) return null;
  const age = state.world.season - state.player.birthYear;
  if (age < 16) return null;

  // Everybody who could pick him: the federations already watching, and any passport
  // he holds that none of them has registered.
  const codes = new Set<string>([
    ...nt.eligibleCountries,
    ...state.player.citizenships,
    ...residencyCountries(state),
  ]);
  if (codes.size < 2) return null;

  const ranked = [...codes]
    .map((code) => ({
      code,
      interest: nt.interest[code] ?? 0,
      reputation: index.countryByCode.get(code)?.reputation ?? 40,
      name: index.countryByCode.get(code)?.name ?? code,
      known: nt.eligibleCountries.includes(code),
    }))
    .sort((a, b) => b.interest - a.interest || b.reputation - a.reputation);

  const leader = ranked[0];
  if (!leader) return null;

  // The one making the call is the best of the rest - unless he has already pledged
  // himself, in which case the pledge is what is being fought over.
  const pledged = nt.countryCode;
  const suitors = ranked.filter((entry) => entry.code !== (pledged ?? leader.code));
  const caller = suitors[0];
  if (!caller) return null;

  const rival = ranked.find((entry) => entry.code === (pledged ?? leader.code)) ?? null;
  // A passport nobody has registered is a real approach even at no interest: that is
  // exactly the call a player gets from the country of his grandmother.
  const worthMaking = caller.interest >= APPROACH_INTEREST
    || (!caller.known && caller.reputation >= (rival?.reputation ?? 0) - 6);
  if (!worthMaking) return null;

  const reason: PitchReason = caller.interest >= 58 && caller.interest > (rival?.interest ?? 0) + 8
    ? 'playNow'
    : caller.reputation >= 62 && caller.reputation > (rival?.reputation ?? 0) + 10
      ? 'tournament'
      : (rival?.interest ?? 0) < 30
        ? 'onlyRoad'
        : caller.reputation > (rival?.reputation ?? 0) + 6
          ? 'bigger'
          : 'wantYouMore';

  return {
    countryCode: caller.code,
    countryName: caller.name,
    reputation: Math.round(caller.reputation),
    interest: Math.round(caller.interest),
    rivalCode: rival?.code ?? null,
    rivalName: rival?.name ?? '',
    rivalReputation: Math.round(rival?.reputation ?? 0),
    rivalInterest: Math.round(rival?.interest ?? 0),
    reason,
    isNew: !caller.known,
  };
}

/**
 * He says yes.
 *
 * A pledge is not a cap and it does not bind him in law - he can still change his mind
 * until he plays a competitive senior match - but it binds the game: this is the shirt
 * that calls him now, and the one he turned down stops watching for a while.
 */
export function pledgeTo(state: CareerState, code: string): void {
  const nt = state.nationalTeam;
  if (!nt.eligibleCountries.includes(code)) nt.eligibleCountries.push(code);
  nt.countryCode = code;
  nt.interest[code] = clamp(Math.max(nt.interest[code] ?? 0, 62) + 12, 0, 100);
  for (const other of nt.eligibleCountries) {
    if (other === code) continue;
    nt.interest[other] = clamp((nt.interest[other] ?? 0) * 0.55, 0, 100);
  }
}

/** He says no. They stop calling, and the one he stayed with hears about it. */
export function turnDown(state: CareerState, code: string): void {
  const nt = state.nationalTeam;
  nt.interest[code] = clamp((nt.interest[code] ?? 0) * 0.35, 0, 100);
  for (const other of nt.eligibleCountries) {
    if (other === code) continue;
    nt.interest[other] = clamp((nt.interest[other] ?? 0) + 7, 0, 100);
  }
}
