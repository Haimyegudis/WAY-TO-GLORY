import { useState } from 'react';

/**
 * One measure of a career, season by season.
 *
 * The career page holds a table of every season he has played, which answers "what did
 * I do in 2031" and never answers "am I getting better". A shape does that in a glance,
 * so each measure gets its own small chart rather than three lines fighting over one
 * pair of axes - a rating out of ten and three thousand minutes do not share a scale,
 * and forcing them to is the oldest mistake in charting.
 *
 * Single series, so no legend: the title says what it is. The last value is labelled
 * because that is the one he is living in; the rest are read off the shape. Touching or
 * hovering a season names it and prints its number, which on a phone is the only way to
 * interrogate a line at all.
 */
export interface SeasonPoint {
  season: number;
  value: number;
}

const WIDTH = 320;
const HEIGHT = 64;
const PAD_X = 8;
const PAD_Y = 10;

export function SeasonChart({
  points,
  label,
  format,
  seasonLabel,
}: {
  points: SeasonPoint[];
  label: string;
  format: (value: number) => string;
  seasonLabel: (season: number) => string;
}) {
  const [held, setHeld] = useState<number | null>(null);
  if (points.length === 0) return null;

  const values = points.map((p) => p.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  // A flat line is a real answer - it should read as flat, not as noise magnified to
  // fill the box - so a span of nothing is given a little room instead of dividing by
  // zero.
  const span = high - low < 0.001 ? Math.max(1, Math.abs(high) * 0.2) : high - low;
  const stepX = points.length > 1 ? (WIDTH - PAD_X * 2) / (points.length - 1) : 0;

  const x = (i: number) => PAD_X + i * stepX;
  const y = (value: number) => HEIGHT - PAD_Y - ((value - low) / span) * (HEIGHT - PAD_Y * 2);

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const area =
    points.length > 1
      ? `${line} L ${x(points.length - 1).toFixed(1)} ${HEIGHT - PAD_Y} L ${x(0).toFixed(1)} ${HEIGHT - PAD_Y} Z`
      : '';

  const last = points[points.length - 1]!;
  const shown = held !== null ? points[held] ?? last : last;

  const pick = (event: { clientX: number; currentTarget: SVGSVGElement }) => {
    const box = event.currentTarget.getBoundingClientRect();
    const at = ((event.clientX - box.left) / box.width) * WIDTH;
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(x(i) - at) < Math.abs(x(best) - at)) best = i;
    }
    setHeld(best);
  };

  return (
    <div className="season-chart">
      <div className="row-between" style={{ marginBlockEnd: 2 }}>
        <span className="eyebrow">{label}</span>
        <span className="row" style={{ gap: 6 }}>
          <span className="faint" style={{ fontSize: 11 }}>{seasonLabel(shown.season)}</span>
          <span className="num" style={{ fontSize: 13, fontWeight: 700 }}>{format(shown.value)}</span>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        role="img"
        aria-label={`${label}: ${format(last.value)}`}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setHeld(null)}
      >
        {/* The floor of the box, so the shape has something to sit on. */}
        <line x1={PAD_X} y1={HEIGHT - PAD_Y} x2={WIDTH - PAD_X} y2={HEIGHT - PAD_Y} className="season-chart-base" />
        {area && <path d={area} className="season-chart-area" />}
        <path d={line} className="season-chart-line" />
        {held !== null && points[held] && (
          <line
            x1={x(held)}
            y1={PAD_Y - 4}
            x2={x(held)}
            y2={HEIGHT - PAD_Y}
            className="season-chart-crosshair"
          />
        )}
        <circle cx={x(points.indexOf(shown))} cy={y(shown.value)} r="3.6" className="season-chart-dot" />
      </svg>
    </div>
  );
}
