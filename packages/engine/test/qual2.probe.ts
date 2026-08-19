/** Does his country ever actually get there, and does the table look like a table? */
import { advanceWeek } from '../src/career.js';
import { startedCareer, loadPack } from './helpers.js';
import { qualifyingTable, qualified } from '../src/qualifying.js';

const pack = loadPack();
const name = (code: string) => pack.countries.find((c) => c.code === code)?.name ?? code;

for (const seed of [3, 8]) {
  const { state, index } = startedCareer({ seed });
  let shown = false;
  for (let i = 0; i < 53 * 12; i++) {
    advanceWeek(state, index);
    const c = state.campaign;
    if (c && !shown && c.fixtures.every((f) => f.played)) {
      shown = true;
      console.log(`\n${c.tournament} ${c.season} group of ${name(c.countryCode)}:`);
      for (const row of qualifyingTable(c)) {
        console.log(
          `  ${row.countryCode === c.countryCode ? '>' : ' '} ${name(row.countryCode).padEnd(16)} ${row.played} ${row.won}-${row.drawn}-${row.lost}  ${row.goalsFor}:${row.goalsAgainst}  ${row.points}`,
        );
      }
      console.log('  outcome:', c.outcome, c.playoff ? `(play-off vs ${name(c.playoff.opponent)}, won=${c.playoff.won})` : '');
    }
  }
  const history = state.campaignHistory ?? [];
  console.log(
    `seed ${seed}: campaigns ${history.length}, qualified ${history.filter(qualified).length}, caps ${state.nationalTeam.caps}`,
  );
}
