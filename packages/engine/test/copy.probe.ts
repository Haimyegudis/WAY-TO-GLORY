/** Which event outcomes have no line written for them, and how often do they fire? */
import { readFileSync } from 'node:fs';
import { EVENTS } from '../src/events.js';

const he = readFileSync('../app/src/i18n/he.ts', 'utf8');
const en = readFileSync('../app/src/i18n/en.ts', 'utf8');
const has = (dict: string, key: string) => dict.includes(`'${key}'`);

let total = 0;
const missing: string[] = [];
for (const event of EVENTS) {
  for (const option of event.options) {
    const key = `event.${event.id}.${option.id}.outcome`;
    total++;
    if (!has(he, key) || !has(en, key)) missing.push(key);
  }
}
console.log(`${missing.length} of ${total} outcome lines unwritten`);
console.log(missing.join('\n'));
