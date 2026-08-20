import type { AvatarLook, ShapeSlider } from '@fc/engine';
import { EYE_COLOURS, HAIR_COLOURS, SKIN_TONES, shapeFromChoices } from '@fc/engine';
import type { KitColours } from './kit.js';

/**
 * Him, drawn.
 *
 * The figure used to be a real human mesh turned by a finger, and it cost a megabyte and
 * a half of model data, a WebGL context and a frame loop to say one thing: this is what
 * I look like. This says the same thing in vector shapes.
 *
 * Everything below is arithmetic on a handful of numbers - a head is an outline whose
 * width a slider moves, a shoulder is a point two sliders pull apart - so every choice on
 * the creation screen still moves something rather than swapping a picture, and nothing
 * has to be downloaded to see it.
 *
 * The canvas is 200 wide and 420 tall with the floor near the bottom, and every
 * measurement below is in those units. Two framings share one drawing: the whole figure,
 * and the head on its own, which is the same shapes through a smaller window.
 */

/** Slider values, with the named choices ("a wide nose") already folded in. */
type Shape = Partial<Record<ShapeSlider, number>>;

const value = (shape: Shape, key: ShapeSlider) => Math.max(-1, Math.min(1, shape[key] ?? 0));

/** A colour, darkened or lightened, for shadow and highlight without a second palette. */
function shade(hex: string, amount: number): string {
  const at = hex.startsWith('#') ? 1 : 0;
  const channel = (i: number) => {
    const raw = Number.parseInt(hex.slice(at + i * 2, at + i * 2 + 2), 16);
    const moved = amount >= 0 ? raw + (255 - raw) * amount : raw * (1 + amount);
    return Math.max(0, Math.min(255, Math.round(moved)));
  };
  return `rgb(${channel(0)},${channel(1)},${channel(2)})`;
}

const MID = 100;

/**
 * The figure's measurements, worked out once.
 *
 * A build is a width, a height is a leg length, and the sliders move the face and the
 * torso around those. Kept in one place so the drawing below is only shapes.
 */
function measure(look: AvatarLook, heightCm: number) {
  const shape = shapeFromChoices(look) as Shape;

  // How tall he is, as a stretch of the standard figure: a 165cm winger and a 196cm
  // centre half are the same drawing at different lengths.
  const stretch = Math.max(0.92, Math.min(1.08, heightCm / 180));
  const limbs = look.limbs === 'long' ? 1.05 : look.limbs === 'short' ? 0.95 : 1;
  const muscle = value(shape, 'muscle');

  const headW = 44 * (1 + value(shape, 'headWidth') * 0.16);
  const headH = 56;
  const headY = 56;

  const neckY = headY + headH / 2 - 2;
  const shoulderY = neckY + 14;
  const shoulders = 34 + value(shape, 'shoulders') * 8 + muscle * 5;
  const chest = shoulders - 2;
  const waist = 24 + value(shape, 'belly') * 10 + muscle * 2;
  const hip = 26 + value(shape, 'belly') * 5 + muscle;

  const waistY = shoulderY + 62 * stretch;
  const hipY = waistY + 26 * stretch;
  const shortsY = hipY + 34 * stretch;
  const kneeY = hipY + 78 * stretch * limbs;
  const ankleY = kneeY + 74 * stretch * limbs;
  const floorY = ankleY + 10;

  // The arm hangs outside the chest rather than inside its outline, which is where it
  // was hiding: an arm drawn at shoulder width is an arm behind the shirt.
  const armTopX = shoulders - 3;
  const elbowX = shoulders + 9;
  const wristX = shoulders + 12;
  const elbowY = shoulderY + 46 * stretch * limbs;
  const wristY = elbowY + 42 * stretch * limbs;

  return {
    shape, stretch, limbs, muscle,
    headW, headH, headY,
    jaw: value(shape, 'jaw'), chin: value(shape, 'chin'), fat: value(shape, 'faceFat'),
    neckY, shoulderY, shoulders, chest, waist, hip,
    waistY, hipY, shortsY, kneeY, ankleY, floorY,
    armTopX, elbowX, wristX, elbowY, wristY,
    armThickness: 10 + muscle * 3,
  };
}

