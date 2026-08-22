/**
 * Coverage probe: what actually happens in a career, and what never does.
 *
 * Not a unit test. Careers are played end to end with every question answered, and
 * every id the engine can produce is counted: events, milestones, mentor prompts,
 * consequences, actions, awards, injuries, offers, copy keys. Anything with a count of
 * zero is a path the game contains and never walks.
 *
 *   tsx test/coverage.probe.ts [seeds] [seasons]
 */
import {
  advanceWeek,
  answerContractRenewal,
  answerMedia,
  answerMentor,
  answerOffer,
  answerAgent,
  answerSeasonGoal,
  actionsAvailableNow,
  askMentor,
  chooseMentor,
  currentOvr,
  doPlayerAction,
  mentorChoices,
  resumeHalfTime,
  takeMentorAdvice,
} from '../src/career.js';
import { resolveDecision } from '../src/events.js';
import { LIFE_ITEMS, buyItem, canBuy, declineSponsors, signSponsor } from '../src/life.js';
import { MILESTONES } from '../src/milestones.js';
import { MENTOR_PROMPTS, mentorTopics, type MentorTopic } from '../src/mentor.js';
import { PLAYER_ACTIONS } from '../src/social.js';
import { Rng } from '../src/rng.js';
import { he } from '../../app/src/i18n/he.js';
import { en } from '../../app/src/i18n/en.js';
import { loadPack, startedCareer } from './helpers.js';

const pack = loadPack();
const seeds = Number(process.argv[2] ?? 10);
const maxSeasons = Number(process.argv[3] ?? 30);

const count = <T,>(map: Map<T, number>, key: T) => map.set(key, (map.get(key) ?? 0) + 1);

const events = new Map<string, number>();
const milestones = new Map<string, number>();
const prompts = new Map<string, number>();
const consequences = new Map<string, number>();
const actionsOffered = new Map<string, number>();
const actionsTaken = new Map<string, number>();
const inboxKeys = new Map<string, number>();
const newsKeys = new Map<string, number>();
const achievements = new Map<string, number>();
const awards = new Map<string, number>();
const injuryIncidents = new Map<string, number>();
const importances = new Map<string, number>();
const notPlayedReasons = new Map<string, number>();
const offerKinds = new Map<string, number>();
const trophyKinds = new Map<string, number>();
const mentorTopicsAsked = new Map<string, number>();
const mentorSituations = new Map<string, number>();
const halfTimeInstructions = new Map<string, number>();
const lifeBought = new Map<string, number>();
const sponsorKinds = new Map<string, number>();
const squadRoles = new Map<string, number>();
const endStates = new Map<string, number>();
const narrativeKeys = new Map<string, number>();
const optionKeys = new Map<string, number>();
const competitionsPlayed = new Map<string, number>();

const managerSpells = new Map<string, number>();
const ownGoals: number[] = [];
const renewals = new Map<string, number>();
const careers: Record<string, number | string>[] = [];
const matchRatings: number[] = [];
const bothGoals: number[] = [];
const seasonMinutes: number[] = [];

