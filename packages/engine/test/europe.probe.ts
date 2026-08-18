/** Does Europe actually run: groups, knockouts, a winner, and qualification? */
import { advanceWeek } from '../src/career.js';
import { startedCareer } from './helpers.js';

const { state, index } = startedCareer({ seed: 12 });
for (let i = 0; i < 53; i++) advanceWeek(state, index);

for (const [tier, comp] of Object.entries(state.world.europe ?? {})) {
  console.log(tier, 'groups', comp.groups.length, 'stage', comp.stage, 'winner', comp.winner ?? '-');
}
console.log('history', JSON.stringify(state.world.history.europeanWinners ?? []).slice(0, 300));
console.log('next season entrants', Object.entries(state.world.europeNext ?? {}).map(([k, v]) => `${k}:${v.length}`).join(' '));
