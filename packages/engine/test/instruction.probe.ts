/**
 * Does what he is told at half time change the second half?
 *
 * Controlled: at every interval the state is snapshotted and the same match is played
 * out six times, once per instruction, from the same seed. The first half is identical
 * by construction, so every difference below belongs to the forty-five minutes after it.
 */
import { advanceWeek, resumeHalfTime } from '../src/career.js';
import { HALF_TIME_INSTRUCTIONS_ORDER } from '../src/halftime.js';
import type { CareerState } from '../src/types.js';
import { loadPack, startedCareer } from './helpers.js';

loadPack();
const seed = Number(process.argv[2] ?? 4242);
const wanted = Number(process.argv[3] ?? 120);
const { state, index } = startedCareer({ seed });

const totals = new Map<string, { n: number; shots: number; goals: number; assists: number; tackles: number; keyPasses: number; rating: number; yellow: number; minutes: number; fatigue: number }>();
for (const id of HALF_TIME_INSTRUCTIONS_ORDER) {
  totals.set(id, { n: 0, shots: 0, goals: 0, assists: 0, tackles: 0, keyPasses: 0, rating: 0, yellow: 0, minutes: 0, fatigue: 0 });
}

let intervals = 0;
for (let i = 0; i < 52 * 12 && intervals < wanted && !state.retired; i++) {
  const result = advanceWeek(state, index);
  state.pendingDecisions = [];
  if (result.stopped !== 'halfTime' || !state.pendingHalfTime) continue;

  const snapshot = structuredClone(state) as CareerState;
  const held = state.pendingHalfTime;
  intervals++;

  for (const id of HALF_TIME_INSTRUCTIONS_ORDER) {
    const copy = structuredClone(snapshot) as CareerState;
    resumeHalfTime(copy, index, id);
    const line = copy.matchLog.find((m) => m.id === held.matchId)?.userLine;
    if (!line?.played) continue;
    const acc = totals.get(id)!;
    acc.n++;
    acc.shots += line.shots;
    acc.goals += line.goals;
    acc.assists += line.assists;
    acc.tackles += line.tackles;
    acc.keyPasses += line.keyPasses;
    acc.rating += line.rating;
    acc.yellow += line.yellow;
    acc.minutes += line.minutes;
    acc.fatigue += copy.player.condition.fatigue;
  }

  // The career itself carries on under whatever he was told to do.
  resumeHalfTime(state, index, held.demand ?? held.options[0]!);
}

console.log(`${intervals} intervals, each played out six ways from the same seed\n`);
console.log('instruction        n   shots  goals  assists  keyP   tackles  rating  yellow  fatigue');
for (const id of HALF_TIME_INSTRUCTIONS_ORDER) {
  const a = totals.get(id)!;
  if (a.n === 0) continue;
  const per = (v: number) => (v / a.n).toFixed(2).padStart(6);
  console.log(
    id.padEnd(17),
    String(a.n).padStart(3),
    per(a.shots), per(a.goals), per(a.assists), per(a.keyPasses), per(a.tackles),
    (a.rating / a.n).toFixed(2).padStart(6),
    per(a.yellow),
    (a.fatigue / a.n).toFixed(1).padStart(6),
  );
}
