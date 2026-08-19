import * as THREE from 'three';
import { EYE_COLOURS, HAIR_COLOURS, SKIN_TONES, type AvatarLook } from '@fc/engine';

/**
 * A footballer, built out of shapes.
 *
 * Nothing here is downloaded: every part is generated from a handful of primitives at
 * load time, so the whole character costs no assets, works offline the moment the app
 * does, and can be changed by moving a number rather than by redrawing a model.
 *
 * The proportions are deliberately stylised - a big head, simple hands, a kit rather
 * than clothing - because a phone-sized figure that reads instantly beats an accurate
 * one that reads as a smudge.
 */

export interface KitColours {
  shirt: string;
  shorts: string;
  socks: string;
  number?: number;
}

const BUILD: Record<AvatarLook['build'], { chest: number; waist: number; limb: number }> = {
  slight: { chest: 0.82, waist: 0.78, limb: 0.82 },
  lean: { chest: 0.92, waist: 0.86, limb: 0.9 },
  athletic: { chest: 1, waist: 0.94, limb: 1 },
  strong: { chest: 1.12, waist: 1.04, limb: 1.12 },
  heavy: { chest: 1.22, waist: 1.2, limb: 1.18 },
};

const LIMB: Record<AvatarLook['limbs'], number> = { short: 0.9, normal: 1, long: 1.12 };

const matte = (colour: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color: new THREE.Color(colour), roughness: 0.85, metalness: 0.02, ...extra });

const shiny = (colour: string) =>
  new THREE.MeshStandardMaterial({ color: new THREE.Color(colour), roughness: 0.25, metalness: 0.85 });

/** A rounded box, which is what almost every part of a stylised body actually is. */
function rounded(width: number, height: number, depth: number, material: THREE.Material): THREE.Mesh {
  const geometry = new THREE.CapsuleGeometry(Math.min(width, depth) / 2, Math.max(0.001, height - Math.min(width, depth)), 6, 12);
  geometry.scale(1, 1, depth / Math.min(width, depth));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  return mesh;
}

function sphere(radius: number, material: THREE.Material, segments = 20): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, segments), material);
  mesh.castShadow = true;
  return mesh;
}

/**
 * The whole figure, standing on the origin, roughly two units tall at 180cm.
 */
