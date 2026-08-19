/**
 * What he looks like.
 *
 * A career is his, and for eighteen seasons the only thing on screen that is supposed to
 * be him is a shirt number. This is the rest: the face he picked, the build he was given
 * and the things he chose to wear, kept as plain data in the save so it survives an
 * update and can be drawn by anything that knows how.
 *
 * Deliberately a small vocabulary rather than sliders on everything. A handful of noses
 * that read as different noses beats a hundred that do not.
 */

export type HairStyle = 'bald' | 'buzz' | 'short' | 'crop' | 'curls' | 'afro' | 'long' | 'bun';
export type FacialHair = 'none' | 'stubble' | 'moustache' | 'goatee' | 'beard' | 'full';
export type EyeShape = 'round' | 'narrow' | 'wide';
export type NoseShape = 'small' | 'straight' | 'wide' | 'hooked';
export type MouthShape = 'thin' | 'even' | 'full';
export type BuildShape = 'slight' | 'lean' | 'athletic' | 'strong' | 'heavy';
export type LimbLength = 'short' | 'normal' | 'long';
export type SleeveLength = 'short' | 'long';
export type Heritage = 'european' | 'african' | 'asian';

export const HERITAGES: readonly Heritage[] = ['european', 'african', 'asian'];

/**
 * The sliders the face and body are actually shaped by.
 *
 * Each runs from -1 to 1 with 0 as the face MakeHuman ships, and each is a pair of that
 * project's own morph targets. The named shapes above - a wide nose, narrow eyes - are
 * starting points that write into these; the sliders are what the mesh reads.
 */
export type ShapeSlider =
  | 'noseWidth' | 'noseLength' | 'noseHump'
  | 'mouthWidth' | 'lips'
  | 'eyeSize' | 'eyeOpen'
  | 'cheekbones' | 'jaw' | 'chin' | 'faceFat' | 'headWidth'
  | 'muscle' | 'shoulders' | 'belly';

export const FACE_SLIDERS: readonly ShapeSlider[] = [
  'headWidth', 'faceFat', 'cheekbones', 'jaw', 'chin',
  'eyeSize', 'eyeOpen', 'noseWidth', 'noseLength', 'noseHump', 'mouthWidth', 'lips',
];

export const BODY_SLIDERS: readonly ShapeSlider[] = ['muscle', 'shoulders', 'belly'];

export interface AvatarLook {
  /** Index into SKIN_TONES. */
  skin: number;
  hair: HairStyle;
  /** Index into HAIR_COLOURS. */
  hairColour: number;
  facialHair: FacialHair;
  /** Index into EYE_COLOURS. */
  eyeColour: number;
  eyes: EyeShape;
  nose: NoseShape;
  mouth: MouthShape;
  build: BuildShape;
  limbs: LimbLength;
  sleeves: SleeveLength;
  earring: boolean;
  necklace: boolean;
  bracelet: boolean;
  /**
   * Which of MakeHuman's macro bodies he is built from. The base mesh is the average of
   * everybody and reads as a woman on screen; this is what makes him a man, and it
   * carries the face of that heritage with it.
   */
  heritage?: Heritage;
  /** Slider values, -1 to 1. Anything missing is the face as it comes. */
  shape?: Partial<Record<ShapeSlider, number>>;
}

/** Skin, from the palest to the darkest, evenly spaced so a slider feels even. */
export const SKIN_TONES = [
  '#f3d3bd', '#eec2a4', '#e0a880', '#c98b5f', '#a86b41', '#82502f', '#5d3a22', '#3f2717',
];

export const HAIR_COLOURS = [
  '#101010', '#2b1d16', '#4a2f1d', '#6f4423', '#8d5a2b', '#b07a3c', '#d8b25e', '#e8dcc8',
  '#9a9a9a', '#d9d9d9', '#a32020', '#2f6fb5',
];

export const EYE_COLOURS = ['#4a2c17', '#6b4423', '#2f6f4f', '#3a6ea5', '#6a8fa8', '#5b5b5b'];

