/** Do clubs actually move between divisions at the end of a season? */
import { advanceWeek } from '../src/career.js';
import { startedCareer } from './helpers.js';

const { state, index } = startedCareer({ seed: 31 });
const before = new Map<string, string>();
for (const [id, club] of Object.entries(state.world.clubs)) before.set(id, club.competitionId);

for (let i = 0; i < 53 * 2; i++) advanceWeek(state, index);

let moved = 0;
const sample: string[] = [];
for (const [id, club] of Object.entries(state.world.clubs)) {
  const was = before.get(id);
  if (was && was !== club.competitionId) {
    moved++;
    if (sample.length < 10) sample.push(`${club.name}: ${was} -> ${club.competitionId}`);
  }
}
console.log(`season ${state.world.season}, clubs that changed division: ${moved}`);
console.log(sample.join('\n'));
const sizes: Record<string, number> = {};
for (const club of Object.values(state.world.clubs)) sizes[club.competitionId] = (sizes[club.competitionId] ?? 0) + 1;
console.log('league sizes:', JSON.stringify(sizes));
