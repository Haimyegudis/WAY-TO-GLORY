/** The league phase: is it 36 clubs, eight matches each, and does the right club win? */
import { advanceWeek } from '../src/career.js';
import { startedCareer } from './helpers.js';
import { leaguePhaseTable } from '../src/europe.js';

const { state, index } = startedCareer({ seed: 12 });
let checked = false;
const winners: string[] = [];

for (let i = 0; i < 53 * 10; i++) {
  advanceWeek(state, index);

  const ucl = state.world.europe?.['ucl'];
  if (ucl?.leaguePhase && !checked && ucl.fixtures.length > 0) {
    const clubs = Object.keys(ucl.leaguePhase);
    const played = new Map<string, number>();
    for (const f of ucl.fixtures) {
      played.set(f.homeClubId, (played.get(f.homeClubId) ?? 0) + 1);
      played.set(f.awayClubId, (played.get(f.awayClubId) ?? 0) + 1);
    }
    const counts = [...played.values()];
    console.log('clubs in the league phase:', clubs.length);
    console.log('matches each: min', Math.min(...counts), 'max', Math.max(...counts));
    console.log('matchdays:', [...new Set(ucl.fixtures.map((f) => f.week))].join(', '));
    checked = true;
  }

  if (ucl?.stage === 'playoff' && !winners.includes('sawPlayoff')) {
    winners.push('sawPlayoff');
    const table = leaguePhaseTable(ucl);
    console.log(
      'top of the league phase:',
      table.slice(0, 3).map((r) => `${state.world.clubs[r.clubId]?.shortName} ${r.points}`).join(' | '),
      '   24th:',
      state.world.clubs[table[23]?.clubId ?? '']?.shortName,
    );
  }
}

for (const record of state.world.history.europeanWinners ?? []) {
  winners.push(`${record.season} ${record.tier} ${state.world.clubs[record.clubId]?.shortName ?? record.clubId}`);
}
console.log(winners.filter((w) => w !== 'sawPlayoff').join('\n'));
