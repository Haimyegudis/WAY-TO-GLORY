/** Follow one big club season by season. */
import { advanceWeek } from '../src/career.js';
import { startedCareer } from './helpers.js';
import { sortedTable } from '../src/league.js';

const { state, index } = startedCareer({ seed: 55 });
const watch = 'esp_fc_barcelona';
for (let season = 0; season < 12; season++) {
  while (state.world.week < 49) advanceWeek(state, index);
  const club = state.world.clubs[watch]!;
  const comp = state.world.competitions[club.competitionId];
  const rows = comp ? sortedTable(comp) : [];
  const pos = rows.findIndex((r) => r.clubId === watch) + 1;
  const row = rows[pos - 1];
  console.log(
    `${state.world.season}: ${club.competitionId} pos ${pos}/${rows.length} pts ${row?.points ?? '-'} str ${club.strength} rep ${club.reputation}`,
  );
  while (state.world.week >= 49 || state.world.week <= 2) advanceWeek(state, index);
}
