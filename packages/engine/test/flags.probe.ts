/** Do the choices bite? Answer everything at random for a long career and count what changed. */
import { advanceWeek, retire } from '../src/career.js';
import { startedCareer, loadPack } from './helpers.js';
import { resolveDecision } from '../src/events.js';
import { answerAgent, answerOffer } from '../src/career.js';
import { Rng } from '../src/rng.js';

const pack = loadPack();
const counts: Record<string, number> = {};
const bump = (k: string, n = 1) => { counts[k] = (counts[k] ?? 0) + n; };

for (let seed = 1; seed <= 6; seed++) {
  const { state, index } = startedCareer({ seed });
  const rng = new Rng(seed * 7);
  for (let i = 0; i < 53 * 22 && !state.retired; i++) {
    advanceWeek(state, index);
    for (const d of [...state.pendingDecisions]) {
      if (d.kind === 'agent') { answerAgent(state, d.id, d.agents?.[0]?.id ?? null); bump('agentSignings'); continue; }
      if (d.kind !== 'event' || d.options.length === 0) continue;
      const opt = d.options[rng.int(0, d.options.length - 1)]!;
      resolveDecision(rng, state, d.id, opt.id, pack.events);
      bump('decisions');
    }
    for (const m of state.inbox) {
      if (m.titleKey === 'inbox.injuryAggravated' && !m.read) bump('aggravations');
      if (m.titleKey.startsWith('inbox.investment') && !m.read) bump('investments');
      if (m.titleKey.startsWith('inbox.sponsor') && !m.read) bump('sponsors');
      m.read = true;
    }
    if (state.flags['penaltyTaker']) bump('weeksAsPenaltyTaker');
    if (state.flags['reducedLoad']) bump('weeksLightTraining');
  }
  bump('agentFees', Number(state.flags['agentFeesPaid'] ?? 0));
  bump('careers');
}
for (const [k, v] of Object.entries(counts)) console.log(k.padEnd(22), v);
