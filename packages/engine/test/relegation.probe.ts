/** Who actually goes down, and does the table agree? */
import { advanceWeek } from '../src/career.js';
import { startedCareer } from './helpers.js';
import { sortedTable } from '../src/league.js';

const { state, index } = startedCareer({ seed: 55 });
for (let i = 0; i < 49; i++) advanceWeek(state, index);

const comp = state.world.competitions['es.1'];
if (comp) {
  const rows = sortedTable(comp);
  console.log('LA LIGA final table (top 4 / bottom 4)');
  rows.slice(0, 4).forEach((r, i) => console.log(` ${i + 1}. ${state.world.clubs[r.clubId]?.name} ${r.points}pts str ${state.world.clubs[r.clubId]?.strength}`));
  rows.slice(-4).forEach((r, i) => console.log(` ${rows.length - 3 + i}. ${state.world.clubs[r.clubId]?.name} ${r.points}pts str ${state.world.clubs[r.clubId]?.strength}`));
}
