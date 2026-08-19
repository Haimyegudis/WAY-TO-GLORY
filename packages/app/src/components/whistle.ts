import { soundIsOff } from './ThemeMusic.js';

/**
 * The referee's whistle - the real one, recorded, not built out of oscillators.
 *
 * Two files rather than one: the end of a match is three blasts with the last one held,
 * and the interval is a single blast, which is the third one on its own. Both are cut
 * from the same recording, so it is the same referee either way.
 *
 * They are loaded the first time one is asked for and then kept, because the second half
 * should not wait on the network - and once the app has been installed they come out of
 * its own cache anyway.
 */
type Blast = 'halfTime' | 'fullTime';

const FILE: Record<Blast, string> = {
  halfTime: '/audio/whistle-half.mp3',
  fullTime: '/audio/whistle.mp3',
};

const loaded: Partial<Record<Blast, HTMLAudioElement>> = {};

function element(kind: Blast): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  const held = loaded[kind];
  if (held) return held;
  const audio = new Audio(FILE[kind]);
  audio.preload = 'auto';
  audio.volume = 0.85;
  loaded[kind] = audio;
  return audio;
}

/**
 * The same whistle asked for twice in the same moment is one whistle.
 *
 * The interval happens once, but the component that notices it can be mounted more than
 * once - React does exactly that on purpose while developing - and the same recording
 * started three times over itself is not three whistles, it is a mess.
 */
let lastBlown: { kind: Blast; at: number } | null = null;

export function blowWhistle(kind: Blast): void {
  if (soundIsOff()) return;
  const now = Date.now();
  if (lastBlown && lastBlown.kind === kind && now - lastBlown.at < 2000) return;
  lastBlown = { kind, at: now };

  const audio = element(kind);
  if (!audio) return;
  audio.currentTime = 0;
  // A tab nobody has touched is not allowed to make a noise, and there is nothing to be
  // done about that except let it fail quietly. By half time he has certainly touched it.
  void audio.play().catch(() => {});
}
