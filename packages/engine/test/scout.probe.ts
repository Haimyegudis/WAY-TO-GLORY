/** Does the scouting report ever say anything different? */
import { advanceWeek, matchPreparation } from '../src/career.js';
import { loadPack, startedCareer } from './helpers.js';
loadPack();

const threats: Record<string, number> = {};
const weaknesses: Record<string, number> = {};
const fits: number[] = [];
let reports = 0;

for (const seed of [11, 55, 96, 233]) {
  const { state, index } = startedCareer({ seed });
  for (let i = 0; i < 53 * 4 && !state.retired; i++) {
    const prep = matchPreparation(state, index);
    if (prep) {
      reports++;
      threats[prep.report.threat] = (threats[prep.report.threat] ?? 0) + 1;
      weaknesses[prep.report.weakness] = (weaknesses[prep.report.weakness] ?? 0) + 1;
      const best = prep.options[0]?.fit ?? 0;
      const worst = prep.options[prep.options.length - 1]?.fit ?? 0;
      fits.push(best - worst);
    }
    advanceWeek(state, index);
    state.pendingDecisions = [];
  }
}
const pct = (table: Record<string, number>) => Object.entries(table)
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `${k} ${(100 * v / reports).toFixed(0)}%`)
  .join('  ');
console.log(`${reports} reports`);
console.log('threat    ', pct(threats));
console.log('weakness  ', pct(weaknesses));
console.log('fit spread', (fits.reduce((a, b) => a + b, 0) / Math.max(1, fits.length)).toFixed(2),
  ' none-zero spread in', `${(100 * fits.filter((f) => f > 0.2).length / Math.max(1, fits.length)).toFixed(0)}%`);
