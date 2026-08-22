/** Do the leagues he does not play in have anybody scoring in them? */
import { advanceWeek } from '../src/career.js';
import { estimatedScorers } from '../src/charts.js';
import { loadPack, startedCareer } from './helpers.js';
loadPack();

const { state, index } = startedCareer({ seed: 11 });
for (let i = 0; i < 45; i++) advanceWeek(state, index), (state.pendingDecisions = []);

for (const competitionId of ['es.1', 'en.1', 'it.1', 'il.1']) {
  const comp = state.world.competitions[competitionId];
  const played = (comp?.fixtures ?? []).filter((f) => f.played).length;
  console.log(`\n${competitionId}: ${played} fixtures played`);
  for (const row of estimatedScorers(state, index, competitionId, 8)) {
    console.log(`  ${String(row.goals).padStart(3)}  ${row.name.padEnd(24)} ${row.clubId}`);
  }
}