export function buildAvatar(look: AvatarLook, heightCm: number, kit: KitColours): THREE.Group {
  const group = new THREE.Group();
  const build = BUILD[look.build];
  const limbScale = LIMB[look.limbs];
  const skin = matte(SKIN_TONES[look.skin] ?? SKIN_TONES[2]!);
  const hairColour = HAIR_COLOURS[look.hairColour] ?? HAIR_COLOURS[0]!;
  const hairMat = matte(hairColour);
  const shirt = matte(kit.shirt);
  const shorts = matte(kit.shorts);
  const socks = matte(kit.socks);
  const boots = matte('#15181d', { roughness: 0.5 });

  // Everything below is in units where an average man is 1.8 tall, then scaled at the
  // end, so the numbers read as metres and a tall player is genuinely taller.
  const legLength = 0.82 * limbScale;
  const torsoHeight = 0.62;
  const headRadius = 0.135;

  // Legs, from the ground up.
  for (const side of [-1, 1]) {
    const thigh = rounded(0.17 * build.limb, legLength * 0.55, 0.17 * build.limb, skin);
    thigh.position.set(side * 0.1, legLength * 0.72, 0);
    group.add(thigh);

    const shin = rounded(0.14 * build.limb, legLength * 0.5, 0.14 * build.limb, socks);
    shin.position.set(side * 0.1, legLength * 0.28, 0);
    group.add(shin);

    const boot = rounded(0.15, 0.1, 0.3, boots);
    boot.position.set(side * 0.1, 0.05, 0.05);
    group.add(boot);
  }

  // Shorts over the top of the thighs.
  const shortsMesh = rounded(0.42 * build.waist, 0.3, 0.26 * build.waist, shorts);
  shortsMesh.position.set(0, legLength + 0.02, 0);
  group.add(shortsMesh);

  // Torso.
  const torso = rounded(0.44 * build.chest, torsoHeight, 0.28 * build.chest, shirt);
  torso.position.set(0, legLength + torsoHeight * 0.5 + 0.06, 0);
  group.add(torso);

  // Arms: sleeve first, then the skin below it.
  const shoulderY = legLength + torsoHeight - 0.02;
  const armLength = 0.66 * limbScale;
  for (const side of [-1, 1]) {
    const sleeveLength = look.sleeves === 'long' ? armLength * 0.62 : armLength * 0.3;
    const sleeve = rounded(0.13 * build.limb, sleeveLength, 0.13 * build.limb, shirt);
    sleeve.position.set(side * (0.235 * build.chest), shoulderY - sleeveLength * 0.5, 0);
    sleeve.rotation.z = side * 0.08;
    group.add(sleeve);

    const bare = rounded(0.115 * build.limb, armLength - sleeveLength, 0.115 * build.limb, skin);
    bare.position.set(side * (0.245 * build.chest), shoulderY - sleeveLength - (armLength - sleeveLength) * 0.5, 0);
    bare.rotation.z = side * 0.08;
    group.add(bare);

    const hand = sphere(0.07, skin, 14);
    hand.position.set(side * (0.26 * build.chest), shoulderY - armLength - 0.02, 0);
    group.add(hand);

    if (look.bracelet && side === 1) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 8, 20), shiny('#d9c27a'));
      band.rotation.x = Math.PI / 2;
      band.position.set(side * (0.26 * build.chest), shoulderY - armLength + 0.06, 0);
      group.add(band);
    }
  }

  // Neck and head.
  const neck = rounded(0.13, 0.12, 0.13, skin);
  neck.position.set(0, shoulderY + 0.06, 0);
  group.add(neck);

  const head = new THREE.Group();
  head.position.set(0, shoulderY + 0.12 + headRadius, 0);
  group.add(head);

  const skull = sphere(headRadius, skin, 24);
  skull.scale.set(1, 1.12, 0.95);
  head.add(skull);

  for (const side of [-1, 1]) {
    const ear = sphere(0.035, skin, 12);
    ear.scale.set(0.6, 1, 0.5);
    ear.position.set(side * (headRadius * 0.96), 0, 0);
    head.add(ear);

    if (look.earring && side === 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 8, 16), shiny('#e8d48a'));
      ring.position.set(side * (headRadius * 0.98), -0.04, 0);
      head.add(ring);
    }
  }

  addFace(head, look, headRadius, skin);
  addHair(head, look, headRadius, hairMat);

  if (look.necklace) {
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 8, 24), shiny('#e8d48a'));
    chain.rotation.x = Math.PI / 2;
    chain.position.set(0, shoulderY + 0.02, 0.02);
    group.add(chain);
  }

  // A tall man is taller. 180cm is the yardstick the proportions were drawn at.
  const scale = heightCm / 180;
  group.scale.setScalar(scale);
  return group;
}

/** Eyes, brows, nose and mouth: the four things that make one face different from another. */
function addFace(head: THREE.Group, look: AvatarLook, r: number, skin: THREE.Material): void {
  const white = matte('#f6f6f6');
  const iris = matte(EYE_COLOURS[look.eyeColour] ?? EYE_COLOURS[0]!);
  const dark = matte('#1a1a1a');

  const eyeShape = look.eyes;
  const eyeScaleY = eyeShape === 'narrow' ? 0.55 : eyeShape === 'wide' ? 1.15 : 0.85;
  const eyeSpread = eyeShape === 'wide' ? 0.062 : 0.055;

  for (const side of [-1, 1]) {
    const eye = sphere(0.027, white, 14);
    eye.scale.set(1, eyeScaleY, 0.6);
    eye.position.set(side * eyeSpread, 0.02, r * 0.9);
    head.add(eye);

    const pupil = sphere(0.014, iris, 12);
    pupil.scale.set(1, Math.max(0.7, eyeScaleY), 0.5);
    pupil.position.set(side * eyeSpread, 0.02, r * 0.94);
    head.add(pupil);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.02), dark);
    brow.position.set(side * eyeSpread, 0.062, r * 0.9);
    brow.rotation.z = side * 0.08;
    head.add(brow);
  }

  const noseSize: Record<AvatarLook['nose'], [number, number, number]> = {
    small: [0.028, 0.045, 0.03],
    straight: [0.032, 0.06, 0.042],
    wide: [0.05, 0.055, 0.04],
    hooked: [0.03, 0.075, 0.05],
  };
  const [nw, nh, nd] = noseSize[look.nose];
  const nose = new THREE.Mesh(new THREE.BoxGeometry(nw, nh, nd), skin);
  nose.position.set(0, -0.012, r * 0.93);
  if (look.nose === 'hooked') nose.rotation.x = -0.25;
  head.add(nose);

  const mouthSize: Record<AvatarLook['mouth'], [number, number]> = {
    thin: [0.06, 0.008],
    even: [0.07, 0.014],
    full: [0.078, 0.022],
  };
  const [mw, mh] = mouthSize[look.mouth];
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(mw, mh, 0.02), matte('#8c4a45'));
  mouth.position.set(0, -0.075, r * 0.9);
  head.add(mouth);

  addFacialHair(head, look, r);
}