type Measured = ReturnType<typeof measure>;

/** The head: a rounded skull narrowing to a jaw and a chin. */
function headPath(m: Measured): string {
  const halfW = m.headW / 2;
  const top = m.headY - m.headH / 2;
  const bottom = m.headY + m.headH / 2;
  const cheek = halfW * (1 + m.fat * 0.08);
  const jawW = halfW * (0.72 + m.jaw * 0.18 + m.fat * 0.06);
  const chinDrop = bottom + m.chin * 4;

  return [
    `M ${MID} ${top}`,
    `C ${MID + cheek} ${top} ${MID + cheek} ${m.headY + 4} ${MID + jawW} ${m.headY + 13}`,
    `C ${MID + jawW * 0.9} ${chinDrop - 5} ${MID + jawW * 0.45} ${chinDrop} ${MID} ${chinDrop}`,
    `C ${MID - jawW * 0.45} ${chinDrop} ${MID - jawW * 0.9} ${chinDrop - 5} ${MID - jawW} ${m.headY + 13}`,
    `C ${MID - cheek} ${m.headY + 4} ${MID - cheek} ${top} ${MID} ${top}`,
    'Z',
  ].join(' ');
}

/** The torso, shoulders down to the hips, which is also the shape of the shirt. */
function torsoPath(m: Measured): string {
  return [
    `M ${MID - m.shoulders} ${m.shoulderY}`,
    `C ${MID - m.chest - 1} ${m.shoulderY + 22} ${MID - m.waist - 3} ${m.waistY - 20} ${MID - m.waist} ${m.waistY}`,
    `L ${MID - m.hip} ${m.hipY}`,
    `L ${MID + m.hip} ${m.hipY}`,
    `L ${MID + m.waist} ${m.waistY}`,
    `C ${MID + m.waist + 3} ${m.waistY - 20} ${MID + m.chest + 1} ${m.shoulderY + 22} ${MID + m.shoulders} ${m.shoulderY}`,
    `C ${MID + m.shoulders * 0.45} ${m.shoulderY - 6} ${MID - m.shoulders * 0.45} ${m.shoulderY - 6} ${MID - m.shoulders} ${m.shoulderY}`,
    'Z',
  ].join(' ');
}

/** One arm: skin all the way down, with the sleeve laid over the top of it. */
function arm(m: Measured, side: 1 | -1, skin: string, kit: KitColours, sleeves: 'short' | 'long') {
  const top = `${MID + side * m.armTopX} ${m.shoulderY + 3}`;
  const elbow = `${MID + side * m.elbowX} ${m.elbowY}`;
  const wrist = `${MID + side * m.wristX} ${m.wristY}`;
  const line = `M ${top} Q ${elbow} ${wrist}`;

  // The sleeve is the top of the same line: to the elbow if it is a long one, a third of
  // the way if it is not.
  const cut = sleeves === 'long' ? 0.62 : 0.28;
  const sleeveEndX = MID + side * (m.armTopX + (m.wristX - m.armTopX) * cut);
  const sleeveEndY = m.shoulderY + 3 + (m.wristY - m.shoulderY - 3) * cut;

  return (
    <g key={`arm${side}`}>
      <path d={line} stroke={skin} strokeWidth={m.armThickness} strokeLinecap="round" fill="none" />
      <path
        d={`M ${top} Q ${MID + side * (m.armTopX + (m.elbowX - m.armTopX) * cut)} ${m.shoulderY + (m.elbowY - m.shoulderY) * cut} ${sleeveEndX} ${sleeveEndY}`}
        stroke={kit.shirt}
        strokeWidth={m.armThickness + 5}
        strokeLinecap="round"
        fill="none"
      />
      <circle cx={MID + side * m.wristX} cy={m.wristY + 4} r={m.armThickness * 0.5} fill={skin} />
    </g>
  );
}

