/**
 * The human being, packed for the phone.
 *
 * MakeHuman's base mesh - hm08, released to the public domain by its authors in 2020 -
 * is a real anatomical human rather than a pile of spheres, which is the difference
 * between a player and a doll. It ships as a 1.7MB text OBJ with nineteen thousand
 * vertices and quads; this turns it into the smallest thing the app can draw: triangles,
 * positions and normals in one binary, with the parts of the body indexed so the game
 * can dress him and shape him without a modelling tool.
 *
 *   tsx src/build-human.ts
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, '..', 'raw-human', 'base.obj');
const outDir = join(here, '..', '..', 'app', 'public', 'models');

interface Group {
  name: string;
  /** Triangle range in the index buffer: [start, count]. */
  range: [number, number];
}

async function main(): Promise<void> {
  const text = await readFile(source, 'utf8');

  const positions: number[] = [];
  const triangles: number[] = [];
  const groups: Group[] = [];
  let current: { name: string; start: number } | null = null;

  for (const line of text.split('\n')) {
    if (line.startsWith('v ')) {
      const [, x, y, z] = line.split(/\s+/);
      positions.push(Number(x), Number(y), Number(z));
      continue;
    }
    if (line.startsWith('g ')) {
      // The mesh is grouped by body part - "head", "torso", "l-upperarm" and so on -
      // which is exactly what is needed to put a shirt on him or shape one limb.
      if (current) groups.push({ name: current.name, range: [current.start, triangles.length / 3 - current.start] });
      current = { name: line.slice(2).trim(), start: triangles.length / 3 };
      continue;
    }
    if (line.startsWith('f ')) {
      // MakeHuman ships helper geometry inside the same mesh - invisible cages the
      // modelling tool uses to fit clothes and rig joints. A quarter of the triangles
      // are those, and none of them are him.
      if (current && (current.name.startsWith('helper') || current.name.startsWith('joint'))) continue;
      // Faces are quads or triangles, written as v/vt/vn. Only the vertex index matters
      // here: normals are recomputed, and the UVs belong to a texture we do not ship.
      const corners = line
        .slice(2)
        .trim()
        .split(/\s+/)
        .map((corner) => Number(corner.split('/')[0]) - 1);
      for (let i = 1; i + 1 < corners.length; i++) {
        triangles.push(corners[0]!, corners[i]!, corners[i + 1]!);
      }
    }
  }
  if (current) groups.push({ name: current.name, range: [current.start, triangles.length / 3 - current.start] });

  // Centred on the origin, feet on the floor, and scaled so he is exactly one unit tall.
  // The game then scales him by the height it wants in metres.
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i]!); maxX = Math.max(maxX, positions[i]!);
    minY = Math.min(minY, positions[i + 1]!); maxY = Math.max(maxY, positions[i + 1]!);
    minZ = Math.min(minZ, positions[i + 2]!); maxZ = Math.max(maxZ, positions[i + 2]!);
  }
  const height = maxY - minY;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (positions[i]! - cx) / height;
    positions[i + 1] = (positions[i + 1]! - minY) / height;
    positions[i + 2] = (positions[i + 2]! - cz) / height;
  }

  const position = new Float32Array(positions);
  const index = new Uint32Array(triangles);

  // Smooth normals, averaged over every triangle a vertex belongs to. Done here so the
  // phone never has to.
  const normal = new Float32Array(position.length);
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t]! * 3, b = index[t + 1]! * 3, c = index[t + 2]! * 3;
    const ux = position[b]! - position[a]!, uy = position[b + 1]! - position[a + 1]!, uz = position[b + 2]! - position[a + 2]!;
    const vx = position[c]! - position[a]!, vy = position[c + 1]! - position[a + 1]!, vz = position[c + 2]! - position[a + 2]!;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const at of [a, b, c]) {
      normal[at] += nx; normal[at + 1] += ny; normal[at + 2] += nz;
    }
  }
  for (let i = 0; i < normal.length; i += 3) {
    const len = Math.hypot(normal[i]!, normal[i + 1]!, normal[i + 2]!) || 1;
    normal[i] /= len; normal[i + 1] /= len; normal[i + 2] /= len;
  }

  await mkdir(outDir, { recursive: true });
  const bin = Buffer.concat([Buffer.from(position.buffer), Buffer.from(normal.buffer), Buffer.from(index.buffer)]);
  await writeFile(join(outDir, 'human.bin'), bin);
  await writeFile(
    join(outDir, 'human.json'),
    JSON.stringify(
      {
        note: 'MakeHuman base mesh hm08, released CC0 in 2020 by Data Collection AB, Joel Palmius and Jonas Hauquier.',
        vertices: position.length / 3,
        triangles: index.length / 3,
        layout: { position: [0, position.length], normal: [position.length, normal.length], index: [position.length + normal.length, index.length] },
        groups,
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log(
    `human.bin: ${(bin.length / 1024).toFixed(0)}KB — ${position.length / 3} vertices, ${index.length / 3} triangles, ${groups.length} body parts`,
  );
  console.log('parts:', groups.map((g) => g.name).slice(0, 12).join(', '), '…');
}

void main();
