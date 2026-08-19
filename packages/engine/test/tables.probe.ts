/** Do the big clubs still win their leagues after a decade? */
import { advanceWeek } from '../src/career.js';
import { startedCareer } from './helpers.js';
import { sortedTable } from '../src/league.js';

const { state, index } = startedCareer({ seed: 55 });
const watch = ['es.1', 'en.1', 'ger.1', 'de.1', 'it.1'];
for (let season = 0; season < 10; season++) {
  for (let i = 0; i < 53; i++) advanceWeek(state, index);
}
for (const record of state.world.history.champions.filter((c) => watch.includes(c.competitionId))) {
  console.log(record.season, record.competitionId, state.world.clubs[record.clubId]?.name);
}
console.log('--- strengths now');
for (const id of ['esp_fc_barcelona', 'esp_real_madrid_cf', 'eng_liverpool_fc', 'eng_manchester_city_fc', 'ita_juventus_fc']) {
  const club = state.world.clubs[id];
  if (club) console.log(club.name, club.competitionId, 'strength', club.strength, 'rep', club.reputation);
}
