import * as THREE from 'three';
import { SKIN_TONES, shapeFromChoices, type AvatarLook, type ShapeSlider } from '@fc/engine';
import { addFeatures, type HeadFrame, type KitColours } from './build.js';

/**
 * The player, on a real human body.
 *
 * The figure used to be spheres and capsules stuck together, which reads as a toy. This
 * loads MakeHuman's base mesh - a proper anatomical human, released to the public domain
 * by its authors in 2020 - packed down to one binary of positions, normals and triangles.
 *
 * On top of it the game does three things a modelling tool would normally do: it shapes
 * him (height, build and limb length, applied to the vertices themselves), it dresses him
 * (a shirt and shorts made by pushing a copy of his own skin outward, so the kit fits the
 * body it is on rather than floating over it), and it gives him hair.
 */

let cached: Promise<{ position: Float32Array; normal: Float32Array; index: Uint32Array }> | null = null;

async function loadHuman(): Promise<{ position: Float32Array; normal: Float32Array; index: Uint32Array }> {
  cached ??= (async () => {
    const [meta, bin] = await Promise.all([
      fetch('/models/human.json').then((r) => r.json()),
      fetch('/models/human.bin').then((r) => r.arrayBuffer()),
    ]);
    const layout = meta.layout as { position: [number, number]; normal: [number, number]; index: [number, number] };
    return {
      position: new Float32Array(bin, layout.position[0] * 4, layout.position[1]),
      normal: new Float32Array(bin, layout.normal[0] * 4, layout.normal[1]),
      index: new Uint32Array(bin, layout.index[0] * 4, layout.index[1]),
    };
  })();
  return cached;
}

interface Morphs {
  scale: number;
  sliders: Record<string, { up: { at: number; count: number }; down: { at: number; count: number } }>;
  data: ArrayBuffer;
}

let morphCache: Promise<Morphs> | null = null;

/**
 * The sliders themselves: which vertices each direction of each feature moves, and by
 * how much, quantised to sixteen bits.
 */
async function loadMorphs(): Promise<Morphs> {
  morphCache ??= (async () => {
    const [meta, data] = await Promise.all([
      fetch('/models/morphs.json').then((r) => r.json()),
      fetch('/models/morphs.bin').then((r) => r.arrayBuffer()),
    ]);
    const sliders: Morphs['sliders'] = {};
    for (const entry of meta.sliders as { id: string; up: { at: number; count: number }; down: { at: number; count: number } }[]) {
      sliders[entry.id] = { up: entry.up, down: entry.down };
    }
    return { scale: meta.scale as number, sliders, data };
  })();
  return morphCache;
}

/**
 * The face he asked for, applied to the face MakeHuman ships.
 *
 * Every slider is two morph targets, one either way; a value of 0.6 moves six tenths of
 * the way along the "more" one and nothing along the "less" one. This is the same
 * arithmetic MakeHuman does, on the same data, with the deltas unpacked from sixteen bits
 * as they are read.
 */
function applyMorphs(position: Float32Array, morphs: Morphs, values: Record<string, number | undefined>): void {
  for (const [id, raw] of Object.entries(values)) {
    const weight = Math.max(-1, Math.min(1, raw ?? 0));
    if (Math.abs(weight) < 0.01) continue;
    const slider = morphs.sliders[id];
    if (!slider) continue;
    const side = weight > 0 ? slider.up : slider.down;
    if (side.count === 0) continue;

    // Read through a copy rather than a view: a typed array over a buffer has to start
    // on its own alignment, and one misaligned slider used to throw and take the whole
    // figure with it - silently, because the build is asynchronous.
    const indices = new Uint32Array(morphs.data.slice(side.at, side.at + side.count * 4));
    const deltas = new Int16Array(
      morphs.data.slice(side.at + side.count * 4, side.at + side.count * 4 + side.count * 6),
    );
    const amount = Math.abs(weight) / morphs.scale;
    for (let i = 0; i < side.count; i++) {
      const at = indices[i]! * 3;
      position[at] = position[at]! + deltas[i * 3]! * amount;
      position[at + 1] = position[at + 1]! + deltas[i * 3 + 1]! * amount;
      position[at + 2] = position[at + 2]! + deltas[i * 3 + 2]! * amount;
    }
  }
}

/** Where a vertex sits up the body, 0 at the feet and 1 at the crown. */
const height01 = (y: number) => Math.max(0, Math.min(1, y));

const BUILD_WIDTH: Record<AvatarLook['build'], number> = {
  slight: 0.9, lean: 0.95, athletic: 1, strong: 1.08, heavy: 1.17,
};
const BUILD_BELLY: Record<AvatarLook['build'], number> = {
  slight: -0.01, lean: 0, athletic: 0.005, strong: 0.02, heavy: 0.05,
};
const LIMB_STRETCH: Record<AvatarLook['limbs'], number> = { short: -0.04, normal: 0, long: 0.05 };

