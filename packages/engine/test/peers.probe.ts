/** Do the boys he came through with actually have careers? */
import { advanceWeek, peers, resumeHalfTime } from '../src/career.js';
import { loadPack, playWeek, startedCareer } from './helpers.js';
loadPack();
for (const seed of [11, 55, 96]) {
  const { state, index } = startedCareer({ seed });
  let weeks = 0;
  while (!state.retired && state.world.season - 2026 < 14 && weeks < 53 * 20) {
    weeks++;
    const r = advanceWeek(state, index);
    state.pendingDecisions = [];
    if (r.stopped === 'halfTime' && state.pendingHalfTime) resumeHalfTime(state, index, state.pendingHalfTime.options[0]!);
  }
  const table = peers(state);
  const mine = state.seasonHistory.reduce((a, r) => a + r.apps, 0);
  console.log(`\nseed ${seed}: he has ${mine} apps after ${state.seasonHistory.length} seasons. His year:`);
  for (const p of table) {
    console.log(`  ${p.name.padEnd(22)} ${String(p.age).padStart(2)} ${p.clubName.padEnd(24)} ovr ${String(p.ovr).padStart(2)}  ${String(p.apps).padStart(3)} apps ${String(p.goals).padStart(3)} goals ${p.trophies} trophies ${p.retired ? '(retired)' : ''} ${p.aheadOfYou ? '<< ahead of you' : ''}`);
  }
}
