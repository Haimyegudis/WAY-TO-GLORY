/** Prints one user match as the live view will play it back. */
import { Rng } from '../src/rng.js';
import { advanceWeek } from '../src/career.js';
import { startedCareer } from './helpers.js';

const { state, index } = startedCareer({ seed: 4242 });
for (let i = 0; i < 200; i++) {
  advanceWeek(state, index);
  const match = state.lastMatch;
  if (match?.userLine?.played && (match.events ?? []).length > 0) {
    const line = match.userLine;
    console.log(`${match.homeClubId} ${match.homeGoals}-${match.awayGoals} ${match.awayClubId}`);
    console.log(`minutes ${line.minutes}, on ${line.cameOnMinute ?? 'start'}, off ${line.offMinute ?? 'full'}, rating ${line.rating}`);
    for (const e of match.events!) {
      console.log(`  ${String(e.minute).padStart(2)}' ${e.type.padEnd(10)} ${e.ambient ? 'amb ' : '    '}${e.detailKey ?? ''}`);
    }
    break;
  }
}
void Rng;
