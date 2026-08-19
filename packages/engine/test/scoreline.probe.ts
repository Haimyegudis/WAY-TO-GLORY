/** What do mismatches actually finish? */
import { Rng } from '../src/rng.js';
import { clubRating, expectedGoals, simulateQuickResult } from '../src/match.js';

const rng = new Rng(4);
const cases: [number, number, string][] = [
  [92, 30, 'giant at home vs fourth tier'],
  [88, 55, 'giant at home vs mid second tier'],
  [80, 72, 'top four at home vs mid table'],
  [70, 70, 'even'],
];
for (const [a, b, label] of cases) {
  const home = { strength: a } as never as Parameters<typeof clubRating>[0];
  const away = { strength: b } as never as Parameters<typeof clubRating>[0];
  let hg = 0, ag = 0, homeWins = 0, byThree = 0;
  const n = 400;
  for (let i = 0; i < n; i++) {
    const [h, a2] = simulateQuickResult(rng, { homeRating: clubRating(home), awayRating: clubRating(away) });
    hg += h; ag += a2;
    if (h > a2) homeWins++;
    if (h - a2 >= 3) byThree++;
  }
  console.log(`${label}: avg ${(hg / n).toFixed(2)}-${(ag / n).toFixed(2)}, home win ${(homeWins / n * 100).toFixed(0)}%, 3+ margin ${(byThree / n * 100).toFixed(0)}%`);
}
void expectedGoals;
