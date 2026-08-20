import { advanceWeek, answerMedia, answerOffer, answerSeasonGoal, resumeHalfTime } from '../src/career.js';
import { resolveDecision } from '../src/events.js';
import { Rng } from '../src/rng.js';
import { loadPack, startedCareer } from './helpers.js';
loadPack();
const country = process.argv[2] ?? 'BRA';
const { state, index } = startedCareer({ seed: 31, birthCountry: country, startCountry: country });
const rng = new Rng(99);
let lastClub = state.player.clubId;
for (let i = 0; i < 53 * 8 && !state.retired; i++) {
  const r = advanceWeek(state, index);
  if (r.stopped === 'halfTime' && state.pendingHalfTime) {
    const h = state.pendingHalfTime;
    resumeHalfTime(state, index, h.demand ?? h.options[0]!);
  }
  for (const d of [...state.pendingDecisions]) {
    if (d.kind === 'transfer') answerOffer(state, index, d.id, null);
    else if (d.eventId === 'seasonGoal') answerSeasonGoal(state, index, d.id, d.options[0]!.id);
    else if (d.eventId.startsWith('milestone:')) answerMedia(state, index, d.id, d.options[0]!.id);
    else if (d.kind !== 'agent' && !d.eventId.startsWith('mentorPrompt_')) resolveDecision(rng, state, d.id, d.options[0]!.id, index.pack.events);
    state.pendingDecisions = state.pendingDecisions.filter((x) => x.id !== d.id);
  }
  if (state.player.clubId !== lastClub) {
    console.log(`s${state.world.season} w${state.world.week}: ${lastClub ?? 'none'} -> ${state.player.clubId ?? 'none'}`);
    lastClub = state.player.clubId;
  }
}
console.log(country, 'end: club', state.player.clubId, 'contract', state.contract?.clubId, 'retired', state.retired, 'age', state.world.season - state.player.birthYear);
