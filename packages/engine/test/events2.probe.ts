/** How often does the player actually get asked to decide something? */
import { advanceWeek } from '../src/career.js';
import { startedCareer, loadPack } from './helpers.js';
import { resolveDecision } from '../src/events.js';
import { Rng } from '../src/rng.js';

const pack = loadPack();
const { state, index } = startedCareer({ seed: 41 });
const rng = new Rng(2);
let seasons = 0, decisionsThisSeason = 0;
const perSeason: number[] = [];
let lastSeason = state.world.season;

for (let i = 0; i < 53 * 6; i++) {
  advanceWeek(state, index);
  for (const d of [...state.pendingDecisions]) {
    if (d.kind !== 'event' || d.options.length === 0) continue;
    resolveDecision(rng, state, d.id, d.options[0]!.id, pack.events);
    decisionsThisSeason++;
  }
  if (state.world.season !== lastSeason) {
    perSeason.push(decisionsThisSeason);
    decisionsThisSeason = 0;
    lastSeason = state.world.season;
    seasons++;
  }
}
console.log('event decisions per season:', perSeason.join(', '));
console.log('pack events:', pack.events.length);
