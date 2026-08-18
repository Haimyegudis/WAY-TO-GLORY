/**
 * Writes a contact sheet of every crest, grouped by league, into the app's public
 * folder. Automated checks catch photos and namesakes; the last check is a human
 * looking at 436 badges at once, which takes about ten seconds on this page.
 *
 *   npx tsx src/crest-sheet.ts   ->  http://localhost:5173/crests.html
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DataPack } from '@fc/engine';

const here = dirname(fileURLToPath(import.meta.url));
const packsDir = join(here, '..', 'packs');
const outPath = join(here, '..', '..', 'app', 'public', 'crests.html');

function escape(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

async function main(): Promise<void> {
  const pack = JSON.parse(await readFile(join(packsDir, 'pack.json'), 'utf8')) as DataPack;
  const byComp = new Map<string, typeof pack.clubs>();
  for (const club of pack.clubs) {
    const list = byComp.get(club.competitionId) ?? [];
    list.push(club);
    byComp.set(club.competitionId, list);
  }

  const sections: string[] = [];
  let withCrest = 0;

  for (const competition of pack.competitions) {
    const clubs = byComp.get(competition.id);
    if (!clubs) continue;
    const cards = clubs.map((club) => {
      if (club.crest) withCrest++;
      const art = club.crest
        ? `<img src="/crests/${club.crest}" alt="" loading="lazy">`
        : `<div class="none">${escape(club.name.slice(0, 2).toUpperCase())}</div>`;
      const label = club.nameHe ?? club.name;
      return `<figure${club.crest ? '' : ' class="missing"'}>
  ${art}
  <figcaption>${escape(label)}<small>${escape(club.name)}</small></figcaption>
</figure>`;
    });
    sections.push(`<section><h2>${escape(competition.nameHe ?? competition.name)} <small>${escape(competition.name)}</small></h2>
<div class="grid">${cards.join('\n')}</div></section>`);
  }

  const html = `<!doctype html>
<html lang="he" dir="rtl">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>סמלי מועדונים — בדיקה</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0b1220; color: #e8eefc; margin: 0; padding: 20px; }
  h1 { font-size: 20px; }
  h2 { font-size: 15px; margin: 28px 0 10px; color: #d69e2e; }
  h2 small, figcaption small { color: #8ea0c0; font-weight: 400; }
  figcaption small { display: block; font-size: 10px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 10px; }
  figure { margin: 0; background: #111c33; border: 1px solid #1e2c49; border-radius: 10px; padding: 8px; text-align: center; }
  figure.missing { border-color: #7a2b2b; }
  img { width: 56px; height: 56px; object-fit: contain; display: block; margin: 0 auto 6px; }
  .none { width: 56px; height: 56px; margin: 0 auto 6px; display: grid; place-items: center; background: #24314d; border-radius: 8px; font-size: 18px; }
  figcaption { font-size: 11.5px; line-height: 1.3; }
</style>
<h1>סמלי מועדונים — ${withCrest} מתוך ${pack.clubs.length}</h1>
${sections.join('\n')}
</html>`;

  await writeFile(outPath, html, 'utf8');
  console.log(`${withCrest}/${pack.clubs.length} crests -> ${outPath}`);
}

void main();
