/** Weeks a fit young player had a fixture to be in and played no football at all. */
import { recentMinutesShare } from '../src/career.js';
import { YOUTH_MAX_AGE, userYouthCompetitionId } from '../src/youth.js';
import { loadPack, playWeek, startedCareer } from './helpers.js';
loadPack();

for (const seed of [11, 55, 96, 233]) {
  const { state, index } = startedCareer({ seed });
  let weeks = 0, playedIn = 0, longest = 0, run = 0;
  const why: Record<string, number> = {};
  for (let i = 0; i < 53 * 8 && !state.retired; i++) {
    const clubId = state.player.clubId;
    const youthId = userYouthCompetitionId(state);
    const youthComp = youthId ? state.world.youth?.competitions[youthId] : undefined;
    const senior = clubId ? state.world.competitions[state.world.clubs[clubId]?.competitionId ?? ''] : undefined;
    const week = state.world.week;
    const due = [youthComp, senior].some((c) => (c?.fixtures ?? []).some(
      (f) => !f.played && f.week === week && (f.homeClubId === clubId || f.awayClubId === clubId),
    ));
    const before = state.lastMatch?.id ?? '';
    playWeek(state, index);
    const age = state.world.season - state.player.birthYear;
    if (!due || age > YOUTH_MAX_AGE + 3) continue;
    if (state.player.condition.injuries.length > 0 || state.player.condition.suspensions.length > 0) continue;
    weeks++;
    const at = state.matchLog.findIndex((match) => match.id === before);
    const fresh = state.matchLog.slice(0, at === -1 ? state.matchLog.length : at);
    if (fresh.some((match) => match.userLine?.played)) { playedIn++; run = 0; continue; }
    run++; longest = Math.max(longest, run);
    const key = `${state.player.squadRole}/${recentMinutesShare(state) >= 0.25 ? 'hasMinutes' : 'noMinutes'}/age${age}`;
    why[key] = (why[key] ?? 0) + 1;
  }
  console.log(`seed ${seed}: played ${playedIn}/${weeks} weeks with a fixture, longest idle run ${longest}`);
  for (const [k, v] of Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 6)) console.log(`   ${k}: ${v}`);
}