/**
 * His body, shaped.
 *
 * MakeHuman does this with thousands of authored morph targets; this does the same job
 * with three honest rules - wider or narrower across the shoulders and chest, more or
 * less around the middle, and longer or shorter in the legs - applied to the vertices
 * before anything is drawn. It is not a sculpting tool, and it does not need to be: it
 * has to make one man look different from the next.
 */
function shape(base: Float32Array, look: AvatarLook): Float32Array {
  const out = new Float32Array(base.length);
  const width = BUILD_WIDTH[look.build];
  const belly = BUILD_BELLY[look.build];
  const stretch = LIMB_STRETCH[look.limbs];

  for (let i = 0; i < base.length; i += 3) {
    const x = base[i]!;
    const y = base[i + 1]!;
    const z = base[i + 2]!;
    const up = height01(y);

    // The torso carries the build; the head and the feet are left alone.
    const torso = Math.max(0, Math.min(1, (up - 0.42) / 0.32));
    const chest = 1 + (width - 1) * torso;
    // A heavier man is heavier around the middle, and it sits at the front.
    const waist = Math.max(0, 1 - Math.abs(up - 0.55) / 0.14);

    // Legs stretch below the hip, and everything above them rides up with the change.
    const leg = up < 0.47 ? up / 0.47 : 1;

    out[i] = x * chest;
    out[i + 1] = y + stretch * leg;
    out[i + 2] = z * chest + belly * waist * (z > 0 ? 1 : 0.3);
  }
  return out;
}

function recomputeNormals(position: Float32Array, index: Uint32Array): Float32Array {
  const normal = new Float32Array(position.length);
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t]! * 3, b = index[t + 1]! * 3, c = index[t + 2]! * 3;
    const ux = position[b]! - position[a]!, uy = position[b + 1]! - position[a + 1]!, uz = position[b + 2]! - position[a + 2]!;
    const vx = position[c]! - position[a]!, vy = position[c + 1]! - position[a + 1]!, vz = position[c + 2]! - position[a + 2]!;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const at of [a, b, c]) {
      normal[at] = (normal[at] ?? 0) + nx;
      normal[at + 1] = (normal[at + 1] ?? 0) + ny;
      normal[at + 2] = (normal[at + 2] ?? 0) + nz;
    }
  }
  for (let i = 0; i < normal.length; i += 3) {
    const len = Math.hypot(normal[i]!, normal[i + 1]!, normal[i + 2]!) || 1;
    normal[i] = normal[i]! / len;
    normal[i + 1] = normal[i + 1]! / len;
    normal[i + 2] = normal[i + 2]! / len;
  }
  return normal;
}

/**
 * A garment, made from the body it is worn on.
 *
 * The skin is copied, pushed a few millimetres along its own normals and cut down to the
 * band of the body the garment covers. A shirt made this way is the shape of the man
 * inside it, which is the one thing that stops clothing looking stuck on.
 */
function garment(
  position: Float32Array,
  normal: Float32Array,
  index: Uint32Array,
  covers: (x: number, y: number, z: number) => boolean,
  puff: number,
  material: THREE.Material,
): THREE.Mesh | null {
  const keep: number[] = [];
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t]!, b = index[t + 1]!, c = index[t + 2]!;
    // A triangle is covered when its middle is: cutting per vertex leaves holes along
    // the hem, and a hem with holes in it is worse than a hem in the wrong place.
    const x = (position[a * 3]! + position[b * 3]! + position[c * 3]!) / 3;
    const y = (position[a * 3 + 1]! + position[b * 3 + 1]! + position[c * 3 + 1]!) / 3;
    const z = (position[a * 3 + 2]! + position[b * 3 + 2]! + position[c * 3 + 2]!) / 3;
    if (covers(x, y, z)) keep.push(a, b, c);
  }
  if (keep.length === 0) return null;

  const grown = new Float32Array(position.length);
  for (let i = 0; i < position.length; i += 3) {
    grown[i] = position[i]! + normal[i]! * puff;
    grown[i + 1] = position[i + 1]! + normal[i + 1]! * puff;
    grown[i + 2] = position[i + 2]! + normal[i + 2]! * puff;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(grown, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geometry.setIndex(keep);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  return mesh;
}

const matte = (colour: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color: new THREE.Color(colour), roughness: 0.82, metalness: 0.02, ...extra });

/** Skin, which is not a plastic ball: a little sheen and a little softness. */
const skinMaterial = (colour: string) =>
  new THREE.MeshStandardMaterial({
    color: new THREE.Color(colour),
    roughness: 0.62,
    metalness: 0,
    // A hint of the light that goes into skin and comes back out of it.
    emissive: new THREE.Color(colour).multiplyScalar(0.06),
  });