/** One leg: thigh, calf, sock and boot, hung off the hip so nothing floats. */
function leg(m: Measured, side: 1 | -1, skin: string, kit: KitColours) {
  const hipX = MID + side * (m.hip * 0.5);
  const kneeX = MID + side * (m.hip * 0.58);
  const ankleX = MID + side * (m.hip * 0.56);
  const thigh = 16 + m.muscle * 4;
  const calf = 12 + m.muscle * 3;

  return (
    <g key={`leg${side}`}>
      <path d={`M ${hipX} ${m.hipY - 8} L ${kneeX} ${m.kneeY}`} stroke={skin} strokeWidth={thigh} strokeLinecap="round" fill="none" />
      <path d={`M ${kneeX} ${m.kneeY} L ${ankleX} ${m.ankleY}`} stroke={skin} strokeWidth={calf} strokeLinecap="round" fill="none" />
      {/* Socks from below the knee to the boot. */}
      <path
        d={`M ${kneeX} ${m.kneeY + 6} L ${ankleX} ${m.ankleY}`}
        stroke={kit.socks} strokeWidth={calf + 1.5} strokeLinecap="round" fill="none"
      />
      <path
        d={`M ${ankleX - side * 5} ${m.ankleY} L ${ankleX + side * 13} ${m.ankleY + 7} L ${ankleX - side * 6} ${m.ankleY + 7} Z`}
        fill="#15181d"
      />
    </g>
  );
}

/** Eyes, with the lid the "how open" slider closes and a brow above it. */
function eyes(m: Measured, look: AvatarLook, skin: string) {
  const iris = EYE_COLOURS[look.eyeColour] ?? EYE_COLOURS[0]!;
  const size = 1 + value(m.shape, 'eyeSize') * 0.28;
  const open = 1 + value(m.shape, 'eyeOpen') * 0.5;
  const y = m.headY + 1;
  const spread = m.headW * 0.21;
  const rx = 6.2 * size;
  const ry = 4 * size * open;

  return ([-1, 1] as const).map((side) => {
    const cx = MID + side * spread;
    return (
      <g key={`eye${side}`}>
        <ellipse cx={cx} cy={y} rx={rx} ry={ry} fill="#f4f1ec" />
        <circle cx={cx} cy={y} r={Math.min(ry * 1.05, rx * 0.6)} fill={iris} />
        <circle cx={cx} cy={y} r={Math.min(ry * 0.5, rx * 0.3)} fill="#101216" />
        <circle cx={cx - rx * 0.24} cy={y - ry * 0.34} r={rx * 0.14} fill="#ffffff" opacity={0.85} />
        <path
          d={`M ${cx - rx} ${y - ry * 0.25} Q ${cx} ${y - ry * 1.6} ${cx + rx} ${y - ry * 0.25}`}
          stroke={shade(skin, -0.45)} strokeWidth={1.2} fill="none" strokeLinecap="round"
        />
      </g>
    );
  });
}

/** The nose: a bridge the sliders lengthen, widen and bend. */
function nosePath(m: Measured): string {
  const width = 5.2 * (1 + value(m.shape, 'noseWidth') * 0.5);
  const length = 14 * (1 + value(m.shape, 'noseLength') * 0.3);
  const hump = value(m.shape, 'noseHump');
  const top = m.headY;
  const tip = top + length;
  return [
    `M ${MID - 1.5} ${top}`,
    `Q ${MID - 3 - hump * 2.5} ${top + length * 0.55} ${MID - width * 0.7} ${tip}`,
    `Q ${MID} ${tip + 3} ${MID + width * 0.7} ${tip}`,
  ].join(' ');
}

/** The mouth: a width and a pair of lips. */
function mouth(m: Measured, skin: string) {
  const width = 12 * (1 + value(m.shape, 'mouthWidth') * 0.32);
  const lips = value(m.shape, 'lips');
  const y = m.headY + m.headH * 0.31;
  const upper = 2.2 + lips * 1.9;
  const lower = 2.8 + lips * 2.4;
  return (
    <g>
      <path
        d={`M ${MID - width} ${y} Q ${MID} ${y - upper} ${MID + width} ${y} Q ${MID} ${y + lower} ${MID - width} ${y} Z`}
        fill={shade(skin, -0.42)}
      />
      <path d={`M ${MID - width * 0.78} ${y} L ${MID + width * 0.78} ${y}`} stroke={shade(skin, -0.62)} strokeWidth={1} />
    </g>
  );
}