export const HAIR_STYLES: readonly HairStyle[] = ['bald', 'buzz', 'short', 'crop', 'curls', 'afro', 'long', 'bun'];
export const FACIAL_HAIRS: readonly FacialHair[] = ['none', 'stubble', 'moustache', 'goatee', 'beard', 'full'];
export const EYE_SHAPES: readonly EyeShape[] = ['round', 'narrow', 'wide'];
export const NOSE_SHAPES: readonly NoseShape[] = ['small', 'straight', 'wide', 'hooked'];
export const MOUTH_SHAPES: readonly MouthShape[] = ['thin', 'even', 'full'];
export const BUILD_SHAPES: readonly BuildShape[] = ['slight', 'lean', 'athletic', 'strong', 'heavy'];
export const LIMB_LENGTHS: readonly LimbLength[] = ['short', 'normal', 'long'];

/**
 * What the named choices mean in slider terms.
 *
 * Picking "wide" for a nose is a starting point rather than a separate system: it writes
 * the sliders, and moving a slider afterwards is refining the same face.
 */
export function shapeFromChoices(look: AvatarLook): Partial<Record<ShapeSlider, number>> {
  const base: Partial<Record<ShapeSlider, number>> = {};
  if (look.nose === 'small') { base.noseWidth = -0.55; base.noseLength = -0.5; }
  if (look.nose === 'wide') base.noseWidth = 0.75;
  if (look.nose === 'hooked') { base.noseHump = 0.85; base.noseLength = 0.35; }
  if (look.mouth === 'thin') base.lips = -0.6;
  if (look.mouth === 'full') { base.lips = 0.75; base.mouthWidth = 0.2; }
  if (look.eyes === 'narrow') base.eyeOpen = -0.7;
  if (look.eyes === 'wide') { base.eyeOpen = 0.6; base.eyeSize = 0.35; }
  if (look.build === 'slight') { base.muscle = -0.65; base.shoulders = -0.4; base.belly = -0.3; }
  if (look.build === 'lean') { base.muscle = -0.25; base.shoulders = -0.1; }
  if (look.build === 'strong') { base.muscle = 0.6; base.shoulders = 0.45; }
  if (look.build === 'heavy') { base.muscle = 0.2; base.belly = 0.8; base.shoulders = 0.15; }
  return { ...base, ...(look.shape ?? {}) };
}

export function defaultLook(): AvatarLook {
  return {
    skin: 2,
    heritage: 'european',
    hair: 'short',
    hairColour: 1,
    facialHair: 'none',
    eyeColour: 0,
    eyes: 'round',
    nose: 'straight',
    mouth: 'even',
    build: 'athletic',
    limbs: 'normal',
    sleeves: 'short',
    earring: false,
    necklace: false,
    bracelet: false,
  };
}

/** A look for somebody the player did not make: varied, and stable for a given id. */
export function lookFromSeed(seed: string): AvatarLook {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const pick = (n: number, salt: number) => {
    const x = Math.imul(h ^ (salt * 2654435761), 2246822519);
    return Math.abs(x >>> 0) % n;
  };
  const heritages = HERITAGES;
  return {
    skin: pick(SKIN_TONES.length, 1),
    heritage: heritages[pick(heritages.length, 15)]!,
    hair: HAIR_STYLES[pick(HAIR_STYLES.length, 2)]!,
    hairColour: pick(HAIR_COLOURS.length, 3),
    facialHair: FACIAL_HAIRS[pick(FACIAL_HAIRS.length, 4)]!,
    eyeColour: pick(EYE_COLOURS.length, 5),
    eyes: EYE_SHAPES[pick(EYE_SHAPES.length, 6)]!,
    nose: NOSE_SHAPES[pick(NOSE_SHAPES.length, 7)]!,
    mouth: MOUTH_SHAPES[pick(MOUTH_SHAPES.length, 8)]!,
    build: BUILD_SHAPES[pick(BUILD_SHAPES.length, 9)]!,
    limbs: LIMB_LENGTHS[pick(LIMB_LENGTHS.length, 10)]!,
    sleeves: pick(2, 11) === 0 ? 'short' : 'long',
    earring: pick(4, 12) === 0,
    necklace: pick(5, 13) === 0,
    bracelet: pick(4, 14) === 0,
  };
}
