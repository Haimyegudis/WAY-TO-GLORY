/** How often is he actually stopped and asked something? */
import { advanceWeek } from '../src/career.js';
import { startedCareer, loadPack } from './helpers.js';
import { resolveDecision } from '../src/events.js';
import { Rng } from '../src/rng.js';

const pack = loadPack();
for (const seed of [41, 7, 19]) {
  const { state, index } = startedCareer({ seed });
  const rng = new Rng(seed);
  let stops = 0, colour = 0, ignored = 0;
  const seen = new Set<string>();
  const byKind: Record<string, number> = {};
  const perSeason: string[] = [];
  let lastSeason = state.world.season;

  for (let i = 0; i < 53 * 8; i++) {
    const tick = advanceWeek(state, index);
    for (const d of state.pendingDecisions) {
      if (!d.blocking || seen.has(d.id)) continue;
      seen.add(d.id);
      stops++;
      byKind[d.kind] = (byKind[d.kind] ?? 0) + 1;
    }
    for (const d of [...state.pendingDecisions]) {
      if (d.kind !== 'event' || d.options.length === 0) continue;
      // He answers what stops him, and about half of what only sits in the mailbox.
      if (!d.blocking && !rng.chance(0.5)) { ignored++; continue; }
      if (!d.blocking) colour++;
      resolveDecision(rng, state, d.id, d.options[rng.int(0, d.options.length - 1)]!.id, pack.events);
    }
    if (state.world.season !== lastSeason) {
      perSeason.push(`${stops}/${colour}`);
      stops = 0; colour = 0;
      lastSeason = state.world.season;
    }
  }
  console.log(`seed ${seed}  stopped/read per season:`, perSeason.join('  '), JSON.stringify(byKind));
}