function addFacialHair(head: THREE.Group, look: AvatarLook, r: number): void {
  if (look.facialHair === 'none') return;
  const colour = HAIR_COLOURS[look.hairColour] ?? HAIR_COLOURS[0]!;
  const hair = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colour),
    roughness: 0.95,
    transparent: look.facialHair === 'stubble',
    opacity: look.facialHair === 'stubble' ? 0.55 : 1,
  });

  const moustache = () => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.016, 0.02), hair);
    m.position.set(0, -0.052, r * 0.91);
    head.add(m);
  };
  const chin = (width: number, height: number) => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.05), hair);
    c.position.set(0, -0.105, r * 0.78);
    head.add(c);
  };
  const jaw = () => {
    const j = sphere(r * 0.98, hair, 20);
    j.scale.set(1, 0.72, 0.95);
    j.position.set(0, -0.055, -0.005);
    head.add(j);
    // The face itself is cut back out of it, so it reads as hair on the jaw rather than
    // a mask over the whole head.
    const cut = sphere(r * 0.93, new THREE.MeshStandardMaterial({ color: 0x000000, visible: false }), 12);
    cut.position.set(0, 0.05, 0.03);
    head.add(cut);
  };

  switch (look.facialHair) {
    case 'stubble': jaw(); break;
    case 'moustache': moustache(); break;
    case 'goatee': moustache(); chin(0.05, 0.07); break;
    case 'beard': chin(0.11, 0.09); moustache(); break;
    case 'full': jaw(); moustache(); chin(0.12, 0.1); break;
  }
}

function addHair(head: THREE.Group, look: AvatarLook, r: number, hair: THREE.Material): void {
  if (look.hair === 'bald') return;

  const cap = (radius: number, squashY: number, lift: number) => {
    const mesh = sphere(radius, hair, 22);
    mesh.scale.set(1, squashY, 0.98);
    mesh.position.set(0, lift, -0.005);
    head.add(mesh);
  };

  switch (look.hair) {
    case 'buzz': cap(r * 1.02, 1.05, 0.012); break;
    case 'short': cap(r * 1.06, 1.02, 0.022); break;
    case 'crop': {
      cap(r * 1.05, 0.95, 0.03);
      const front = new THREE.Mesh(new THREE.BoxGeometry(r * 1.5, 0.03, 0.04), hair);
      front.position.set(0, r * 0.72, r * 0.72);
      head.add(front);
      break;
    }
    case 'curls': {
      cap(r * 1.04, 1.0, 0.03);
      for (let i = 0; i < 10; i++) {
        const curl = sphere(0.032, hair, 10);
        const angle = (i / 10) * Math.PI * 2;
        curl.position.set(Math.cos(angle) * r * 0.85, r * 0.55 + Math.sin(angle) * 0.03, Math.sin(angle) * r * 0.7);
        head.add(curl);
      }
      break;
    }
    case 'afro': {
      const puff = sphere(r * 1.42, hair, 20);
      puff.scale.set(1, 0.95, 1);
      puff.position.set(0, r * 0.32, -0.01);
      head.add(puff);
      break;
    }
    case 'long': {
      cap(r * 1.06, 1.0, 0.02);
      const fall = rounded(r * 1.9, 0.3, r * 1.5, hair);
      fall.position.set(0, -0.05, -r * 0.35);
      head.add(fall);
      break;
    }
    case 'bun': {
      cap(r * 1.04, 1.0, 0.02);
      const bun = sphere(0.06, hair, 14);
      bun.position.set(0, r * 0.55, -r * 1.0);
      head.add(bun);
      break;
    }
  }
}
