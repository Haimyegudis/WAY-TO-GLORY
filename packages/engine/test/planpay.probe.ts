/** Is choosing the right job for the afternoon worth anything? */
import { advanceWeek, matchPreparation, setMatchPlan } from '../src/career.js';
import { loadPack, startedCareer } from './helpers.js';
loadPack();

function run(pick: 'best' | 'worst' | 'none') {
  let apps = 0, goals = 0, assists = 0, rating = 0, shots = 0;
  for (const seed of [11, 55, 96, 233, 404]) {
    const { state, index } = startedCareer({ seed });
    for (let i = 0; i < 53 * 4 && !state.retired; i++) {
      if (pick !== 'none') {
        const prep = matchPreparation(state, index);
        if (prep && prep.options.length > 0) {
          const option = pick === 'best' ? prep.options[0]! : prep.options[prep.options.length - 1]!;
          setMatchPlan(state, index, option.id as never);
        }
      }
      const before = state.matchLog.length;
      advanceWeek(state, index);
      state.pendingDecisions = [];
      for (const match of state.matchLog.slice(0, Math.max(0, state.matchLog.length - before))) {
        const line = match.userLine;
        if (!line?.played) continue;
        apps++; goals += line.goals; assists += line.assists; rating += line.rating; shots += line.shots;
      }
    }
  }
  return { apps, goals, assists, shots, rating: rating / Math.max(1, apps) };
}

for (const pick of ['best', 'none', 'worst'] as const) {
  const r = run(pick);
  console.log(`${pick.padEnd(6)} ${r.apps} apps · ${r.goals} goals (${(r.goals / Math.max(1, r.apps)).toFixed(3)}/game) · ${r.assists} assists · ${r.shots} shots · rating ${r.rating.toFixed(3)}`);
}
