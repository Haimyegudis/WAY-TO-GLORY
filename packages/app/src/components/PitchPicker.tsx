import { useState } from 'react';
import type { Position } from '@fc/engine';
import { useT } from '../i18n/index.js';

/** Where each position sits on a vertical pitch, as percentages. */
const SPOTS: { pos: Position; x: number; y: number }[] = [
  { pos: 'ST', x: 50, y: 7 },
  { pos: 'LW', x: 14, y: 17 },
  { pos: 'CF', x: 50, y: 20 },
  { pos: 'RW', x: 86, y: 17 },
  { pos: 'CAM', x: 50, y: 33 },
  { pos: 'LM', x: 12, y: 45 },
  { pos: 'CM', x: 50, y: 46 },
  { pos: 'RM', x: 88, y: 45 },
  { pos: 'CDM', x: 50, y: 58 },
  { pos: 'LWB', x: 11, y: 61 },
  { pos: 'RWB', x: 89, y: 61 },
  { pos: 'LB', x: 15, y: 75 },
  { pos: 'CB', x: 50, y: 76 },
  { pos: 'RB', x: 85, y: 75 },
  { pos: 'GK', x: 50, y: 91 },
];

/**
 * Pick a position by tapping the pitch, the way a team sheet works. Uses the pitch
 * photograph when one is shipped and falls back to a drawn pitch otherwise.
 */
export function PitchPicker({
  value,
  secondary,
  onPick,
}: {
  value: Position;
  secondary?: Position | '';
  onPick: (pos: Position) => void;
}) {
  const t = useT();
  const [photoFailed, setPhotoFailed] = useState(false);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '3 / 4.6',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        border: '1px solid var(--line)',
        background: 'linear-gradient(180deg, #1c5a2c, #14431f 45%, #0f3419)',
      }}
    >
      {!photoFailed && (
        <img
          src="/bg/positions.jpg"
          alt=""
          onError={() => setPhotoFailed(true)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }}
        />
      )}

      {photoFailed && (
        <svg viewBox="0 0 300 460" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <g fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2">
            <rect x="8" y="8" width="284" height="444" rx="4" />
            <line x1="8" y1="230" x2="292" y2="230" />
            <circle cx="150" cy="230" r="46" />
            <rect x="70" y="8" width="160" height="62" />
            <rect x="70" y="390" width="160" height="62" />
          </g>
        </svg>
      )}

      {SPOTS.map((spot) => {
        const active = spot.pos === value;
        const isSecondary = spot.pos === secondary;
        return (
          <button
            key={spot.pos}
            onClick={() => onPick(spot.pos)}
            aria-pressed={active}
            style={{
              position: 'absolute',
              // A pitch has no reading direction: use physical sides so the layout
              // does not mirror when the interface is right to left.
              left: `${spot.x}%`,
              top: `${spot.y}%`,
              transform: 'translate(-50%, -50%)',
              width: 52,
              height: 52,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              gap: 0,
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: '0.01em',
              color: active ? '#0d2415' : isSecondary ? 'var(--amber)' : 'rgba(255,255,255,0.92)',
              background: active
                ? 'linear-gradient(180deg, #ffffff, #dfe8e2)'
                : isSecondary
                  ? 'rgba(10, 22, 14, 0.86)'
                  : 'rgba(8, 20, 12, 0.72)',
              border: active
                ? '2px solid #fff'
                : isSecondary
                  ? '2px solid var(--amber)'
                  : '1.5px solid rgba(255,255,255,0.35)',
              boxShadow: active ? '0 8px 20px -6px rgba(0,0,0,0.7)' : 'none',
              transition: 'transform 0.14s ease, background 0.18s ease',
              zIndex: active ? 2 : 1,
            }}
          >
            {spot.pos}
          </button>
        );
      })}

      <div
        style={{
          position: 'absolute',
          insetInline: 0,
          insetBlockEnd: 0,
          padding: '10px 12px',
          background: 'linear-gradient(180deg, transparent, rgba(4,12,7,0.85))',
          textAlign: 'center',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {t(`pos.${value}`)}
      </div>
    </div>
  );
}
