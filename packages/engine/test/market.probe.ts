/** Does the world move? Twenty seasons of windows, and what they do to a league. */
import { advanceWeek } from '../src/career.js';
import { startedCareer } from './helpers.js';

const { state, index } = startedCareer({ seed: 5 });
const league = 'en.1';
const snapshot = () =>
  Object.values(state.world.clubs)
    .filter((c) => c.competitionId === league)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 6)
    .map((c) => `${c.shortName} ${c.strength}`);

console.log('season 0 :', snapshot().join(' | '));
let signings = 0, departures = 0;
const seen = new Set(state.inbox.map((m) => m.id));

for (let i = 0; i < 53 * 20; i++) {
  advanceWeek(state, index);
  for (const m of state.inbox) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    if (m.titleKey === 'inbox.clubSigned' || m.titleKey === 'inbox.rivalSigned') signings++;
    if (m.titleKey === 'inbox.teammateLeft') departures++;
  }
  if (state.world.week === 1 && state.world.season % 5 === 0) {
    console.log(`season ${state.world.season}:`, snapshot().join(' | '));
  }
}
console.log('signings at his club:', signings, ' departures:', departures);
