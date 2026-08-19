/**
 * A career played end to end with everything watched at once.
 *
 * Not a unit test: a career walked for as long as it lasts, checking after every single
 * week that nothing in the world has gone out of range or out of sense. Anything that
 * trips is printed with the week it happened on, so it can be found again.
 *
 *   tsx test/audit.probe.ts [seed] [seeds]
 */
import {
  advanceWeek,
  answerMedia,
  answerOffer,
  answerSeasonGoal,
  currentOvr,
  resumeHalfTime,
  userSquad,
} from '../src/career.js';
import { resolveDecision } from '../src/events.js';
import { LIFE_ITEMS, buyItem, canBuy, declineSponsors, signSponsor } from '../src/life.js';
import { ATTRIBUTE_KEYS } from '../src/types.js';
import type { CareerState, Player } from '../src/types.js';
import { overall } from '../src/positions.js';
import { Rng } from '../src/rng.js';
import { userYouthCompetition } from '../src/youth.js';
import { loadPack, startedCareer } from './helpers.js';
import type { PackIndex } from '../src/data.js';

loadPack();

const firstSeed = Number(process.argv[2] ?? 7);
const seedCount = Number(process.argv[3] ?? 3);

interface Finding {
  seed: number;
  season: number;
  week: number;
  what: string;
}

const findings: Finding[] = [];
let reported = new Set<string>();

function flag(seed: number, state: CareerState, what: string): void {
  // One line per kind of problem per career: a broken invariant repeats every week and
  // the point is to name it, not to count it.
  const key = `${seed}:${what.split(':')[0]}`;
  if (reported.has(key)) return;
  reported.add(key);
  findings.push({ seed, season: state.world.season, week: state.world.week, what });
}

const inRange = (value: number, low: number, high: number) =>
  Number.isFinite(value) && value >= low && value <= high;

function checkPlayer(seed: number, state: CareerState, player: Player, where: string): void {
  for (const key of ATTRIBUTE_KEYS) {
    const value = player.attributes[key];
    if (!inRange(value, 1, 99)) flag(seed, state, `attribute out of range: ${where} ${key}=${value}`);
  }
  if (!inRange(player.potential, 1, 99)) flag(seed, state, `potential out of range: ${where} ${player.potential}`);
  if (!inRange(player.form, 0, 100)) flag(seed, state, `form out of range: ${where} ${player.form}`);
  if (!inRange(player.fitness, 0, 100)) flag(seed, state, `fitness out of range: ${where} ${player.fitness}`);
  if (!inRange(player.morale, 0, 100)) flag(seed, state, `morale out of range: ${where} ${player.morale}`);
  if (!inRange(player.reputation, 0, 100)) flag(seed, state, `reputation out of range: ${where} ${player.reputation}`);
  if (!inRange(player.fame, 0, 100)) flag(seed, state, `fame out of range: ${where} ${player.fame}`);
  if (!inRange(player.condition.fatigue, 0, 100)) flag(seed, state, `fatigue out of range: ${where} ${player.condition.fatigue}`);
  if (!inRange(player.condition.sharpness, 0, 100)) flag(seed, state, `sharpness out of range: ${where} ${player.condition.sharpness}`);
  const ovr = overall(player.attributes, player.primaryPos, player.secondaryPos);
  if (!inRange(ovr, 1, 99)) flag(seed, state, `overall out of range: ${where} ${ovr}`);
  if (ovr > player.potential + 1) flag(seed, state, `overall above potential: ${where} ${ovr} > ${player.potential}`);
  if (!player.firstName.trim() || !player.lastName.trim()) flag(seed, state, `nameless player: ${where} ${player.id}`);
}

