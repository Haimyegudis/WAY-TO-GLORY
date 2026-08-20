/**
 * The questions he is not allowed to walk past.
 *
 * Four moments were asked for by name: the build-up to a derby or a big night, a rumour
 * about a move, a red card, and a bad run. This walks careers and checks three things
 * about each of them - that it is actually raised, that it stops the week rather than
 * sitting in the mailbox, and, for the build-up, that it is put to him before the match
 * is played rather than after it.
 *
 *   tsx test/press.probe.ts [seed] [seeds]
 */
import { advanceWeek, answerMedia, answerOffer, answerSeasonGoal, resumeHalfTime } from '../src/career.js';
import { resolveDecision } from '../src/events.js';
import { Rng } from '../src/rng.js';
import type { CareerState } from '../src/types.js';
import { loadPack, startedCareer } from './helpers.js';

loadPack();

const firstSeed = Number(process.argv[2] ?? 11);
const seedCount = Number(process.argv[3] ?? 6);

const raised = new Map<string, number>();
const bump = (id: string) => raised.set(id, (raised.get(id) ?? 0) + 1);

let redCards = 0;
let redCardsAsked = 0;
let buildUps = 0;
let buildUpsBeforeTheMatch = 0;
let notBlocking = 0;

for (let seed = firstSeed; seed < firstSeed + seedCount; seed++) {
  const { state, index } = startedCareer({ seed });
  const rng = new Rng(seed * 977 + 5);
  let redsSeen = 0;

  for (let i = 0; i < 53 * 12 && !state.retired; i++) {
    const before = state.matchLog.length;
    const result = advanceWeek(state, index);

    if (result.stopped === 'halfTime' && state.pendingHalfTime) {
      const held = state.pendingHalfTime;
      resumeHalfTime(state, index, held.demand ?? held.options[0]!);
    }

    // A build-up question is only a build-up if no match was played on the way to it.
    const playedOnTheWay = state.matchLog.length > before;

    for (const decision of [...state.pendingDecisions]) {
      if (decision.eventId.startsWith('milestone:')) {
        const id = decision.eventId.replace('milestone:', '');
        bump(id);
        if (decision.blocking === false) notBlocking++;
        if (id === 'derby' || id === 'bigMatch') {
          buildUps++;
          if (!playedOnTheWay) buildUpsBeforeTheMatch++;
        }
      }

      if (decision.kind === 'transfer') {
        answerOffer(state, index, decision.id, null);
        state.pendingDecisions = state.pendingDecisions.filter((d) => d.id !== decision.id);
        continue;
      }
      if (decision.kind === 'agent') {
        state.pendingDecisions = state.pendingDecisions.filter((d) => d.id !== decision.id);
        continue;
      }
      const option = decision.options[rng.int(0, decision.options.length - 1)];
      if (!option) continue;
      if (decision.eventId === 'seasonGoal') {
        answerSeasonGoal(state, index, decision.id, option.id);
        continue;
      }
      if (decision.eventId.startsWith('milestone:')) {
        answerMedia(state, index, decision.id, option.id);
      } else if (decision.eventId.startsWith('mentorPrompt_') || decision.id.startsWith('mentorPrompt_')) {
        state.pendingDecisions = state.pendingDecisions.filter((d) => d.id !== decision.id);
      } else {
        resolveDecision(rng, state, decision.id, option.id, index.pack.events);
      }
      state.pendingDecisions = state.pendingDecisions.filter((d) => d.id !== decision.id);
    }

    // Every red card he is shown should end up as a microphone in his face.
    const reds = countReds(state);
    if (reds > redsSeen) {
      redCards += reds - redsSeen;
      redsSeen = reds;
    }
  }
  redCardsAsked = raised.get('sentOff') ?? 0;
}

function countReds(state: CareerState): number {
  return state.matchLog.reduce((total, match) => total + (match.userLine?.red ?? 0), 0);
}

console.log(`careers: ${seedCount}`);
console.log(`questions raised, by kind:`);
for (const [id, count] of [...raised.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${id.padEnd(20)} ${count}`);
}
console.log(`\nred cards shown: ${redCards}, sentOff questions: ${redCardsAsked}`);
console.log(`build-up questions: ${buildUps}, of them before the match: ${buildUpsBeforeTheMatch}`);
console.log(`questions that did not stop the week: ${notBlocking}`);