/** Hair, in front of the head and behind it, by style. */
function hair(m: Measured, look: AvatarLook) {
  if (look.hair === 'bald') return { behind: null, front: null };
  const colour = HAIR_COLOURS[look.hairColour] ?? HAIR_COLOURS[0]!;
  const halfW = m.headW / 2;
  const top = m.headY - m.headH / 2;

  /** The cap every style starts from: the skull, down to a hairline. */
  const cap = (grow: number, drop: number) => (
    <path
      d={[
        `M ${MID - halfW - grow} ${m.headY - m.headH * drop}`,
        `C ${MID - halfW - grow} ${top - grow * 1.6} ${MID + halfW + grow} ${top - grow * 1.6} ${MID + halfW + grow} ${m.headY - m.headH * drop}`,
        `C ${MID + halfW * 0.7} ${m.headY - m.headH * (drop + 0.09)} ${MID - halfW * 0.7} ${m.headY - m.headH * (drop + 0.09)} ${MID - halfW - grow} ${m.headY - m.headH * drop}`,
        'Z',
      ].join(' ')}
      fill={colour}
    />
  );

  switch (look.hair) {
    case 'buzz':
      return { behind: null, front: cap(0.5, 0.19) };
    case 'short':
      return { behind: null, front: cap(2, 0.21) };
    case 'crop':
      return {
        behind: null,
        front: (
          <g>
            {cap(2, 0.19)}
            <rect x={MID - halfW * 0.9} y={top - 4} width={halfW * 1.8} height={9} rx={3} fill={colour} />
          </g>
        ),
      };
    case 'curls':
      return {
        behind: null,
        front: (
          <g>
            {cap(2, 0.21)}
            {Array.from({ length: 9 }, (_, i) => {
              const angle = Math.PI * (0.08 + (i / 8) * 0.84);
              return (
                <circle
                  key={i}
                  cx={MID - Math.cos(angle) * (halfW + 1)}
                  cy={m.headY - Math.sin(angle) * (m.headH * 0.42) - 3}
                  r={5.2}
                  fill={colour}
                />
              );
            })}
          </g>
        ),
      };
    case 'afro':
      return {
        behind: <ellipse cx={MID} cy={m.headY - m.headH * 0.28} rx={halfW + 12} ry={m.headH * 0.44} fill={colour} />,
        front: cap(3, 0.21),
      };
    case 'long':
      return {
        behind: (
          <path
            d={`M ${MID - halfW - 3} ${m.headY - m.headH * 0.2} L ${MID - halfW - 5} ${m.headY + m.headH * 0.7} Q ${MID} ${m.headY + m.headH * 0.85} ${MID + halfW + 5} ${m.headY + m.headH * 0.7} L ${MID + halfW + 3} ${m.headY - m.headH * 0.2} Z`}
            fill={colour}
          />
        ),
        front: cap(3, 0.19),
      };
    case 'bun':
      return {
        behind: <circle cx={MID} cy={top - 5} r={8.5} fill={colour} />,
        front: cap(2, 0.21),
      };
    default:
      return { behind: null, front: null };
  }
}

