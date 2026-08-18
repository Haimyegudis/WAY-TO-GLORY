/** Are the awards handed out, and does the player ever get near one? */
import { advanceWeek } from '../src/career.js';
import { startedCareer } from './helpers.js';

const { state, index } = startedCareer({ seed: 5 });
for (let i = 0; i < 53 * 6; i++) advanceWeek(state, index);

const awards = state.world.history.awards ?? [];
console.log('awards handed out:', awards.length);
const byAward = new Map<string, number>();
for (const a of awards) byAward.set(a.award, (byAward.get(a.award) ?? 0) + 1);
console.log([...byAward].map(([k, v]) => `${k}:${v}`).join(' '));
console.log('user won:', JSON.stringify(state.awards ?? []));
console.log('user shortlisted:', (state.awardNominations ?? []).length);
const last = awards.filter(a => a.award === 'ballonDOr').slice(-3);
for (const a of last) {
  const p = state.world.players[a.playerId];
  console.log(`ballon ${a.season}: ${p ? p.firstName + ' ' + p.lastName : a.playerId}`);
}
