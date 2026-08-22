/**
 * The order things happen in.
 *
 * A career is read as a sequence: the build-up before the fixture, the fixture, then the
 * reaction to it. Every one of those beats arriving in the wrong order breaks the story
 * more than a wrong number does - being asked what the derby means to him after the
 * derby, hearing that agents are interested after he has already picked one, being told
 * a club wants him after he has signed for them.
 *
 * This walks careers one interruption at a time - not one week at a time, because a week
 * stops several times and the order inside it is the whole question - and records what
 * arrived at each stop and whether the match had already been played when it did.
 *
 *   tsx test/chronology.probe.ts [seeds] [seasons]
 */
import {
  advanceWeek,
  answerAgent,
  answerContractRenewal,
  answerMedia,
  answerOffer,
  answerRetirement,
  answerSeasonGoal,
  resumeHalfTime,
} from '../src/career.js';
import { resolveDecision } from '../src/events.js';
import { Rng } from '../src/rng.js';
import { loadPack, startedCareer } from './helpers.js';
import type { CareerState, MatchResult } from '../src/types.js';

loadPack();
const seeds = Number(process.argv[2] ?? 6);
const seasons = Number(process.argv[3] ?? 8);

interface Beat {
  season: number;
  week: number;
  /** Ordinal of the interruption inside the week: 0 is the first time it stopped. */
  step: number;
  inbox: string[];
  decisions: string[];
  /** The user match that was played during this step, if one was. */
  match: MatchResult | null;
}

const problems = new Map<string, number>();
const note = (what: string, detail: string) => {
  const key = `${what}`;
  problems.set(key, (problems.get(key) ?? 0) + 1);
  if ((problems.get(key) ?? 0) <= 3) console.log(`  ${what}: ${detail}`);
};

const BUILD_UP = /^(inbox\.buildUp\.|news\.buildUp\.)/;
// A debut is the one occasion that can only be asked about afterwards: nobody knows it
// was his first appearance until he has made it.
const OCCASION = new Set(['derby', 'rivalMatch', 'bigMatch', 'againstOldClub']);
const REACTION = new Set(['hatTrick', 'sentOff', 'punditCriticism', 'badRun', 'goalDrought', 'injuryReturn']);
const POST_MATCH_EVENTS = new Set([
  'derby_goal_celebration', 'rival_goal_celebration', 'missed_sitter',
  'goal_celebration_controversy', 'own_goal',
]);