/** A beard, drawn as the lower part of the face in hair. */
function facialHair(m: Measured, look: AvatarLook) {
  if (look.facialHair === 'none') return null;
  const colour = HAIR_COLOURS[look.hairColour] ?? HAIR_COLOURS[0]!;
  const halfW = m.headW / 2;
  const opacity = look.facialHair === 'stubble' ? 0.42 : 1;
  const mouthY = m.headY + m.headH * 0.31;

  const jawLine = (
    <path
      d={[
        `M ${MID - halfW * 0.92} ${m.headY + 6}`,
        `C ${MID - halfW * 0.9} ${m.headY + m.headH * 0.5} ${MID - halfW * 0.4} ${m.headY + m.headH * 0.56} ${MID} ${m.headY + m.headH * 0.56}`,
        `C ${MID + halfW * 0.4} ${m.headY + m.headH * 0.56} ${MID + halfW * 0.9} ${m.headY + m.headH * 0.5} ${MID + halfW * 0.92} ${m.headY + 6}`,
        `L ${MID + halfW * 0.92} ${m.headY + m.headH * 0.22}`,
        `C ${MID + halfW * 0.5} ${m.headY + m.headH * 0.74} ${MID - halfW * 0.5} ${m.headY + m.headH * 0.74} ${MID - halfW * 0.92} ${m.headY + m.headH * 0.22}`,
        'Z',
      ].join(' ')}
      fill={colour} opacity={opacity}
    />
  );
  const full = (
    <path
      d={[
        `M ${MID - halfW * 0.92} ${m.headY + 3}`,
        `C ${MID - halfW} ${m.headY + m.headH * 0.6} ${MID - halfW * 0.5} ${m.headY + m.headH * 0.63} ${MID} ${m.headY + m.headH * 0.63}`,
        `C ${MID + halfW * 0.5} ${m.headY + m.headH * 0.63} ${MID + halfW} ${m.headY + m.headH * 0.6} ${MID + halfW * 0.92} ${m.headY + 3}`,
        'Z',
      ].join(' ')}
      fill={colour} opacity={opacity}
    />
  );
  const moustache = (
    <path
      d={`M ${MID - 8.5} ${mouthY - 4.5} Q ${MID} ${mouthY - 8.5} ${MID + 8.5} ${mouthY - 4.5} Q ${MID} ${mouthY - 1.5} ${MID - 8.5} ${mouthY - 4.5} Z`}
      fill={colour} opacity={opacity}
    />
  );
  const goatee = (
    <path
      d={`M ${MID - 6.5} ${mouthY + 4.5} Q ${MID} ${mouthY + 15} ${MID + 6.5} ${mouthY + 4.5} Q ${MID} ${mouthY + 7.5} ${MID - 6.5} ${mouthY + 4.5} Z`}
      fill={colour} opacity={opacity}
    />
  );

  switch (look.facialHair) {
    case 'stubble': return jawLine;
    case 'moustache': return moustache;
    case 'goatee': return <g>{moustache}{goatee}</g>;
    case 'beard': return <g>{jawLine}{moustache}</g>;
    case 'full': return <g>{full}{moustache}</g>;
    default: return null;
  }
}

