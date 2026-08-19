/** Trace the summer. */
import { advanceWeek } from '../src/career.js';
import { startedCareer } from './helpers.js';

const { state, index } = startedCareer({ seed: 3 });
const ucl = () => state.world.europe?.ucl;
console.log('at creation:', ucl() ? {
  seeded: ucl()!.seeded?.length, alive: ucl()!.qualifying?.alive.length,
  ties: ucl()!.qualifying?.ties.length, stage: ucl()!.stage,
} : 'no competition');

for (let week = 1; week <= 6; week++) {
  advanceWeek(state, index);
  const c = ucl();
  console.log(`after week ${week}:`, c ? {
    stage: c.stage,
    round: c.qualifying?.round,
    ties: c.qualifying?.ties.length,
    played: c.qualifying?.ties.filter((t) => t.played).length,
    alive: c.qualifying?.alive.length,
    groups: c.groups.length,
  } : 'none');
}
