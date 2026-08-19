import { useId } from 'react';

/**
 * A football, drawn rather than suggested.
 *
 * The old ball was a white disc with a dot in the middle, which at a glance is a full
 * stop. A real one is the Telstar pattern everybody has in their head: a black pentagon
 * in the middle and five more around it, cut off by the edge of the ball. That is what
 * this draws - the panels, the seams between them, and a highlight where the light is -
 * and it reads as a football at ten pixels across, which is the size it is on a pitch
 * seen from above.
 */

/** A regular pentagon, centred on the origin, with a vertex pointing up. */
function pentagon(radius: number, turn = 0): string {
  const points: string[] = [];
  for (let i = 0; i < 5; i++) {
    const angle = (-90 + turn + i * 72) * (Math.PI / 180);
    points.push(`${(Math.cos(angle) * radius).toFixed(3)},${(Math.sin(angle) * radius).toFixed(3)}`);
  }
  return points.join(' ');
}

/** The five that sit around the middle one, each rolled over the edge of the ball. */
const OUTER = [0, 72, 144, 216, 288];

export function Football({ r = 1.25 }: { r?: number }) {
  const id = useId();
  const clip = `ball-${id.replace(/[^a-zA-Z0-9]/g, '')}`;
  const panel = '#15181d';

  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <circle r={r} />
        </clipPath>
        <radialGradient id={`${clip}-light`} cx="34%" cy="30%" r="72%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="62%" stopColor="#f2f4f7" />
          <stop offset="100%" stopColor="#b9c1cb" />
        </radialGradient>
      </defs>

      <circle r={r} fill={`url(#${clip}-light)`} stroke="#10131a" strokeWidth={r * 0.16} />

      <g clipPath={`url(#${clip})`}>
        {/* The seams first, so the panels sit on top of them. */}
        <g stroke={panel} strokeWidth={r * 0.1} fill="none" opacity="0.55">
          {OUTER.map((turn) => (
            <line
              key={turn}
              x1={Math.cos((-90 + turn) * (Math.PI / 180)) * r * 0.34}
              y1={Math.sin((-90 + turn) * (Math.PI / 180)) * r * 0.34}
              x2={Math.cos((-90 + turn) * (Math.PI / 180)) * r * 1.05}
              y2={Math.sin((-90 + turn) * (Math.PI / 180)) * r * 1.05}
            />
          ))}
        </g>

        <polygon points={pentagon(r * 0.36)} fill={panel} />

        {OUTER.map((turn) => {
          const angle = (-90 + turn + 36) * (Math.PI / 180);
          const distance = r * 0.92;
          return (
            <polygon
              key={turn}
              points={pentagon(r * 0.34, turn + 36)}
              fill={panel}
              transform={`translate(${(Math.cos(angle) * distance).toFixed(3)} ${(Math.sin(angle) * distance).toFixed(3)})`}
            />
          );
        })}
      </g>

      {/* The shine, which is what makes it a sphere rather than a sticker. */}
      <ellipse
        cx={-r * 0.3}
        cy={-r * 0.38}
        rx={r * 0.34}
        ry={r * 0.22}
        fill="rgba(255,255,255,0.75)"
        transform={`rotate(-28 ${-r * 0.3} ${-r * 0.38})`}
      />
    </g>
  );
}

/** The same ball, standing on its own, for anywhere that is not already an svg. */
export function FootballIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      viewBox="-1.5 -1.5 3 3"
      width={size}
      height={size}
      aria-hidden="true"
      {...(className ? { className } : {})}
    >
      <Football r={1.25} />
    </svg>
  );
}
