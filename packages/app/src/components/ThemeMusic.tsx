import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'fc.music';

/**
 * The soundtrack, in three parts: the theme on the title screen and while a player is
 * being made, a quieter loop through the career screens, and the crowd when a match is
 * actually being watched. One track at a time, and a mute the game remembers.
 *
 * Browsers refuse to play sound before the page has been touched, so playback is armed
 * and starts on the first tap.
 */
type Track = 'theme' | 'matchday' | 'season';

const VOLUME: Record<Track, number> = { theme: 0.55, matchday: 0.4, season: 0.3 };

/** Mute is one setting for the whole game, shared by every player on screen. */
const listeners = new Set<(muted: boolean) => void>();
let mutedGlobal = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'off';

function setMutedGlobal(next: boolean): void {
  mutedGlobal = next;
  localStorage.setItem(STORAGE_KEY, next ? 'off' : 'on');
  for (const listener of listeners) listener(next);
}

export function ThemeMusic({ playing, track = 'theme' }: { playing: boolean; track?: Track }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(mutedGlobal);

  useEffect(() => {
    listeners.add(setMuted);
    return () => {
      listeners.delete(setMuted);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!playing || muted) {
      audio.pause();
      return;
    }

    audio.volume = VOLUME[track];
    const start = () => {
      void audio.play().catch(() => {
        // Autoplay refused; the listener below picks it up on the first interaction.
      });
    };
    start();

    // Browsers block audio until the page has been touched, and the first touch can
    // land anywhere, so keep trying on every interaction until it is actually playing.
    const retry = () => {
      if (!audio.paused) {
        window.removeEventListener('pointerdown', retry);
        return;
      }
      start();
    };
    window.addEventListener('pointerdown', retry);
    return () => window.removeEventListener('pointerdown', retry);
  }, [playing, muted, track]);

  return <audio ref={audioRef} src={`/audio/${track}.mp3`} loop preload="none" />;
}

/** The sound switch, for the settings screen. */
export function useMusicSetting(): [boolean, (on: boolean) => void] {
  const [muted, setMuted] = useState(mutedGlobal);
  useEffect(() => {
    listeners.add(setMuted);
    return () => {
      listeners.delete(setMuted);
    };
  }, []);
  return [!muted, (on: boolean) => setMutedGlobal(!on)];
}
