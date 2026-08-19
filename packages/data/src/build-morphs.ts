/**
 * The sliders, packed for the phone.
 *
 * MakeHuman's morph targets were released to the public domain alongside its base mesh:
 * one file per direction of one feature, listing only the vertices it moves and by how
 * much. That is exactly the vocabulary a face needs - a wider nose, a fuller lip, a
 * heavier jaw - and it is what turns a body you can dress into a person you can build.
 *
 * Each slider here is a pair of targets, one either way from the neutral face, plus the
 * mirrored halves where MakeHuman authors a feature per side. They are fetched once,
 * quantised to sixteen bits and written into a single binary the app reads in one go.
 *
 *   tsx src/build-morphs.ts
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cache = join(here, '..', 'raw-human', 'targets');
const outDir = join(here, '..', '..', 'app', 'public', 'models');
const RAW = 'https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data/targets';

/**
 * The sliders the game offers, and the files behind them.
 *
 * `up` is what the slider does at +1 and `down` at -1; a feature MakeHuman authors per
 * side lists both halves, so moving one slider moves both sides of the face together.
 */
const SLIDERS: { id: string; up: string[]; down: string[] }[] = [
  /*
   * The man himself.
   *
   * MakeHuman's base mesh is deliberately neutral - it is the average of everybody, and
   * on screen it reads as a woman. The macro targets are how that neutral body becomes
   * somebody: one per ethnicity, gender and age. These three are the young adult male of
   * each, and the game blends between them.
   */
  { id: 'maleEuropean', up: ['macrodetails/caucasian-male-young'], down: [] },
  { id: 'maleAfrican', up: ['macrodetails/african-male-young'], down: [] },
  { id: 'maleAsian', up: ['macrodetails/asian-male-young'], down: [] },

  { id: 'noseWidth', up: ['nose/nose-scale-horiz-incr'], down: ['nose/nose-scale-horiz-decr'] },
  { id: 'noseLength', up: ['nose/nose-scale-vert-incr'], down: ['nose/nose-scale-vert-decr'] },
  { id: 'noseHump', up: ['nose/nose-hump-incr'], down: ['nose/nose-hump-decr'] },
  { id: 'mouthWidth', up: ['mouth/mouth-scale-horiz-incr'], down: ['mouth/mouth-scale-horiz-decr'] },
  {
    id: 'lips',
    up: ['mouth/mouth-lowerlip-height-incr', 'mouth/mouth-upperlip-height-incr'],
    down: ['mouth/mouth-lowerlip-height-decr', 'mouth/mouth-upperlip-height-decr'],
  },
  { id: 'eyeSize', up: ['eyes/l-eye-scale-incr', 'eyes/r-eye-scale-incr'], down: ['eyes/l-eye-scale-decr', 'eyes/r-eye-scale-decr'] },
  { id: 'eyeOpen', up: ['eyes/l-eye-height2-incr', 'eyes/r-eye-height2-incr'], down: ['eyes/l-eye-height2-decr', 'eyes/r-eye-height2-decr'] },
  { id: 'cheekbones', up: ['cheek/l-cheek-bones-incr', 'cheek/r-cheek-bones-incr'], down: ['cheek/l-cheek-bones-decr', 'cheek/r-cheek-bones-decr'] },
  { id: 'jaw', up: ['chin/chin-bones-incr'], down: ['chin/chin-bones-decr'] },
  { id: 'chin', up: ['chin/chin-prominent-incr'], down: ['chin/chin-prominent-decr'] },
  { id: 'faceFat', up: ['head/head-fat-incr'], down: ['head/head-fat-decr'] },
  { id: 'headWidth', up: ['head/head-scale-horiz-incr'], down: ['head/head-scale-horiz-decr'] },
  {
    id: 'muscle',
    up: ['torso/torso-muscle-pectoral-incr', 'torso/torso-muscle-dorsi-incr', 'armslegs/l-upperarm-muscle-incr', 'armslegs/r-upperarm-muscle-incr', 'armslegs/l-upperleg-muscle-incr', 'armslegs/r-upperleg-muscle-incr'],
    down: ['torso/torso-muscle-pectoral-decr', 'torso/torso-muscle-dorsi-decr', 'armslegs/l-upperarm-muscle-decr', 'armslegs/r-upperarm-muscle-decr', 'armslegs/l-upperleg-muscle-decr', 'armslegs/r-upperleg-muscle-decr'],
  },
  { id: 'shoulders', up: ['torso/torso-vshape-incr'], down: ['torso/torso-vshape-decr'] },
  { id: 'belly', up: ['stomach/stomach-tone-decr', 'stomach/stomach-pregnant-incr'], down: ['stomach/stomach-tone-incr', 'stomach/stomach-pregnant-decr'] },
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One target file, cached on disk so a rerun costs nothing. */
async function target(path: string): Promise<Map<number, [number, number, number]>> {
  const file = join(cache, `${path.replace('/', '__')}.target`);
  let text: string;
  if (existsSync(file)) {
    text = await readFile(file, 'utf8');
  } else {
    await sleep(120);
    const response = await fetch(`${RAW}/${path}.target`, { headers: { 'User-Agent': 'RoadToGloryGame/0.1' } });
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    text = await response.text();
    await writeFile(file, text, 'utf8');
  }

  const deltas = new Map<number, [number, number, number]>();
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const [index, dx, dy, dz] = line.trim().split(/\s+/);
    if (index === undefined) continue;
    deltas.set(Number(index), [Number(dx), Number(dy), Number(dz)]);
  }
  return deltas;
}

