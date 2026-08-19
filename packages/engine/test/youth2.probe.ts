/** The whole youth path: matches, call-up, and what happens at eighteen. */
import { advanceWeek } from '../src/career.js';
import { startedCareer } from './helpers.js';

const { state, index } = startedCareer({ seed: 5 });
const notes: string[] = [];
let lastSeason = state.world.season;
let lastRole = state.player.squadRole;

for (let i = 0; i < 53 * 5; i++) {
  advanceWeek(state, index);
  if (state.player.squadRole !== lastRole) {
    notes.push(`s${state.world.season} w${state.world.week}: role ${lastRole} -> ${state.player.squadRole}`);
    lastRole = state.player.squadRole;
  }
  for (const m of state.inbox.slice(0, 1)) {
    if (['inbox.youthCallUp', 'inbox.promotedToFirstTeam', 'inbox.mustLeaveAcademy', 'inbox.noOffersAtEighteen'].includes(m.titleKey)
      && !notes.some((n) => n.includes(m.titleKey))) {
      notes.push(`s${m.season} w${m.week}: ${m.titleKey}`);
    }
  }
  if (state.world.season !== lastSeason) lastSeason = state.world.season;
}
console.log(notes.join('\n'));
console.log('---');
console.log(state.seasonHistory.map((r) => `${r.season}: age ${r.age}, ${r.apps} apps, ovr ${r.ovrEnd}`).join('\n'));
