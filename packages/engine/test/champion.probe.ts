/** Does the recorded champion match the club that actually topped the table? */
import { advanceWeek } from '../src/career.js';
import { startedCareer } from './helpers.js';
import { sortedTable } from '../src/league.js';

const { state, index } = startedCareer({ seed: 55 });
for (let i = 0; i < 49; i++) advanceWeek(state, index);
const before = sortedTable(state.world.competitions['es.1']!)[0]!;
console.log('leader at week 49:', state.world.clubs[before.clubId]?.name, before.points);

for (let i = 0; i < 6; i++) advanceWeek(state, index);
const champion = state.world.history.champions.find((c) => c.competitionId === 'es.1');
console.log('recorded champion:', champion && state.world.clubs[champion.clubId]?.name);
const promoted = Object.values(state.world.clubs).filter((c) => c.competitionId === 'es.1').length;
console.log('la liga size now:', promoted);
