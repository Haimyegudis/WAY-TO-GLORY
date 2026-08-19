/** Are later seasons actually being played? */
import { advanceWeek } from '../src/career.js';
import { startedCareer } from './helpers.js';
import { sortedTable } from '../src/league.js';

const { state, index } = startedCareer({ seed: 55 });
for (let season = 0; season < 4; season++) {
  while (state.world.week < 49) advanceWeek(state, index);
  const comp = state.world.competitions['es.1']!;
  const rows = sortedTable(comp);
  const played = rows.reduce((s, r) => s + r.played, 0);
  console.log(
    `season ${state.world.season}: matches played ${played}, leader ${state.world.clubs[rows[0]!.clubId]?.name} ${rows[0]!.points}pts,`,
    `size ${rows.length}`,
  );
  while (state.world.week >= 49 || state.world.week === 1) {
    advanceWeek(state, index);
    if (state.world.week > 2 && state.world.week < 49) break;
  }
}