for (let s = 0; s < seeds; s++) {
  const seed = 11 + s * 37;
  const rng = new Rng(seed * 7 + 3);
  const { state, index } = startedCareer({ seed }, s % 5);
  let mentorPicked = false;
  const seenInbox = new Set<string>();
  const seenNews = new Set<string>();
  const seenMatches = new Set<string>();
  const seenInjuries = new Set<string>();
  const clubs = new Set<string>([state.player.clubId ?? '']);
  let peakOvr = 0;
  let peakBalance = 0;
  let weeks = 0;
  let missedInjury = 0;
  let played = 0;
  const startSeason = state.world.season;

  while (!state.retired && state.world.season - startSeason < maxSeasons && weeks < 53 * maxSeasons * 2) {
    weeks++;
    const result = advanceWeek(state, index);
    peakOvr = Math.max(peakOvr, currentOvr(state));
    peakBalance = Math.max(peakBalance, state.finances.balance);

    if (result.stopped === 'halfTime' && state.pendingHalfTime) {
      const held = state.pendingHalfTime;
      const pick = held.demand ?? held.options[rng.int(0, held.options.length - 1)]!;
      count(halfTimeInstructions, pick);
      resumeHalfTime(state, index, pick);
    }

    if (!mentorPicked) {
      const choices = mentorChoices(state);
      if (choices.length > 0) {
        chooseMentor(state, choices[rng.int(0, choices.length - 1)]!.id);
        mentorPicked = true;
      }
    }
    if (mentorPicked && rng.chance(0.3)) {
      const topics = mentorTopics(state, state.world.season - state.player.birthYear);
      const topic = topics[rng.int(0, topics.length - 1)] as MentorTopic | undefined;
      if (topic) {
        const reply = askMentor(state, topic);
        if (reply) {
          count(mentorTopicsAsked, reply.topic);
          count(mentorSituations, reply.situation);
          count(narrativeKeys, reply.lineKey);
          if (reply.brief && rng.chance(0.5)) takeMentorAdvice(state, reply);
        }
      }
    }

    for (const action of actionsAvailableNow(state)) count(actionsOffered, action.id);
    if (rng.chance(0.6)) {
      const available = actionsAvailableNow(state);
      if (available.length > 0) {
        const action = available[rng.int(0, available.length - 1)]!;
        const outcome = doPlayerAction(state, action.id);
        if (outcome) {
          count(actionsTaken, action.id);
          if (outcome.narrativeKey) count(narrativeKeys, outcome.narrativeKey);
          for (const consequence of outcome.consequences) count(consequences, consequence.id);
        }
      }
    }

    for (const decision of [...state.pendingDecisions]) {
      for (const option of decision.options ?? []) {
        count(optionKeys, option.labelKey);
        if (option.riskKey) count(optionKeys, option.riskKey);
      }
      if (decision.textKey) count(optionKeys, decision.textKey);
      if (decision.kind === 'transfer') {
        const offers = state.transferOffers ?? [];
        for (const offer of offers) {
          count(offerKinds, offer.isLoan ? 'loan' : offer.joinAs === 'academy' ? 'academy' : 'senior');
        }
        const take = rng.chance(0.45) && offers.length > 0 ? offers[rng.int(0, offers.length - 1)]!.id : null;
        const outcome = answerOffer(state, index, decision.id, take);
        if (outcome?.narrativeKey) count(narrativeKeys, outcome.narrativeKey);
        state.pendingDecisions = state.pendingDecisions.filter((d) => d.id !== decision.id);
        continue;
      }
      if (decision.kind === 'agent') {
        const agents = decision.agents ?? [];
        const take = rng.chance(0.7) && agents.length > 0 ? agents[rng.int(0, agents.length - 1)]!.id : null;
        const outcome = answerAgent(state, decision.id, take);
        if (outcome?.narrativeKey) count(narrativeKeys, outcome.narrativeKey);
        state.pendingDecisions = state.pendingDecisions.filter((d) => d.id !== decision.id);
        continue;
      }
      const option = decision.options[rng.int(0, decision.options.length - 1)];
      if (!option) {
        state.pendingDecisions = state.pendingDecisions.filter((d) => d.id !== decision.id);
        continue;
      }
      if (decision.eventId === 'contractRenewal') {
        const pick = ['sign', 'pushForMore', 'runItDown'][rng.int(0, 2)]!;
        count(renewals, pick);
        answerContractRenewal(state, index, decision.id, pick);
      } else if (decision.eventId === 'seasonGoal') {
        answerSeasonGoal(state, index, decision.id, option.id);
      } else if (decision.eventId.startsWith('milestone:')) {
        count(milestones, decision.eventId.replace('milestone:', ''));
        const outcome = answerMedia(state, index, decision.id, option.id);
        if (outcome?.narrativeKey) count(narrativeKeys, outcome.narrativeKey);
      } else if (decision.eventId.startsWith('mentorPrompt:')) {
        count(prompts, decision.eventId.replace('mentorPrompt:', ''));
        answerMentor(state, decision.id, option.id);
      } else if (decision.eventId === 'retirement_choice') {
        const retire = rng.chance(0.35);
        count(endStates, retire ? 'choseToRetire' : 'playedOn');
        state.pendingDecisions = state.pendingDecisions.filter((d) => d.id !== decision.id);
        if (retire) state.flags['wantsRetirement'] = true;
      } else {
        count(events, decision.eventId);
        const outcome = resolveDecision(rng, state, decision.id, option.id, index.pack.events);
        if (outcome?.narrativeKey) count(narrativeKeys, outcome.narrativeKey);
        for (const consequence of outcome?.consequences ?? []) count(consequences, consequence.id);
      }
      state.pendingDecisions = state.pendingDecisions.filter((d) => d.id !== decision.id);
    }

    if (state.life?.offers.length) {
      if (rng.chance(0.7)) {
        const deal = signSponsor(state, state.life.offers[0]!.id);
        if (deal) count(sponsorKinds, deal.kind);
      } else declineSponsors(state);
    }
    if (rng.chance(0.08)) {
      for (const item of rng.shuffle([...LIFE_ITEMS])) {
        if (canBuy(state, item.id) === 'yes') { buyItem(state, item.id); count(lifeBought, item.id); break; }
      }
    }

    count(squadRoles, state.player.squadRole);
    if (state.manager) count(managerSpells, `${state.manager.clubId}:${state.manager.name}:${state.manager.since}`);
    for (const injury of state.player.condition.injuries) {
      if (seenInjuries.has(injury.id)) continue;
      seenInjuries.add(injury.id);
      count(injuryIncidents, injury.type);
    }
    if (state.player.clubId) clubs.add(state.player.clubId);

    for (const message of state.inbox) {
      const key = `${message.season}:${message.week}:${message.titleKey}`;
      if (seenInbox.has(key)) continue;
      seenInbox.add(key);
      count(inboxKeys, message.titleKey);
    }
    for (const item of state.news) {
      const key = `${item.season}:${item.week}:${item.key}`;
      if (seenNews.has(key)) continue;
      seenNews.add(key);
      count(newsKeys, item.key);
    }
    for (const match of state.matchLog) {
      if (seenMatches.has(match.id)) continue;
      seenMatches.add(match.id);
      count(importances, match.importance ?? 'normal');
      const comp = match.competitionId;
      count(competitionsPlayed, comp.startsWith('national') ? 'national'
        : comp.startsWith('friendly') ? 'friendly'
        : comp.endsWith('.youth') ? 'youth'
        : comp.includes('cup') ? 'cup'
        : ['ucl', 'uel', 'uecl'].some((t) => comp.startsWith(t)) ? 'europe'
        : 'league');
      const line = match.userLine;
      if (!line) continue;
      if (line.played) {
        played++;
        matchRatings.push(line.rating);
        bothGoals.push(match.homeGoals + match.awayGoals);
        if (line.ownGoals) ownGoals.push(line.ownGoals);
      } else if (line.reasonNotPlayed) {
        count(notPlayedReasons, line.reasonNotPlayed);
        if (line.reasonNotPlayed === 'injured') missedInjury++;
      }
    }
  }

  for (const record of state.seasonHistory) seasonMinutes.push(record.minutes);
  for (const achievement of state.achievements) count(achievements, achievement.id);
  for (const award of state.awards ?? []) count(awards, award.award);
  for (const trophy of state.trophies) count(trophyKinds, trophy.kind);
  count(endStates, state.retired ? 'retired' : 'ranOutOfSeasons');

  const apps = state.seasonHistory.reduce((sum, r) => sum + r.apps, 0);
  const goals = state.seasonHistory.reduce((sum, r) => sum + r.goals, 0);
  careers.push({
    seed,
    seasons: state.seasonHistory.length,
    age: state.world.season - state.player.birthYear,
    ovr: currentOvr(state),
    peakOvr,
    apps,
    goals,
    caps: state.nationalTeam.caps,
    clubs: clubs.size,
    trophies: state.trophies.length,
    score: state.careerScore ?? 0,
    earnedM: Number((state.finances.careerEarnings / 1e6).toFixed(1)),
    peakBalanceM: Number((peakBalance / 1e6).toFixed(1)),
    peakValueM: Number((state.seasonHistory.reduce((m, r) => Math.max(m, r.valueEnd), 0) / 1e6).toFixed(1)),
    playedPct: Number((played / Math.max(1, played + missedInjury)).toFixed(2)),
  });
}