export function Avatar2D({
  look,
  heightCm,
  kit,
  height = 250,
  framing = 'body',
}: {
  look: AvatarLook;
  heightCm: number;
  kit: KitColours;
  height?: number;
  /** The whole figure, or the head close enough to see what a nose slider is doing. */
  framing?: 'body' | 'face';
}) {
  const m = measure(look, heightCm);
  const skin = SKIN_TONES[look.skin] ?? SKIN_TONES[2]!;
  const shadow = shade(skin, -0.24);
  const halfW = m.headW / 2;
  const { behind, front } = hair(m, look);

  // Two windows onto the same drawing: everything, or the head.
  const viewBox = framing === 'face'
    ? `${MID - halfW - 15} ${m.headY - m.headH / 2 - 18} ${m.headW + 30} ${m.headH + 38}`
    : `34 ${m.headY - m.headH / 2 - 14} 132 ${m.floorY - m.headY + m.headH / 2 + 22}`;

  return (
    <div className="avatar-view" style={{ height }}>
      <svg viewBox={viewBox} height="100%" width="100%" role="img" aria-label="avatar" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="avatarFloor" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.5)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        {framing === 'body' && <ellipse cx={MID} cy={m.floorY + 3} rx={46} ry={7} fill="url(#avatarFloor)" />}

        {behind}

        {/* Legs first, then the shorts over the top of them, then the body. */}
        {leg(m, -1, skin, kit)}
        {leg(m, 1, skin, kit)}
        <path
          d={[
            `M ${MID - m.hip - 1} ${m.hipY - 12}`,
            `L ${MID + m.hip + 1} ${m.hipY - 12}`,
            `L ${MID + m.hip + 3} ${m.shortsY}`,
            `L ${MID + 3} ${m.shortsY - 7}`,
            `L ${MID - 3} ${m.shortsY - 7}`,
            `L ${MID - m.hip - 3} ${m.shortsY}`,
            'Z',
          ].join(' ')}
          fill={kit.shorts}
          stroke={shade(kit.shorts, 0.18)}
          strokeWidth={0.8}
        />

        {/* The neck, under everything the shirt covers. */}
        <rect x={MID - 8} y={m.neckY - 6} width={16} height={20} rx={6} fill={shadow} />

        <path d={torsoPath(m)} fill={kit.shirt} stroke={shade(kit.shirt, -0.18)} strokeWidth={0.8} />
        {arm(m, -1, skin, kit, look.sleeves)}
        {arm(m, 1, skin, kit, look.sleeves)}
        {/* The collar, and the number on his back. */}
        <path
          d={`M ${MID - 10} ${m.shoulderY - 2} Q ${MID} ${m.shoulderY + 10} ${MID + 10} ${m.shoulderY - 2}`}
          fill={shade(kit.shirt, -0.22)}
        />
        {kit.number !== undefined && (
          <text
            x={MID}
            y={m.shoulderY + 40 * m.stretch}
            textAnchor="middle"
            fontSize={26}
            fontWeight={700}
            fill={shade(kit.shirt, -0.45)}
            opacity={0.9}
          >
            {kit.number}
          </text>
        )}

        {/* The head and what is on it. */}
        <ellipse cx={MID - halfW - 1} cy={m.headY + 6} rx={4.2} ry={5.6} fill={shadow} />
        <ellipse cx={MID + halfW + 1} cy={m.headY + 6} rx={4.2} ry={5.6} fill={shadow} />
        <path d={headPath(m)} fill={skin} />
        {/* Cheekbones: a hint of shadow, moved by their own slider. */}
        {([-1, 1] as const).map((side) => (
          <ellipse
            key={`cheek${side}`}
            cx={MID + side * halfW * 0.6} cy={m.headY + 9} rx={6.5} ry={3.6}
            fill={shadow} opacity={Math.max(0, 0.24 + value(m.shape, 'cheekbones') * 0.22)}
          />
        ))}

        {eyes(m, look, skin)}
        {([-1, 1] as const).map((side) => (
          <path
            key={`brow${side}`}
            d={`M ${MID + side * (m.headW * 0.12)} ${m.headY - 8} Q ${MID + side * (m.headW * 0.21)} ${m.headY - 11.5} ${MID + side * (m.headW * 0.31)} ${m.headY - 8.5}`}
            stroke={HAIR_COLOURS[look.hairColour] ?? '#2b1d16'}
            strokeWidth={2.8}
            strokeLinecap="round"
            fill="none"
          />
        ))}
        <path d={nosePath(m)} stroke={shade(skin, -0.35)} strokeWidth={1.8} fill="none" strokeLinecap="round" />
        {mouth(m, skin)}
        {facialHair(m, look)}
        {front}

        {/* What he chose to wear. */}
        {look.earring && <circle cx={MID + halfW + 2} cy={m.headY + 10} r={2.4} fill="#e8d48a" />}
        {look.necklace && (
          <path
            d={`M ${MID - 9} ${m.neckY + 11} Q ${MID} ${m.neckY + 20} ${MID + 9} ${m.neckY + 11}`}
            stroke="#e8d48a" strokeWidth={1.8} fill="none"
          />
        )}
        {look.bracelet && (
          <circle cx={MID + m.wristX} cy={m.wristY - 3} r={4.5} stroke="#d9c27a" strokeWidth={2.2} fill="none" />
        )}
      </svg>
    </div>
  );
}
