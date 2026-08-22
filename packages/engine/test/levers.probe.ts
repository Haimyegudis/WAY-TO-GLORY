/**
 * What the player's choices are actually worth.
 *
 * Same seed, same boy, one lever changed: train harder, eat better, sign for the good
 * academy, talk to an old pro, work the dressing room. Each run is walked for the same
 * number of seasons and what comes out is the rating, the minutes and the money. If a
 * lever moves nothing, it is decoration.
 *
 *   tsx test/levers.probe.ts [seeds] [seasons]
 */
import { advanceWeek, actionsAvailableNow, askMentor, chooseMentor, currentOvr, doPlayerAction, mentorChoices, resumeHalfTime, setTraining, takeMentorAdvice } from '../src/career.js';
import { resolveDecision } from '../src/events.js';
import { mentorTopics, type MentorTopic } from '../src/mentor.js';
import { Rng } from '../src/rng.js';
import { loadPack, startedCareer } from './helpers.js';
import type { CareerState, TrainingPlan } from '../src/types.js';

loadPack();
const seeds = Number(process.argv[2] ?? 8);
const seasons = Number(process.argv[3] ?? 7);

interface Variant {
  name: string;
  academyIndex?: number;
  plan?: Partial<TrainingPlan>;
  mentor?: boolean;
  /** Talks to him, but does not hand the brief to his agent. */
  ignoreAdvice?: boolean;
  social?: boolean;
}

const VARIANTS: Variant[] = [
  { name: 'baseline (normal/balanced/normal diet, mid academy)' },
  { name: 'intensity: light', plan: { intensity: 'light' } },
  { name: 'intensity: intensive', plan: { intensity: 'intensive' } },
  { name: 'intensity: extreme', plan: { intensity: 'extreme' } },
  { name: 'diet: poor', plan: { diet: 'poor' } },
  { name: 'diet: professional', plan: { diet: 'professional' } },
  { name: 'diet: nutritionist', plan: { diet: 'nutritionist' } },
  { name: 'focus: physical', plan: { focus: 'physical' } },
  { name: 'focus: technical', plan: { focus: 'technical' } },
  { name: 'academy: strongest offer', academyIndex: 0 },
  { name: 'academy: weakest offer', academyIndex: 4 },
  { name: 'mentor: chosen and asked weekly', mentor: true },
  { name: 'mentor: talked to, advice not acted on', mentor: true, ignoreAdvice: true },
  { name: 'social: an action every week', social: true },
  { name: 'everything: best academy, pro diet, intensive, mentor, social', academyIndex: 0, plan: { intensity: 'intensive', diet: 'professional' }, mentor: true, social: true },
];

function run(seed: number, variant: Variant) {
  const rng = new Rng(seed * 31 + 7);
  const { state, index } = startedCareer({ seed }, variant.academyIndex ?? 2);
  if (variant.plan) setTraining(state, variant.plan);
  let mentorPicked = false;
  const startSeason = state.world.season;
  let weeks = 0;

  while (!state.retired && state.world.season - startSeason < seasons && weeks < 53 * seasons * 2) {
    weeks++;
    const result = advanceWeek(state, index);
    // Keep the plan: a coach's inbox action must not silently rewrite the experiment.
    if (variant.plan) setTraining(state, variant.plan);

    if (result.stopped === 'halfTime' && state.pendingHalfTime) {
      const held = state.pendingHalfTime;
      resumeHalfTime(state, index, held.demand ?? held.options[0]!);
    }
    if (variant.mentor) {
      if (!mentorPicked) {
        const choices = mentorChoices(state);
        if (choices.length > 0) { chooseMentor(state, choices[0]!.id); mentorPicked = true; }
      } else {
        const topics = mentorTopics(state, state.world.season - state.player.birthYear);
        const topic = topics[rng.int(0, topics.length - 1)] as MentorTopic | undefined;
        if (topic) {
          const reply = askMentor(state, topic);
          if (reply?.brief && !variant.ignoreAdvice) takeMentorAdvice(state, reply);
        }
      }
    }
    if (variant.social) {
      const available = actionsAvailableNow(state);
      if (available.length > 0) doPlayerAction(state, available[rng.int(0, available.length - 1)]!.id);
    }
    for (const decision of [...state.pendingDecisions]) {
      // Everything is answered the same way in every variant: first option, no moves.
      if (decision.kind === 'transfer' || decision.kind === 'agent') {
        state.pendingDecisions = state.pendingDecisions.filter((d) => d.id !== decision.id);
        continue;
      }
      if (decision.options.length > 0 && decision.eventId.startsWith('milestone:') === false
        && decision.eventId !== 'seasonGoal' && !decision.eventId.startsWith('mentorPrompt:')) {
        resolveDecision(rng, state, decision.id, decision.options[0]!.id, index.pack.events);
      }
      state.pendingDecisions = state.pendingDecisions.filter((d) => d.id !== decision.id);
    }
  }

  const apps = state.seasonHistory.reduce((sum, r) => sum + r.apps, 0);
  const minutes = state.seasonHistory.reduce((sum, r) => sum + r.minutes, 0);
  const injuries = state.player.condition.injuryHistory.length;
  return {
    ovr: currentOvr(state),
    potential: state.player.potential,
    apps,
    minutes,
    injuries,
    value: state.marketValue,
    role: state.player.squadRole,
    fatigue: Math.round(state.player.condition.fatigue),
  };
}

const results: { name: string; ovr: number; apps: number; minutes: number; injuries: number; value: number }[] = [];
for (const variant of VARIANTS) {
  const runs: ReturnType<typeof run>[] = [];
  for (let s = 0; s < seeds; s++) runs.push(run(4242 + s * 97, variant));
  const mean = (pick: (r: ReturnType<typeof run>) => number) =>
    runs.reduce((sum, r) => sum + pick(r), 0) / runs.length;
  results.push({
    name: variant.name,
    ovr: Number(mean((r) => r.ovr).toFixed(1)),
    apps: Math.round(mean((r) => r.apps)),
    minutes: Math.round(mean((r) => r.minutes)),
    injuries: Number(mean((r) => r.injuries).toFixed(1)),
    value: Math.round(mean((r) => r.value)),
  });
}

const base = results[0]!;
console.log(`After ${seasons} seasons, mean of ${seeds} careers:\n`);
console.log('lever'.padEnd(58), 'ovr'.padStart(6), 'd'.padStart(6), 'apps'.padStart(6), 'mins'.padStart(7), 'inj'.padStart(5), 'value'.padStart(11));
for (const r of results) {
  console.log(
    r.name.padEnd(58),
    r.ovr.toFixed(1).padStart(6),
    (r.ovr - base.ovr >= 0 ? '+' : '') + (r.ovr - base.ovr).toFixed(1).padStart(5),
    String(r.apps).padStart(6),
    String(r.minutes).padStart(7),
    r.injuries.toFixed(1).padStart(5),
    (`${(r.value / 1e6).toFixed(1)}M`).padStart(11),
  );
}
