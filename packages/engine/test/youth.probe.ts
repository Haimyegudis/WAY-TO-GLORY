/** Does a 15-year-old actually play, and does the first team notice? */
import { advanceWeek } from '../src/career.js';
import { startedCareer } from './helpers.js';

const { state, index } = startedCareer({ seed: 12 });
let calledUp = -1;
for (let i = 0; i < 53 * 3; i++) {
  advanceWeek(state, index);
  if (state.flags['calledUpToSeniors'] && calledUp < 0) calledUp = i;
}
const form = state.world.youthForm;
console.log('youth form this season:', JSON.stringify(form));
console.log('called up at week', calledUp, 'role', state.player.squadRole);
const youthMatches = state.matchLog.filter((m) => m.competitionId.endsWith('.youth')).length;
console.log('youth matches in the log:', youthMatches);
const seasons = state.seasonHistory.map((r) => `${r.season}: ${r.apps} apps ${r.goals}g ovr ${r.ovrEnd}`);
console.log(seasons.join('\n'));
