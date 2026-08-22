/**
 * Does preparing for the opponent actually change the afternoon?
 *
 *   tsx test/tactics.probe.ts [seeds] [seasons]
 */
import { advanceWeek, matchPreparation, resumeHalfTime, setMatchPlan } from '../src/career.js';
import { Rng } from '../src/rng.js';
import { loadPack, startedCareer } from './helpers.js';

loadPack();
const seeds = Number(process.argv[2] ?? 10);
const seasons = Number(process.argv[3] ?? 6);

type Mode = 'none' | 'best' | 'worst' | 'random';

function run(seed: number, mode: Mode) {
  const rng = new Rng(seed * 13 + 5);
  const { state, index } = startedCareer({ seed }, 2);
  const start = state.world.season;
  let weeks = 0;
  let prepared = 0;
  const ratings: number[] = [];
  let duelsWon = 0; let duels = 0; let goals = 0; let assists = 0;
  const seen = new Set<string>();

  while (!state.retired && state.world.season - start < seasons && weeks < 53 * seasons * 2) {
    weeks++;
    if (mode !== 'none') {
      const prep = matchPreparation(state, index);
      if (prep && prep.options.length > 0) {
        const pick = mode === 'best' ? prep.options[0]!.id
          : mode === 'worst' ? prep.options[prep.options.length - 1]!.id
          : prep.options[rng.int(0, prep.options.length - 1)]!.id;
        if (setMatchPlan(state, index, pick)) prepared++;
      }
    }
    const result = advanceWeek(state, index);
    state.pendingDecisions = [];
    if (result.stopped === 'halfTime' && state.pendingHalfTime) {
      resumeHalfTime(state, index, state.pendingHalfTime.demand ?? state.pendingHalfTime.options[0]!);
    }
    for (const match of state.matchLog) {
      if (seen.has(match.id)) continue;
      seen.add(match.id);
      const line = match.userLine;
      if (!line?.played) continue;
      ratings.push(line.rating);
      goals += line.goals;
      assists += line.assists;
      if (line.duel) { duels++; if (line.duel.won) duelsWon++; }
    }
  }
  const mean = ratings.reduce((a, b) => a + b, 0) / Math.max(1, ratings.length);
  return { prepared, matches: ratings.length, mean, goals, assists, duelRate: duels > 0 ? duelsWon / duels : 0 };
}

for (const mode of ['none', 'worst', 'random', 'best'] as Mode[]) {
  const runs = Array.from({ length: seeds }, (_, s) => run(4242 + s * 97, mode));
  const avg = (pick: (r: typeof runs[0]) => number) => runs.reduce((a, r) => a + pick(r), 0) / runs.length;
  console.log(
    `${mode.padEnd(7)} prepared ${avg((r) => r.prepared).toFixed(0).padStart(4)}` +
    `  matches ${avg((r) => r.matches).toFixed(0).padStart(4)}` +
    `  rating ${avg((r) => r.mean).toFixed(3)}` +
    `  goals ${avg((r) => r.goals).toFixed(1).padStart(6)}` +
    `  assists ${avg((r) => r.assists).toFixed(1).padStart(5)}` +
    `  duels won ${(avg((r) => r.duelRate) * 100).toFixed(0)}%`,
  );
}