const line = (title: string) => console.log(`\n== ${title} ==`);
const missing = (label: string, all: string[], seen: Map<string, number>) => {
  const never = all.filter((id) => !seen.has(id));
  console.log(`${label}: ${all.length - never.length}/${all.length} seen`);
  if (never.length > 0) console.log(`  NEVER: ${never.join(', ')}`);
};

line('careers');
for (const c of careers) console.log('  ' + JSON.stringify(c));

line('content coverage');
missing('events', pack.events.map((e) => e.id), events);
missing('milestones', MILESTONES.map((m) => m.id), milestones);
missing('mentor prompts', MENTOR_PROMPTS.map((p) => p.id), prompts);
missing('actions offered', PLAYER_ACTIONS.map((a) => a.id), actionsOffered);
missing('life items bought', LIFE_ITEMS.map((i) => i.id), lifeBought);

line('systems seen');
const dump = (label: string, map: Map<string, number>) => {
  const rows = [...map.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`${label} (${rows.length}): ${rows.map(([k, v]) => `${k}=${v}`).join(' ')}`);
};
dump('consequences', consequences);
dump('squad roles (weeks)', squadRoles);
dump('offer kinds', offerKinds);
dump('trophies', trophyKinds);
dump('awards', awards);
dump('injury incidents', injuryIncidents);
dump('not played', notPlayedReasons);
dump('match importance', importances);
dump('competitions', competitionsPlayed);
dump('mentor topics', mentorTopicsAsked);
dump('mentor situations', mentorSituations);
dump('half-time instructions', halfTimeInstructions);
dump('sponsors', sponsorKinds);
dump('end states', endStates);
dump('achievements', achievements);
dump('contract renewals answered', renewals);
console.log(`manager spells across all careers: ${managerSpells.size}`);
console.log(`own goals: ${ownGoals.length}`);

