/**
 * How fast a career grows, in numbers rather than in impressions.
 *
 * Prints the rating at the end of every season for a handful of careers, so a jump from
 * thirty-five to seventy in one youth season is visible rather than argued about.
 */
import { advanceWeek, currentOvr, resumeHalfTime } from '../src/career.js';
import { loadPack, startedCareer } from './helpers.js';

loadPack();
const seeds = (process.argv[2] ?? '7,108,209,310,411').split(',').map(Number);
const rows: string[] = [];

for (const seed of seeds) {
  const { state, index } = startedCareer({ seed });
  const byAge = new Map<number, number>();
  const pot = new Map<number, number>();
  const clubs = new Map<number, string>();
  for (let i = 0; i < 52 * 12 && !state.retired; i++) {
    const result = advanceWeek(state, index);
    state.pendingDecisions = [];
    if (result.stopped === 'halfTime' && state.pendingHalfTime) {
      const held = state.pendingHalfTime;
      resumeHalfTime(state, index, held.demand ?? held.options[0]!);
    }
    const age = state.world.season - state.player.birthYear;
    byAge.set(age, currentOvr(state));
    pot.set(age, Math.round(state.player.potential));
    if (state.player.clubId) clubs.set(age, state.player.clubId);
  }
  const line = [...byAge.entries()].sort((a, b) => a[0] - b[0]).map(([age, ovr]) => `${age}:${ovr}`).join(' ');
  const last = [...byAge.keys()].sort((a, b) => b - a)[0]!;
  rows.push(`seed ${String(seed).padStart(4)} | pot ${pot.get(last)} | minutes ${Math.round((state.world.seasonStats[state.player.id]?.minutes ?? 0))} | ${line}`);
}
console.log('rating by age (age:ovr)\n');
for (const row of rows) console.log(row);
