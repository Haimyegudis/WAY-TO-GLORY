/** How often he is booked, sent off or hurt - measured, over a career. */
import { advanceWeek, resumeHalfTime } from '../src/career.js';
import { loadPack, startedCareer } from './helpers.js';

loadPack();
let played = 0, yellow = 0, red = 0, injuriesInMatch = 0, injuriesAll = 0, suspensions = 0;
for (const seed of [7, 108, 209, 310]) {
  const { state, index } = startedCareer({ seed });
  let injuriesBefore = 0;
  for (let i = 0; i < 52 * 12 && !state.retired; i++) {
    const result = advanceWeek(state, index);
    state.pendingDecisions = [];
    if (result.stopped === 'halfTime' && state.pendingHalfTime) {
      const held = state.pendingHalfTime;
      resumeHalfTime(state, index, held.demand ?? held.options[0]!);
    }
    const now = state.player.condition.injuryHistory.length;
    if (now > injuriesBefore) injuriesAll += now - injuriesBefore;
    injuriesBefore = now;
  }
  for (const match of state.matchLog) {
    const line = match.userLine;
    if (!line?.played) continue;
    played++;
    yellow += line.yellow;
    red += line.red;
    if (match.events?.some((e) => e.type === 'injury' && e.byUser)) injuriesInMatch++;
  }
  suspensions += state.player.condition.suspensions.length;
}
console.log(`matches played (last 140 logged per career): ${played}`);
console.log(`yellows: ${yellow} (${(yellow / played).toFixed(3)} per match)`);
console.log(`reds: ${red} (${(red / played).toFixed(4)} per match)`);
console.log(`matches with an injury to him: ${injuriesInMatch} (${(injuriesInMatch / played * 100).toFixed(1)}%)`);
console.log(`injuries picked up in total across four careers: ${injuriesAll}`);