line('match realism');
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
matchRatings.sort((a, b) => a - b);
console.log(`  ratings n=${matchRatings.length} mean=${avg(matchRatings).toFixed(2)} p10=${matchRatings[Math.floor(matchRatings.length * 0.1)]} med=${matchRatings[Math.floor(matchRatings.length * 0.5)]} p90=${matchRatings[Math.floor(matchRatings.length * 0.9)]}`);
console.log(`  goals per match (both sides) mean=${avg(bothGoals).toFixed(2)}`);
console.log(`  season minutes mean=${Math.round(avg(seasonMinutes))}`);

line('copy coverage');
const allKeys = new Map<string, number>();
for (const [k, v] of [...inboxKeys, ...newsKeys, ...narrativeKeys, ...optionKeys]) {
  allKeys.set(k, (allKeys.get(k) ?? 0) + v);
}
const missHe = [...allKeys.keys()].filter((k) => he[k] === undefined);
const missEn = [...allKeys.keys()].filter((k) => en[k] === undefined);
const group = (keys: string[]) => {
  const by = new Map<string, number>();
  for (const k of keys) {
    const prefix = k.startsWith('event.') ? 'event.*.<option>.outcome' : k.split('.').slice(0, 2).join('.');
    by.set(prefix, (by.get(prefix) ?? 0) + 1);
  }
  return [...by.entries()].sort((a, b) => b[1] - a[1]);
};
console.log(`  keys produced ${allKeys.size}; missing he ${missHe.length}, en ${missEn.length}`);
console.log('  missing by prefix:');
for (const [prefix, n] of group(missEn)) console.log(`    ${prefix}: ${n}`);
const nonEvent = missEn.filter((k) => !k.startsWith('event.'));
console.log(`  non-event missing keys (${nonEvent.length}): ${nonEvent.join(', ')}`);
const heOnly = missHe.filter((k) => !missEn.includes(k));
console.log(`  present in English but missing in Hebrew (${heOnly.length}): ${heOnly.slice(0, 60).join(', ')}`);
