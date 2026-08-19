import { soundIsOff } from './ThemeMusic.js';

/**
 * The referee's whistle, built rather than recorded.
 *
 * A pea whistle is a tone around three and a half kilohertz with a second one above it,
 * and the pea rattling inside chops it into a fast warble - that warble is the whole
 * difference between a whistle and a beep. There is breath in it too, which is the noise
 * layer. All of it is a few oscillators, so the game does not ship an audio file for two
 * seconds of sound and does not need the network to blow it.
 *
 * Two blasts for the interval, three for the end, the last one held: the pattern every
 * referee uses and the one an ear recognises without being told what it means.
 */
type Blast = 'halfTime' | 'fullTime';

const PATTERN: Record<Blast, number[]> = {
  halfTime: [0.34, 0.62],
  fullTime: [0.26, 0.26, 0.85],
};

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  return context;
}

/** The breath behind the tone: short filtered noise, quiet under everything else. */
function breath(ac: AudioContext, at: number, length: number, into: AudioNode): void {
  const frames = Math.floor(ac.sampleRate * length);
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const source = ac.createBufferSource();
  source.buffer = buffer;
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 3400;
  band.Q.value = 1.6;
  const level = ac.createGain();
  level.gain.value = 0.12;
  source.connect(band).connect(level).connect(into);
  source.start(at);
  source.stop(at + length);
}

function blast(ac: AudioContext, at: number, length: number): void {
  const out = ac.createGain();
  out.connect(ac.destination);
  // Hard on, hard off: a referee does not fade in.
  out.gain.setValueAtTime(0.0001, at);
  out.gain.exponentialRampToValueAtTime(0.3, at + 0.018);
  out.gain.setValueAtTime(0.3, at + Math.max(0.05, length - 0.06));
  out.gain.exponentialRampToValueAtTime(0.0001, at + length);

  // The pea, rattling: a fast wobble applied to every tone at once.
  const pea = ac.createOscillator();
  pea.frequency.value = 27;
  const peaDepth = ac.createGain();
  peaDepth.gain.value = 210;
  pea.connect(peaDepth);
  pea.start(at);
  pea.stop(at + length + 0.02);

  for (const [frequency, level] of [[3480, 1], [4260, 0.45], [2180, 0.22]] as const) {
    const tone = ac.createOscillator();
    tone.type = 'sine';
    tone.frequency.value = frequency;
    peaDepth.connect(tone.frequency);
    const gain = ac.createGain();
    gain.gain.value = level;
    tone.connect(gain).connect(out);
    tone.start(at);
    tone.stop(at + length + 0.02);
  }

  breath(ac, at, length, out);
}

/**
 * The same whistle asked for twice in the same moment is one whistle.
 *
 * The interval arrives once, but the component that notices it can be mounted more than
 * once - React does exactly that on purpose while developing - and three identical
 * blasts stacked on top of each other is not three whistles, it is one harsh one.
 */
let lastBlown: { kind: Blast; at: number } | null = null;

export function blowWhistle(kind: Blast): void {
  if (soundIsOff()) return;
  const now = Date.now();
  if (lastBlown && lastBlown.kind === kind && now - lastBlown.at < 2000) return;
  lastBlown = { kind, at: now };
  const ac = audio();
  if (!ac) return;
  // A tab that has not been touched keeps its audio suspended; there is nothing to do
  // about that except ask, and by half time he has certainly touched it.
  if (ac.state === 'suspended') void ac.resume();

  let at = ac.currentTime + 0.04;
  for (const length of PATTERN[kind]) {
    blast(ac, at, length);
    at += length + 0.17;
  }
}
