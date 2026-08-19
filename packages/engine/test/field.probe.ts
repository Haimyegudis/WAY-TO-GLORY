/** Who is actually in the Champions League? */
import { advanceWeek } from '../src/career.js';
import { startedCareer } from './helpers.js';

const { state, index } = startedCareer({ seed: 17 });
for (let i = 0; i < 6; i++) advanceWeek(state, index);
const ucl = state.world.europe?.ucl;
if (!ucl) console.log('none');
else {
  const byCountry = new Map<string, string[]>();
  for (const group of ucl.groups) {
    for (const id of group.clubIds) {
      const club = state.world.clubs[id]!;
      byCountry.set(club.country, [...(byCountry.get(club.country) ?? []), club.name]);
    }
  }
  console.log(`groups ${ucl.groups.length}, clubs ${[...byCountry.values()].flat().length}`);
  for (const [country, names] of [...byCountry].sort((a, b) => b[1].length - a[1].length)) {
    console.log(` ${country}: ${names.length} — ${names.slice(0, 4).join(', ')}`);
  }
}
