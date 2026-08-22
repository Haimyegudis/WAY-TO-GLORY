/** Do the boys he came through with have a season, or two appearances a year? */
import { advanceWeek, peers } from '../src/career.js';
import { loadPack, startedCareer } from './helpers.js';
loadPack();

for (const seed of [11, 55]) {
  const { state, index } = startedCareer({ seed });
  for (let i = 0; i < 45; i++) { advanceWeek(state, index); state.pendingDecisions = []; }
  const mine = state.world.seasonStats[state.player.id];
  console.log(`\nseed ${seed} — ${state.world.season} week ${state.world.week}; he has ${mine?.apps ?? 0} apps, ${mine?.goals ?? 0} goals`);
  for (const peer of peers(state)) {
    console.log(`  ${String(peer.age).padStart(2)} ${peer.name.padEnd(22)} ${peer.clubName.padEnd(22)} ${String(peer.apps).padStart(3)} apps ${String(peer.goals).padStart(2)} goals`);
  }
  for (let i = 0; i < 60; i++) { advanceWeek(state, index); state.pendingDecisions = []; }
  console.log(`  --- a season later (${state.world.season} week ${state.world.week}) ---`);
  for (const peer of peers(state)) {
    console.log(`  ${String(peer.age).padStart(2)} ${peer.name.padEnd(22)} ${peer.clubName.padEnd(22)} ${String(peer.apps).padStart(3)} apps ${String(peer.goals).padStart(2)} goals`);
  }
}