async function main(): Promise<void> {
  await mkdir(cache, { recursive: true });

  // The base mesh's own height, so the deltas end up in the same units the app draws in
  // (the mesh was normalised to exactly one unit tall when it was packed).
  const obj = await readFile(join(here, '..', 'raw-human', 'base.obj'), 'utf8');
  let minY = Infinity;
  let maxY = -Infinity;
  for (const line of obj.split('\n')) {
    if (!line.startsWith('v ')) continue;
    const y = Number(line.split(/\s+/)[2]);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const unit = maxY - minY;

  const chunks: Buffer[] = [];
  const meta: { id: string; up: { at: number; count: number }; down: { at: number; count: number } }[] = [];
  let offset = 0;

  /** One direction of one slider: which vertices move, and by how much. */
  const pack = async (files: string[]) => {
    const merged = new Map<number, [number, number, number]>();
    for (const file of files) {
      for (const [index, delta] of await target(file)) {
        const held = merged.get(index) ?? [0, 0, 0];
        merged.set(index, [held[0] + delta[0], held[1] + delta[1], held[2] + delta[2]]);
      }
    }
    // A vertex that does not actually move is not worth eight bytes.
    const moving = [...merged.entries()].filter(([, d]) => Math.abs(d[0]) + Math.abs(d[1]) + Math.abs(d[2]) > 1e-5);
    const indices = new Uint32Array(moving.length);
    // Sixteen bits per axis, scaled: the largest delta in MakeHuman is a couple of units
    // and the mesh is nineteen tall, so a thousandth of a unit is far finer than an eye.
    const values = new Int16Array(moving.length * 3);
    moving.forEach(([index, delta], i) => {
      indices[i] = index;
      values[i * 3] = Math.round((delta[0] / unit) * 20000);
      values[i * 3 + 1] = Math.round((delta[1] / unit) * 20000);
      values[i * 3 + 2] = Math.round((delta[2] / unit) * 20000);
    });
    // Four-byte alignment, or the reader cannot make a Uint32Array of it: sixteen-bit
    // deltas leave an odd half-word behind whenever a target moves an odd number of
    // vertices, and the whole build then fails silently on a RangeError.
    const pad = (indices.byteLength + values.byteLength) % 4;
    chunks.push(Buffer.from(indices.buffer), Buffer.from(values.buffer));
    if (pad !== 0) chunks.push(Buffer.alloc(4 - pad));
    const at = offset;
    offset += indices.byteLength + values.byteLength + (pad === 0 ? 0 : 4 - pad);
    return { at, count: moving.length };
  };

  for (const slider of SLIDERS) {
    const up = await pack(slider.up);
    const down = await pack(slider.down);
    meta.push({ id: slider.id, up, down });
    console.log(`${slider.id.padEnd(12)} +${String(up.count).padStart(5)} vertices  -${String(down.count).padStart(5)}`);
  }

  const bin = Buffer.concat(chunks);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'morphs.bin'), bin);
  await writeFile(
    join(outDir, 'morphs.json'),
    JSON.stringify(
      {
        note: 'MakeHuman morph targets, released CC0 in 2020 by Data Collection AB, Joel Palmius and Jonas Hauquier.',
        scale: 20000,
        sliders: meta,
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(`\nmorphs.bin: ${(bin.length / 1024).toFixed(0)}KB across ${SLIDERS.length} sliders`);
}

void main();