/**
 * Where the head ended up, measured off the body that was actually built.
 *
 * Hair, a beard and an earring were hung off three numbers measured by hand on the base
 * mesh, and then the morph targets moved the head - a man is taller and wider in the
 * skull than the average body he is built from - and the hair stayed behind, over his
 * face. So the same slice is boxed on both bodies and the hand-measured numbers are
 * carried across by the difference: the placement stays as it was tuned, on the head it
 * is actually on.
 */
const TUNED = { y: 0.925, z: 0.012, r: 0.052 };

function headBox(position: Float32Array): { y: number; z: number; r: number; top: number } {
  let top = -Infinity;
  for (let i = 1; i < position.length; i += 3) top = Math.max(top, position[i]!);
  const cut = top * 0.865;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < position.length; i += 3) {
    const y = position[i + 1]!;
    if (y < cut) continue;
    minX = Math.min(minX, position[i]!); maxX = Math.max(maxX, position[i]!);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, position[i + 2]!); maxZ = Math.max(maxZ, position[i + 2]!);
  }
  return { y: (minY + maxY) / 2, z: (minZ + maxZ) / 2, r: (maxX - minX) / 2, top };
}

let baseHead: { y: number; z: number; r: number; top: number } | null = null;

function headFrame(base: Float32Array, position: Float32Array): HeadFrame {
  baseHead ??= headBox(base);
  const now = headBox(position);
  return {
    y: TUNED.y + (now.y - baseHead.y),
    z: TUNED.z + (now.z - baseHead.z),
    r: TUNED.r * (now.r / baseHead.r),
    top: now.top,
  };
}

export async function buildHuman(look: AvatarLook, heightCm: number, kit: KitColours): Promise<THREE.Group> {
  const [base, morphs] = await Promise.all([loadHuman(), loadMorphs()]);
  const group = new THREE.Group();

  /*
   * The man first.
   *
   * MakeHuman's base mesh is the average of everybody, and on screen that average reads
   * as a woman: narrow shoulders, soft jaw, no brow. His heritage's young adult male is
   * applied in full before anything else, and every other slider is a change to that
   * man rather than to the neutral body underneath him.
   */
  const morphed = new Float32Array(base.position);
  const heritage = look.heritage ?? 'european';
  const macro = heritage === 'african' ? 'maleAfrican' : heritage === 'asian' ? 'maleAsian' : 'maleEuropean';
  applyMorphs(morphed, morphs, { [macro]: 1 } as Record<string, number>);
  applyMorphs(morphed, morphs, shapeFromChoices(look));
  const position = shape(morphed, look);
  const normal = recomputeNormals(position, base.index);

  const skin = new THREE.BufferGeometry();
  skin.setAttribute('position', new THREE.BufferAttribute(position, 3));
  skin.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  skin.setIndex(Array.from(base.index));
  const body = new THREE.Mesh(skin, skinMaterial(SKIN_TONES[look.skin] ?? SKIN_TONES[2]!));
  body.castShadow = true;
  group.add(body);

  /*
   * The kit, cut to the body.
   *
   * Height alone cannot tell a chest from an arm - they are at the same height - so each
   * garment is a rule over the whole position. That is what makes short sleeves short:
   * the shirt covers the trunk to the waist and the arm only as far as he asked for.
   */
  const trunk = (x: number) => Math.abs(x) < 0.085;
  const sleeveTo = look.sleeves === 'long' ? 0.6 : 0.75;

  const shirt = garment(
    position, normal, base.index,
    (x, y) => (y > 0.615 && y < 0.86 && trunk(x)) || (!trunk(x) && y > sleeveTo && y < 0.86),
    0.006, matte(kit.shirt),
  );
  if (shirt) group.add(shirt);

  const shorts = garment(
    position, normal, base.index,
    (x, y) => y > 0.44 && y <= 0.625 && Math.abs(x) < 0.13,
    0.007, matte(kit.shorts),
  );
  if (shorts) group.add(shorts);

  const socks = garment(
    position, normal, base.index,
    (_x, y) => y > 0.035 && y < 0.235,
    0.006, matte(kit.socks),
  );
  if (socks) group.add(socks);

  const boots = garment(
    position, normal, base.index,
    (_x, y) => y <= 0.035,
    0.009, matte('#15181d', { roughness: 0.42 }),
  );
  if (boots) group.add(boots);

  // Hair, a beard and jewellery, hung off the head this body actually has.
  addFeatures(group, look, headFrame(base.position, position));

  // A tall man is taller: the mesh is exactly one unit high, so this is his height in
  // metres and nothing else has to know about it.
  group.scale.setScalar(heightCm / 100);
  return group;
}
