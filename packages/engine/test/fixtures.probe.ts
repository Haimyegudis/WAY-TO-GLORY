/** Why do the leagues stop playing after a few seasons? */
import { advanceWeek } from '../src/career.js';
import { startedCareer } from './helpers.js';

const { state, index } = startedCareer({ seed: 55 });
for (let season = 0; season < 6; season++) {
  while (state.world.week < 49) advanceWeek(state, index);
  const comp = state.world.competitions['es.1'];
  if (!comp) { console.log(`${state.world.season}: no competition state`); }
  else {
    const played = comp.fixtures.filter((f) => f.played).length;
    const weeks = [...new Set(comp.fixtures.map((f) => f.week))].sort((a, b) => a - b);
    console.log(`${state.world.season}: fixtures ${comp.fixtures.length}, played ${played}, weeks ${weeks[0]}..${weeks.at(-1)}, clubs ${comp.clubIds.length}`);
  }
  while (state.world.week >= 49 || state.world.week <= 2) advanceWeek(state, index);
}
