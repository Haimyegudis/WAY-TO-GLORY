/**
 * A whole career, walked end to end.
 *
 * Not an assertion - a look. It answers the questions you can only answer by playing:
 * does a fifteen year old stay in the age group, does the youth chart fill up, does the
 * press ever turn up, does the dressing room ever ask him anything, and do the honours
 * land on somebody with a name.
 */
import { advanceWeek, answerMedia, resumeHalfTime } from '../src/career.js';
import { resolveDecision } from '../src/events.js';
import { Rng } from '../src/rng.js';
import { userYouthCompetition } from '../src/youth.js';
import { loadPack, startedCareer } from './helpers.js';

const pack = loadPack();
const seed = Number(process.argv[2] ?? 4242);
const { state, index } = startedCareer({ seed });
const rng = new Rng(seed);

const media: Record<string, number> = {};
const talks: Record<string, number> = {};
let halfTimes = 0;
let seniorBefore16 = 0;
let youthMatches = 0;

for (let i = 0; i < 53 * 12 && !state.retired; i++) {
  const result = advanceWeek(state, index);

  if (result.stopped === 'halfTime' && state.pendingHalfTime) {
    halfTimes++;
    const held = state.pendingHalfTime;
    const chosen = held.demand ?? held.options[rng.int(0, held.options.length - 1)]!;
    talks[chosen] = (talks[chosen] ?? 0) + 1;
    resumeHalfTime(state, index, chosen);
  }

  for (const decision of [...state.pendingDecisions]) {
    if (decision.eventId.startsWith('milestone:')) {
      const kind = decision.eventId.slice('milestone:'.length);
      media[kind] = (media[kind] ?? 0) + 1;
      answerMedia(state, index, decision.id, decision.options[rng.int(0, decision.options.length - 1)]!.id);
      continue;
    }
    if (decision.kind === 'event' && decision.options.length > 0) {
      resolveDecision(rng, state, decision.id, decision.options[0]!.id, pack.events);
    }
  }
  state.pendingDecisions = [];

  const last = state.lastMatch;
  if (last?.competitionId.endsWith('.youth')) youthMatches++;
  if (last && !last.competitionId.endsWith('.youth') && last.userLine?.played) {
    if (last.season - state.player.birthYear < 16) seniorBefore16++;
  }
}

const comp = userYouthCompetition(state);
const youth = state.world.youth;

console.log('--- youth ---');
console.log('youth matches played:', youthMatches);
console.log('boys modelled:', youth ? Object.keys(youth.players).length : 0);
console.log('divisions:', youth ? Object.keys(youth.competitions).join(', ') : '-');
console.log('his division:', youth?.userCompetitionId ?? '-');
if (comp) {
  const chart = Object.entries(comp.scorers).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([id, goals]) => `${youth?.players[id]?.lastName ?? (id === state.player.id ? 'HIM' : id)} ${goals}`);
  console.log('top of the youth chart:', chart.join(', ') || '-');
}

console.log('--- gate ---');
console.log('senior matches played before sixteen:', seniorBefore16);

console.log('--- press ---');
console.log('questions asked:', JSON.stringify(media));

console.log('--- dressing room ---');
console.log('half times:', halfTimes, JSON.stringify(talks));

console.log('--- honours ---');
const youthAwards = (state.world.history.awards ?? []).filter((a) => a.award.startsWith('youth'));
for (const award of youthAwards.slice(0, 8)) {
  console.log(`${award.season} ${award.award}: ${award.playerName ?? award.playerId} ${award.detail ?? ''}`);
}
console.log('his own honours:', JSON.stringify(state.awards ?? []));
console.log('national:', JSON.stringify({
  caps: state.nationalTeam.caps,
  goals: state.nationalTeam.goals,
  youthCaps: state.nationalTeam.youthCaps,
  youthGoals: state.nationalTeam.youthGoals,
  levels: [...new Set(state.nationalTeam.callUpHistory.map((c) => c.level))],
}));

console.log('--- career ---');
for (const record of state.seasonHistory) {
  console.log(`${record.season} age ${record.age} ${record.competitionId}: ${record.apps} apps ${record.goals}g ${record.assists}a ovr ${record.ovrEnd}`);
}
