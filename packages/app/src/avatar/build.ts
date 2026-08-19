import * as THREE from 'three';
import { HAIR_COLOURS, type AvatarLook } from '@fc/engine';

/**
 * Everything the body itself does not carry: hair, a beard, and what he wears.
 *
 * The body is a real human mesh with a face already on it, so nothing here draws eyes or
 * a nose. These are the parts a person chooses rather than is born with, sized in the
 * mesh's own units - the body is exactly one unit tall, so 0.05 is five per cent of a
 * man, which happens to be about the width of a head.
 */

export interface KitColours {
  shirt: string;
  shorts: string;
  socks: string;
  number?: number;
}

/** Where the head sits on the base mesh, measured off it once. */
const HEAD = { y: 0.925, z: 0.012, r: 0.052 };
const WRIST = { y: 0.545, x: 0.205 };

const matte = (colour: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color: new THREE.Color(colour), roughness: 0.88, metalness: 0.02, ...extra });

const shiny = (colour: string) =>
  new THREE.MeshStandardMaterial({ color: new THREE.Color(colour), roughness: 0.22, metalness: 0.9 });

function sphere(radius: number, material: THREE.Material, segments = 22): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, segments), material);
  mesh.castShadow = true;
  return mesh;
}

/** Hair, a beard and jewellery, added to a body that already has a face. */
export function addFeatures(group: THREE.Group, look: AvatarLook): void {
  const colour = HAIR_COLOURS[look.hairColour] ?? HAIR_COLOURS[0]!;
  const hair = matte(colour, { roughness: 0.95 });

  addHair(group, look, hair);
  addFacialHair(group, look, colour);

  if (look.earring) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.0022, 8, 16), shiny('#e8d48a'));
    ring.position.set(HEAD.r * 0.95, HEAD.y - 0.022, HEAD.z);
    group.add(ring);
  }
  if (look.necklace) {
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.037, 0.0035, 8, 26), shiny('#e8d48a'));
    chain.rotation.x = Math.PI / 2 - 0.25;
    chain.position.set(0, 0.845, 0.012);
    group.add(chain);
  }
  if (look.bracelet) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.017, 0.004, 8, 20), shiny('#d9c27a'));
    band.rotation.x = Math.PI / 2;
    band.position.set(WRIST.x, WRIST.y, 0);
    group.add(band);
  }
}

function addHair(group: THREE.Group, look: AvatarLook, hair: THREE.Material): void {
  if (look.hair === 'bald') return;

  /** A skull cap: a sphere cut off below the ears so it sits on the head, not over it. */
  const cap = (grow: number, drop: number) => {
    const geometry = new THREE.SphereGeometry(HEAD.r * (1 + grow), 26, 20, 0, Math.PI * 2, 0, Math.PI * (0.5 + drop));
    const mesh = new THREE.Mesh(geometry, hair);
    mesh.position.set(0, HEAD.y + 0.012, HEAD.z - 0.002);
    mesh.scale.set(1, 1.05, 1.02);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };

  switch (look.hair) {
    case 'buzz': cap(0.02, 0.12); break;
    case 'short': cap(0.06, 0.14); break;
    case 'crop': {
      cap(0.07, 0.1);
      const front = new THREE.Mesh(new THREE.BoxGeometry(HEAD.r * 1.5, 0.012, 0.014), hair);
      front.position.set(0, HEAD.y + 0.05, HEAD.z + HEAD.r * 0.82);
      group.add(front);
      break;
    }
    case 'curls': {
      cap(0.05, 0.1);
      for (let i = 0; i < 14; i++) {
        const curl = sphere(0.013, hair, 10);
        const angle = (i / 14) * Math.PI * 2;
        curl.position.set(
          Math.cos(angle) * HEAD.r * 0.95,
          HEAD.y + 0.04 + Math.sin(angle * 2) * 0.012,
          HEAD.z + Math.sin(angle) * HEAD.r * 0.85,
        );
        group.add(curl);
      }
      break;
    }
    case 'afro': {
      const puff = sphere(HEAD.r * 1.42, hair, 24);
      puff.scale.set(1, 0.96, 1);
      puff.position.set(0, HEAD.y + 0.028, HEAD.z - 0.004);
      group.add(puff);
      break;
    }
    case 'long': {
      cap(0.06, 0.14);
      const fall = new THREE.Mesh(new THREE.CapsuleGeometry(HEAD.r * 0.95, 0.09, 6, 16), hair);
      fall.scale.set(1, 1, 0.65);
      fall.position.set(0, HEAD.y - 0.055, HEAD.z - HEAD.r * 0.5);
      group.add(fall);
      break;
    }
    case 'bun': {
      cap(0.05, 0.12);
      const bun = sphere(0.022, hair, 14);
      bun.position.set(0, HEAD.y + 0.03, HEAD.z - HEAD.r * 1.05);
      group.add(bun);
      break;
    }
  }
}

function addFacialHair(group: THREE.Group, look: AvatarLook, colour: string): void {
  if (look.facialHair === 'none') return;
  const stubble = look.facialHair === 'stubble';
  const hair = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colour),
    roughness: 0.97,
    transparent: stubble,
    opacity: stubble ? 0.5 : 1,
  });

  /** The jaw line: a shell around the lower half of the head, open at the front. */
  const jaw = (thickness: number) => {
    const geometry = new THREE.SphereGeometry(HEAD.r * (1 + thickness), 24, 18, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.34);
    const mesh = new THREE.Mesh(geometry, hair);
    mesh.position.set(0, HEAD.y + 0.006, HEAD.z - 0.002);
    mesh.scale.set(1, 1.15, 1.02);
    group.add(mesh);
  };
  const moustache = () => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.006, 0.008), hair);
    m.position.set(0, HEAD.y - 0.019, HEAD.z + HEAD.r * 0.92);
    group.add(m);
  };
  const chin = (width: number, drop: number) => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(width, drop, 0.018), hair);
    c.position.set(0, HEAD.y - 0.041, HEAD.z + HEAD.r * 0.72);
    group.add(c);
  };

  switch (look.facialHair) {
    case 'stubble': jaw(0.012); break;
    case 'moustache': moustache(); break;
    case 'goatee': moustache(); chin(0.018, 0.026); break;
    case 'beard': jaw(0.02); moustache(); break;
    case 'full': jaw(0.03); moustache(); chin(0.03, 0.03); break;
  }
}
