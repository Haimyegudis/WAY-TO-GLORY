/** How often does the player actually get an event? */
import { Rng } from '../src/rng.js';
import { advanceWeek } from '../src/career.js';
import { resolveDecision } from '../src/events.js';
import { startedCareer, loadPack } from './helpers.js';

const pack = loadPack();
const { state, index } = startedCareer({ seed: 77 });
const rng = new Rng(5);
let weeks = 0, blocked = 0, fired = 0, kinds: Record<string, number> = {};
while (!state.retired && weeks < 520) {
  if (state.pendingDecisions.length > 0) blocked++;
  advanceWeek(state, index);
  weeks++;
  for (const d of [...state.pendingDecisions]) {
    kinds[d.kind] = (kinds[d.kind] ?? 0) + 1;
    if (d.kind === 'event' && d.options.length > 0) {
      resolveDecision(rng, state, d.id, d.options[0]!.id, pack.events);
      fired++;
    }
  }
}
console.log({ weeks, blockedWeeks: blocked, eventsAnswered: fired, seen: kinds, pendingNow: state.pendingDecisions.length });
