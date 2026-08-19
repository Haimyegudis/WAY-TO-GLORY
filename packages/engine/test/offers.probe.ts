/** How often do clubs come in, and are they clubs that make sense? */
import { advanceWeek } from '../src/career.js';
import { startedCareer } from './helpers.js';
import { overall } from '../src/positions.js';

const { state, index } = startedCareer({ seed: 61 });
const seen: string[] = [];
let lastSeason = state.world.season;

for (let i = 0; i < 53 * 5; i++) {
  advanceWeek(state, index);
  if (state.transferOffers.length > 0 && state.pendingDecisions.some((d) => d.kind === 'transfer')) {
    const ovr = overall(state.player.attributes, state.player.primaryPos, state.player.secondaryPos);
    const club = state.player.clubId ? state.world.clubs[state.player.clubId] : null;
    const names = state.transferOffers.map((o) => {
      const c = state.world.clubs[o.clubId]!;
      return `${c.name}(${c.competitionId} str${c.strength})`;
    });
    seen.push(`s${state.world.season} w${state.world.week} ovr${ovr} at ${club?.name ?? '-'}(str${club?.strength ?? 0}): ${names.join(', ')}`);
    // Decline, so the next window can be measured too.
    state.transferOffers = [];
    state.pendingDecisions = state.pendingDecisions.filter((d) => d.kind !== 'transfer');
  }
  if (state.world.season !== lastSeason) lastSeason = state.world.season;
}
console.log(seen.slice(0, 14).join('\n'));
console.log('approaches in five seasons:', seen.length);