function auditWeek(seed: number, state: CareerState, index: PackIndex): void {
  const player = state.player;
  checkPlayer(seed, state, player, 'user');

  // Money and contract.
  const money = state.finances;
  if (!Number.isFinite(money.balance)) flag(seed, state, `balance not a number: ${money.balance}`);
  if (money.balance < -1) flag(seed, state, `balance went negative: ${Math.round(money.balance)}`);
  if (state.contract) {
    const deal = state.contract;
    if (!Number.isFinite(deal.salaryPerWeek) || deal.salaryPerWeek < 0) {
      flag(seed, state, `wage nonsense: ${deal.salaryPerWeek}`);
    }
    if (deal.endSeason < state.world.season - 1) {
      flag(seed, state, `contract expired but still held: ends ${deal.endSeason}`);
    }
    if (deal.clubId !== player.clubId) flag(seed, state, `contract is with another club: ${deal.clubId}`);
  }

  // Relationships and standing.
  for (const [who, value] of Object.entries(state.relationships ?? {})) {
    if (!inRange(value as number, 0, 100)) flag(seed, state, `relationship out of range: ${who}=${value}`);
  }
  if (!inRange(state.managerTrust, 0, 100)) flag(seed, state, `manager trust out of range: ${state.managerTrust}`);

  // The club he is at has to exist and have him in it.
  if (player.clubId) {
    const club = state.world.clubs[player.clubId];
    if (!club) flag(seed, state, `club missing from world: ${player.clubId}`);
    const squad = state.world.squads[player.clubId] ?? [];
    const academy = player.squadRole === 'academy';
    if (club && !academy && !squad.includes(player.id) && squad.length > 0) {
      flag(
        seed,
        state,
        `not in his own club's squad: ${player.clubId} role=${player.squadRole} squad=${squad.length} loan=${state.contract?.isLoan ?? false}`,
      );
    }
    if (club && squad.length > 0 && squad.length < 11) {
      flag(seed, state, `squad too small to field a team: ${player.clubId} has ${squad.length}`);
    }
  }

  // Everyone else in his dressing room.
  const mates = userSquad(state);
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  for (const mate of mates) {
    if (seenIds.has(mate.id)) flag(seed, state, `two players share an id: ${mate.id}`);
    seenIds.add(mate.id);
    const name = `${mate.firstName} ${mate.lastName}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (seenNames.has(name)) flag(seed, state, `the same man twice in the squad: ${name}`);
    seenNames.add(name);
    checkPlayer(seed, state, mate, `mate ${mate.id}`);
    const age = state.world.season - mate.birthYear;
    if (!inRange(age, 14, 45)) flag(seed, state, `team-mate of impossible age: ${age}`);
  }

  // Injuries and bans count down rather than sitting for ever.
  for (const injury of player.condition.injuries) {
    if (!inRange(injury.weeksOut, 0, 104)) flag(seed, state, `injury length nonsense: ${injury.weeksOut}`);
  }
  for (const ban of player.condition.suspensions) {
    if (!inRange(ban.matchesRemaining, 0, 20)) flag(seed, state, `suspension length nonsense: ${ban.matchesRemaining}`);
  }

  // The season's football.
  for (const match of state.matchLog.slice(0, 6)) {
    const line = match.userLine;
    if (!line) continue;
    if (!inRange(line.minutes, 0, 130)) flag(seed, state, `minutes out of range: ${line.minutes}`);
    if (line.played && !inRange(line.rating, 1, 10)) flag(seed, state, `rating out of range: ${line.rating}`);
    if (line.goals > 0 && line.shots > 0 && line.goals > line.shots) {
      flag(seed, state, `more goals than shots: ${line.goals}/${line.shots}`);
    }
    if (!line.played && (line.goals > 0 || line.assists > 0)) {
      flag(seed, state, `scored without playing: ${match.id}`);
    }
    if (match.homeGoals < 0 || match.awayGoals < 0) flag(seed, state, `negative scoreline: ${match.id}`);
  }

  // The league he is in.
  const comp = player.clubId ? state.world.competitions[state.world.clubs[player.clubId]?.competitionId ?? ''] : null;
  if (comp) {
    for (const [clubId, row] of Object.entries(comp.table)) {
      const played = row.won + row.drawn + row.lost;
      if (played !== row.played) flag(seed, state, `table row does not add up: ${clubId} ${row.played} vs ${played}`);
      if (row.points !== row.won * 3 + row.drawn) flag(seed, state, `points do not match results: ${clubId}`);
      if (row.goalsFor < 0 || row.goalsAgainst < 0) flag(seed, state, `negative goals in the table: ${clubId}`);
    }
  }

  // The age group.
  const youth = userYouthCompetition(state);
  if (youth) {
    for (const [clubId, row] of Object.entries(youth.table)) {
      if (row.won + row.drawn + row.lost !== row.played) {
        flag(seed, state, `youth table does not add up: ${clubId}`);
      }
    }
  }
  const boys = state.world.youth?.players ?? {};
  for (const boy of Object.values(boys).slice(0, 40)) {
    const age = state.world.season - boy.birthYear;
    if (!inRange(age, 13, 23)) flag(seed, state, `boy of the wrong age in the age group: ${age}`);
  }

  // National team.
  const nt = state.nationalTeam;
  if (nt) {
    if (nt.caps < 0 || nt.goals < 0) flag(seed, state, `negative international record`);
    if (nt.goals > nt.caps * 5) flag(seed, state, `more goals than a career of caps allows: ${nt.goals}/${nt.caps}`);
  }

  // The life outside football.
  const life = state.life;
  if (life) {
    for (const deal of life.sponsors) {
      if (!Number.isFinite(deal.weekly) || deal.weekly < 0) flag(seed, state, `sponsor pays nonsense: ${deal.weekly}`);
      if (state.world.season - deal.signedSeason > deal.seasons) {
        flag(seed, state, `sponsor deal outlived its term: ${deal.kind}`);
      }
    }
    if (new Set(life.owned).size !== life.owned.length) flag(seed, state, 'the same thing owned twice');
    if (life.offers.length > 3) flag(seed, state, `too many offers at once: ${life.offers.length}`);
  }

  // The inbox and the decisions in front of him.
  if (state.inbox.length > 400) flag(seed, state, `inbox never emptied: ${state.inbox.length}`);
  const blocking = state.pendingDecisions.filter((d) => d.blocking !== false);
  if (blocking.length > 3) flag(seed, state, `too many blocking questions at once: ${blocking.length}`);
  for (const decision of state.pendingDecisions) {
    // Offers and agents are answered on their own screens, so an empty option list is
    // only a problem for the questions the decision sheet has to draw.
    if (decision.kind === 'event' && (!decision.options || decision.options.length === 0)) {
      flag(seed, state, `a question with no answers: ${decision.eventId}`);
    }
  }
}

for (let s = 0; s < seedCount; s++) {
  const seed = firstSeed + s * 101;
  reported = new Set<string>();
  const { state, index } = startedCareer({ seed });
  const rng = new Rng(seed);

  const counts = {
    weeks: 0,
    matches: 0,
    halfTimes: 0,
    media: 0,
    mentor: 0,
    events: 0,
    offers: 0,
    injuries: 0,
    goals: 0,
    sponsors: 0,
    bought: 0,
    clubs: new Set<string>([state.player.clubId ?? '']),
  };

  for (let i = 0; i < 53 * 20 && !state.retired; i++) {
    const result = advanceWeek(state, index);
    counts.weeks++;
    if (result.stopped === 'match') counts.matches++;

    if (result.stopped === 'halfTime' && state.pendingHalfTime) {
      counts.halfTimes++;
      const held = state.pendingHalfTime;
      resumeHalfTime(state, index, held.demand ?? held.options[rng.int(0, held.options.length - 1)]!);
      if (state.pendingHalfTime?.matchId === held.matchId) {
        flag(seed, state, `the interval was not cleared after it was answered: ${held.matchId}`);
      }
    }

    // Answer everything the way a player would: something, every time.
    for (const decision of [...state.pendingDecisions]) {
      // A transfer or an agent carries no options of its own - the clubs and the agents
      // are the options, on their own screens - so they are answered before anything
      // asks for a paragraph to pick.
      if (decision.kind === 'transfer') {
        counts.offers++;
        const clubs = state.transferOffers ?? [];
        const take = rng.chance(0.5) && clubs.length > 0 ? clubs[rng.int(0, clubs.length - 1)]!.id : null;
        answerOffer(state, index, decision.id, take);
        state.pendingDecisions = state.pendingDecisions.filter((d) => d.id !== decision.id);
        continue;
      }
      if (decision.kind === 'agent') {
        counts.mentor++;
        state.pendingDecisions = state.pendingDecisions.filter((d) => d.id !== decision.id);
        continue;
      }
      const option = decision.options[rng.int(0, decision.options.length - 1)];
      if (!option) continue;
      if (decision.eventId === 'seasonGoal') {
        counts.goals++;
        answerSeasonGoal(state, index, decision.id, option.id);
        continue;
      }
      if (decision.eventId.startsWith('milestone:')) {
        counts.media++;
        answerMedia(state, index, decision.id, option.id);
      } else if (decision.eventId.startsWith('mentorPrompt_') || decision.id.startsWith('mentorPrompt_')) {
        counts.mentor++;
        state.pendingDecisions = state.pendingDecisions.filter((d) => d.id !== decision.id);
      } else {
        counts.events++;
        resolveDecision(rng, state, decision.id, option.id, index.pack.events);
      }
      if (state.pendingDecisions.some((d) => d.id === decision.id)) {
        flag(seed, state, `a question could not be answered: ${decision.eventId}`);
        state.pendingDecisions = state.pendingDecisions.filter((d) => d.id !== decision.id);
      }
    }

    // Sign what is offered half the time, and buy what he can afford.
    if (state.life?.offers.length) {
      counts.sponsors++;
      if (rng.chance(0.6)) signSponsor(state, state.life.offers[0]!.id);
      else declineSponsors(state);
    }
    if (rng.chance(0.02)) {
      for (const item of LIFE_ITEMS) {
        if (canBuy(state, item.id) === 'yes') { buyItem(state, item.id); counts.bought++; break; }
      }
    }

    if (state.player.condition.injuries.length > 0) counts.injuries++;
    if (state.player.clubId) counts.clubs.add(state.player.clubId);
    auditWeek(seed, state, index);
  }

  const ovr = currentOvr(state);
  const age = state.world.season - state.player.birthYear;
  console.log(
    `seed ${seed}: ${counts.weeks} weeks, retired at ${age} on ovr ${ovr}, ` +
      `${counts.matches} match stops, ${counts.halfTimes} team talks, ${counts.media} press, ` +
      `${counts.events} events, ${counts.offers} offers, ${counts.goals} season targets, ` +
      `${counts.sponsors} sponsor calls, ${counts.bought} things bought, ${counts.clubs.size} clubs, ` +
      `${state.inbox.length} in the inbox`,
  );
}

console.log('');
if (findings.length === 0) {
  console.log('nothing tripped');
} else {
  console.log(`${findings.length} findings:`);
  for (const f of findings) console.log(`  seed ${f.seed} · ${f.season}/${f.week}: ${f.what}`);
}
