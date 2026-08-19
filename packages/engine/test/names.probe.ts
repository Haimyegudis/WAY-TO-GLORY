/** Does any boy in the youth league share a name with a man in a first team? */
import { userYouthCompetitionId } from '../src/youth.js';
import { playWeek, startedCareer } from './helpers.js';

const { state, index } = startedCareer({ seed: 4242 });
for (let i = 0; i < 60; i++) {
  playWeek(state, index);
  state.pendingDecisions = [];
}

const seniors = new Map<string, string>();
for (const player of Object.values(state.world.players)) {
  seniors.set(`${player.firstName} ${player.lastName}`, player.clubId ?? '-');
}

const youth = state.world.youth!;
const boys = Object.values(youth.players);
const clashes: string[] = [];
const seen = new Set<string>();
const twins: string[] = [];

for (const boy of boys) {
  const name = `${boy.firstName} ${boy.lastName}`;
  if (seniors.has(name)) clashes.push(`${name} (boy at ${boy.clubId}, senior at ${seniors.get(name)})`);
  if (seen.has(name)) twins.push(name);
  seen.add(name);
}

console.log('division:', userYouthCompetitionId(state));
console.log('boys:', boys.length, 'seniors modelled:', seniors.size);
console.log('boy sharing a name with a senior:', clashes.length, clashes.slice(0, 5));
console.log('two boys with the same name:', twins.length, twins.slice(0, 5));

const sample = boys.slice(0, 6).map((b) => `${b.firstName} ${b.lastName} (${state.world.season - b.birthYear})`);
console.log('sample of the age group:', sample.join(', '));
