/** How often does he make the division's eleven, and does the eleven make sense? */
import { advanceWeek, resumeHalfTime } from '../src/career.js';
import { buildTeamOfTheWeek } from '../src/totw.js';
import { userYouthCompetitionId } from '../src/youth.js';
import { loadPack, startedCareer } from './helpers.js';
loadPack();

for (const seed of [11, 55, 96]) {
  const { state, index } = startedCareer({ seed });
  let weeks = 0;
  let shown: ReturnType<typeof buildTeamOfTheWeek> = null;
  while (!state.retired && state.world.season - 2026 < 8 && weeks < 53 * 9) {
    weeks++;
    const r = advanceWeek(state, index);
    state.pendingDecisions = [];
    if (r.stopped === 'halfTime' && state.pendingHalfTime) resumeHalfTime(state, index, state.pendingHalfTime.options[0]!);
    if (!shown && state.world.season >= 2028 && state.world.week === 30) {
      const clubId = state.player.clubId;
      const youthId = userYouthCompetitionId(state);
      const compId = youthId ?? (clubId ? state.world.clubs[clubId]?.competitionId : undefined);
      if (compId) {
        for (let back = 0; back < 4 && !shown; back++) {
          shown = buildTeamOfTheWeek(state, compId, state.world.week - back, Boolean(youthId));
        }
      }
    }
  }
  const apps = state.seasonHistory.reduce((a, r) => a + r.apps, 0);
  const totw = Number(state.flags['totwCount'] ?? 0);
  const rated = state.seasonHistory.reduce((a, r) => a + r.ratingSum, 0) / Math.max(1, apps);
  console.log(`seed ${seed}: ${apps} apps, avg ${rated.toFixed(2)}, in the eleven ${totw} times (${(100 * totw / Math.max(1, apps)).toFixed(1)}% of his games)`);
  if (shown) {
    console.log(`  ${shown.youth ? 'youth' : 'senior'} ${shown.competitionId}, week ${shown.week}`);
    for (const entry of shown.entries) {
      console.log(`  ${entry.slot.padEnd(4)} ${entry.name.padEnd(24)} ${entry.rating.toFixed(1)} ${entry.goals ? '*'.repeat(entry.goals) : ''}${entry.isUser ? '  << him' : ''}`);
    }
  }
}