for (let s = 0; s < seeds; s++) {
  const seed = 11 + s * 37;
  const rng = new Rng(seed * 5 + 1);
  const { state, index } = startedCareer({ seed }, s % 5);
  const beats: Beat[] = [];
  let step = 0;
  let lastWeek = -1;
  let matches = 0;
  const seenInbox = new Set<string>();
  const seenMatches = new Set<string>();

  const capture = (result: ReturnType<typeof advanceWeek>) => {
    const week = state.world.season * 52 + state.world.week;
    step = week === lastWeek ? step + 1 : 0;
    lastWeek = week;

    const fresh: string[] = [];
    for (const message of state.inbox) {
      const key = `${message.id}`;
      if (seenInbox.has(key)) continue;
      seenInbox.add(key);
      fresh.push(message.titleKey);
    }
    let played: MatchResult | null = null;
    for (const match of state.matchLog) {
      if (seenMatches.has(match.id)) continue;
      seenMatches.add(match.id);
      if (match.userLine?.played && !match.competitionId.startsWith('friendly')) {
        played = match;
        matches++;
      }
    }
    beats.push({
      season: state.world.season,
      week: state.world.week,
      step,
      inbox: fresh.reverse(),
      decisions: state.pendingDecisions.map((decision) => decision.eventId),
      match: played,
    });
    void result;
  };

  const answerEverything = () => {
    for (const decision of [...state.pendingDecisions]) {
      if (decision.kind === 'transfer') {
        const offers = state.transferOffers ?? [];
        const take = rng.chance(0.4) && offers.length > 0 ? offers[rng.int(0, offers.length - 1)]!.id : null;
        answerOffer(state, index, decision.id, take);
      } else if (decision.kind === 'agent') {
        answerAgent(state, decision.id, decision.agents?.[0]?.id ?? null);
      } else if (decision.eventId === 'seasonGoal') {
        answerSeasonGoal(state, index, decision.id, 'agreed');
      } else if (decision.eventId === 'contractRenewal') {
        answerContractRenewal(state, index, decision.id, 'sign');
      } else if (decision.eventId === 'retirement_choice') {
        answerRetirement(state, decision.id, 'continue');
      } else if (decision.eventId.startsWith('milestone:')) {
        answerMedia(state, index, decision.id, decision.options[0]!.id);
      } else if (decision.options.length > 0) {
        resolveDecision(rng, state, decision.id, decision.options[0]!.id, index.pack.events);
      }
      state.pendingDecisions = state.pendingDecisions.filter((d) => d.id !== decision.id);
    }
  };

  let guard = 0;
  while (!state.retired && state.world.season - 2026 < seasons && guard < 53 * seasons * 3) {
    guard++;
    const result = advanceWeek(state, index);
    capture(result);
    if (result.stopped === 'halfTime' && state.pendingHalfTime) {
      const held = state.pendingHalfTime;
      resumeHalfTime(state, index, held.demand ?? held.options[0]!);
      capture(result);
    }
    answerEverything();
  }

  /* ------------------------------------------------------------------ rules */

  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i]!;

    // 1. Build-up copy belongs to a week in which the match has not been played yet.
    for (const key of beat.inbox) {
      if (!BUILD_UP.test(key)) continue;
      if (beat.match) {
        note('build-up arrived in the same breath as the result', `${key} ${beat.season}w${beat.week}`);
      }
    }

    // 2. The occasion question is asked before kick-off, not after it.
    for (const eventId of beat.decisions) {
      const id = eventId.replace('milestone:', '');
      if (!eventId.startsWith('milestone:') || !OCCASION.has(id)) continue;
      if (beat.match) {
        note('occasion question raised after the match had been played', `${id} ${beat.season}w${beat.week}`);
      }
    }

    // 3. A reaction has to have something to react to: a match already played, this week
    //    or before it.
    for (const eventId of beat.decisions) {
      const id = eventId.replace('milestone:', '');
      if (!eventId.startsWith('milestone:') || !REACTION.has(id)) continue;
      const playedBefore = beats.slice(0, i + 1).some((earlier) => earlier.match);
      if (!playedBefore) note('reaction to a match he has not played yet', `${id} ${beat.season}w${beat.week}`);
    }
    for (const eventId of beat.decisions) {
      if (!POST_MATCH_EVENTS.has(eventId)) continue;
      const playedBefore = beats.slice(0, i + 1).some((earlier) => earlier.match);
      if (!playedBefore) note('post-match story before any match', `${eventId} ${beat.season}w${beat.week}`);
    }

    // 4. Nobody is told about agents after he has been shown them.
    const agentDecision = beat.decisions.includes('agentApproach');
    if (agentDecision) {
      const told = beats.slice(0, i + 1).some((earlier) => earlier.inbox.includes('inbox.agentInterest'));
      if (!told) note('agent shortlist shown before he was told agents were interested', `${beat.season}w${beat.week}`);
    }

    // 5. And nobody is told a club wants him after he has already signed for them.
    const signedHere = beat.inbox.includes('inbox.welcomeAcademy') || beat.inbox.includes('news.joinedClub');
    if (signedHere) {
      const laterInterest = beats.slice(i + 1, i + 3).some((later) => later.inbox.includes('inbox.transferInterest'));
      if (laterInterest) note('interest announced after the signature', `${beat.season}w${beat.week}`);
    }

    // 6. A new manager is announced after the old one is sacked, not before.
    const arrived = beat.inbox.findIndex((key) => key.startsWith('inbox.manager.arrived'));
    const sacked = beat.inbox.indexOf('inbox.manager.sacked');
    if (arrived !== -1 && sacked !== -1 && arrived < sacked) {
      note('the new manager arrived before the old one was sacked', `${beat.season}w${beat.week}`);
    }
    if (arrived !== -1 && sacked === -1) {
      const sackedEarlier = beats.slice(Math.max(0, i - 6), i).some((earlier) => earlier.inbox.includes('inbox.manager.sacked'));
      if (!sackedEarlier) {
        note('a manager arrived with nobody having left', `${beat.season}w${beat.week} inbox=[${beat.inbox.join('|')}]`);
      }
    }

    // 7. The contract is offered before it is signed.
    if (beat.inbox.includes('inbox.contractExtended')) {
      const offered = beats.slice(0, i + 1).some((earlier) => earlier.inbox.includes('inbox.contractOffered'));
      if (!offered) note('a contract extension announced that was never offered', `${beat.season}w${beat.week}`);
    }
  }

  console.log(`seed ${seed}: ${beats.length} interruptions, ${matches} competitive matches, ${state.seasonHistory.length} seasons`);
}

console.log('');
if (problems.size === 0) console.log('chronology clean');
else for (const [what, count] of [...problems].sort((a, b) => b[1] - a[1])) console.log(`${count} x ${what}`);
