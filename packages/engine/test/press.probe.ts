/** How often does a microphone appear, and what does answering cost? */
import { advanceWeek, answerMedia } from '../src/career.js';
import { startedCareer } from './helpers.js';
import { Rng } from '../src/rng.js';
import { resolveDecision } from '../src/events.js';
import { loadPack } from './helpers.js';

const pack = loadPack();
for (const seed of [4, 11]) {
  const { state, index } = startedCareer({ seed });
  const rng = new Rng(seed);
  const seen: Record<string, number> = {};
  let backed = 0, failed = 0, seasons = 0;
  const inboxSeen = new Set<string>();

  for (let i = 0; i < 53 * 10; i++) {
    if (state.world.week === 1) seasons++;
    advanceWeek(state, index);
    for (const d of [...state.pendingDecisions]) {
      if (d.eventId.startsWith('milestone:')) {
        const kind = d.eventId.replace('milestone:', '');
        seen[kind] = (seen[kind] ?? 0) + 1;
        answerMedia(state, index, d.id, d.options[rng.int(0, d.options.length - 1)]!.id);
        continue;
      }
      if (d.kind === 'event' && d.options.length > 0) {
        resolveDecision(rng, state, d.id, d.options[0]!.id, pack.events);
      }
    }
    for (const m of state.inbox) {
      if (inboxSeen.has(m.id)) continue;
      inboxSeen.add(m.id);
      if (m.titleKey === 'inbox.claimBackedUp') backed++;
      if (m.titleKey === 'inbox.claimFailed') failed++;
    }
  }
  console.log(`seed ${seed} over ${seasons} seasons:`, JSON.stringify(seen), ` claims kept ${backed}, missed ${failed}`);
}
