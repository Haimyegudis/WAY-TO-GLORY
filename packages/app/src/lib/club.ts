import type { Club } from '@fc/engine';
import type { Lang } from '../i18n/index.js';

/**
 * Club identity for display. Hebrew names come from the club's own Hebrew
 * Wikipedia article where one exists; otherwise the Latin name is used, which is
 * how Israeli football media writes foreign clubs without a settled spelling anyway.
 */
export function clubName(club: Club | null | undefined, lang: Lang): string {
  if (!club) return '';
  if (lang === 'he' && club.nameHe) return club.nameHe;
  return club.name;
}

export function clubShortName(club: Club | null | undefined, lang: Lang): string {
  if (!club) return '';
  if (lang === 'he' && club.nameHe) return shortenHebrew(club.nameHe);
  return club.shortName;
}

/** Hebrew club names carry a lot of "מועדון כדורגל" style baggage; trim it for lists. */
function shortenHebrew(name: string): string {
  return name
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/מועדון כדורגל\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function crestUrl(club: Club | null | undefined): string | null {
  return club?.crest ? `/crests/${club.crest}` : null;
}

/** A stable colour for a club with no crest colour: derived from its id. */
export function clubColor(club: Club | null | undefined): string {
  if (club?.color) return club.color;
  if (!club) return '#24304a';
  let hash = 0;
  for (let i = 0; i < club.id.length; i++) hash = (hash * 31 + club.id.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue} 45% 32%)`;
}

/** Initials for the fallback badge. */
export function clubInitials(club: Club | null | undefined, lang: Lang): string {
  const name = clubName(club, lang) || '?';
  const words = name.split(/\s+/).filter((w) => w.length > 1);
  if (words.length === 0) return name.slice(0, 2);
  if (words.length === 1) return words[0]!.slice(0, 2);
  return (words[0]![0] ?? '') + (words[1]![0] ?? '');
}
