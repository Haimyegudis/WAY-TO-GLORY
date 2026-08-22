/** Does the second federation ever ring, and is the case it makes true? */
import { advanceWeek, answerNationalApproach } from '../src/career.js';
import { associationApproach } from '../src/allegiance.js';
import { loadPack, startedCareer } from './helpers.js';
loadPack();

for (const answer of ['accept', 'stay'] as const) {
  let approaches = 0;
  const reasons: Record<string, number> = {};
  let capsAfter = 0;
  let careers = 0;

  for (const seed of [11, 55, 96, 233]) {
    const { state, index } = startedCareer({ seed, secondCitizenship: 'FRA' } as never);
    careers++;
    for (let i = 0; i < 53 * 8 && !state.retired; i++) {
      advanceWeek(state, index);
      for (const decision of [...state.pendingDecisions]) {
        if (decision.eventId !== 'nationalApproach') continue;
        approaches++;
        const pitch = associationApproach(state, index);
        if (pitch) reasons[pitch.reason] = (reasons[pitch.reason] ?? 0) + 1;
        answerNationalApproach(state, index, decision.id, answer);
      }
      state.pendingDecisions = [];
    }
    capsAfter += state.nationalTeam.caps;
  }
  console.log(`${answer}: ${approaches} approaches over ${careers} careers · ${capsAfter} caps · reasons ${JSON.stringify(reasons)}`);
}
