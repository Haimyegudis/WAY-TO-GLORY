import { useState, type ReactNode } from 'react';
import type { AppliedChange, Club } from '@fc/engine';
import { useLang, useT } from '../i18n/index.js';
import { clubColor, clubInitials, clubName, crestUrl } from '../lib/club.js';

export function Card({
  title,
  action,
  lit,
  children,
  className = '',
}: {
  title?: string;
  action?: ReactNode;
  lit?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${lit ? 'card-lit' : ''} ${className}`}>
      {(title || action) && (
        <header className="card-head">
          {title && <h2 className="eyebrow">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/** Club crest, falling back to a coloured monogram when we have no image. */
export function Crest({ club, size = 'md' }: { club: Club | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  const lang = useLang((s) => s.lang);
  const [failed, setFailed] = useState(false);
  const url = crestUrl(club);
  const cls = size === 'lg' ? 'crest crest-lg' : size === 'sm' ? 'crest crest-sm' : 'crest';

  if (!club) return <span className={cls} />;
  if (url && !failed) {
    return <img className={cls} src={url} alt="" loading="lazy" onError={() => setFailed(true)} />;
  }
  return (
    <span className={`${cls} crest-fallback`} style={{ background: clubColor(club) }}>
      {clubInitials(club, lang)}
    </span>
  );
}

export function ClubLine({ club, size = 'md' }: { club: Club | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  const lang = useLang((s) => s.lang);
  return (
    <span className="row" style={{ gap: 8, minWidth: 0 }}>
      <Crest club={club} size={size} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clubName(club, lang)}</span>
    </span>
  );
}

/**
 * A card wearing the club's own colour, taken from its crest. Used wherever the
 * player is choosing between clubs, so the choice looks like the clubs themselves.
 */
export function ClubCard({
  club,
  children,
  onClick,
  featured,
}: {
  club: Club | null | undefined;
  children: ReactNode;
  onClick?: () => void;
  featured?: boolean;
}) {
  const color = clubColor(club);
  const style = {
    position: 'relative' as const,
    overflow: 'hidden' as const,
    borderColor: featured ? color : 'var(--line)',
    background: `linear-gradient(150deg, ${color}2e, var(--surface) 58%)`,
  };
  const content = (
    <>
      {club?.crest && (
        <img
          src={`/crests/${club.crest}`}
          alt=""
          style={{
            position: 'absolute',
            insetBlockStart: '-18%',
            insetInlineEnd: '-12%',
            width: '44%',
            opacity: 0.09,
            pointerEvents: 'none',
          }}
        />
      )}
      <div style={{ position: 'relative' }}>{children}</div>
    </>
  );

  if (onClick) {
    return (
      <button className="card" style={{ ...style, width: '100%', textAlign: 'start' }} onClick={onClick}>
        {content}
      </button>
    );
  }
  return (
    <section className="card" style={style}>
      {content}
    </section>
  );
}

export function Meter({ value, tone = 'green' }: { value: number; tone?: 'green' | 'amber' | 'red' | 'blue' }) {
  const cls = tone === 'green' ? '' : `meter-${tone}`;
  return (
    <div className={`meter ${cls}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export function Chip({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: 'pink' | 'amber' | 'green' | 'red' | 'blue' | 'solid-green' | 'solid-red' | 'solid-amber';
}) {
  return <span className={`chip ${tone ? `chip-${tone}` : ''}`}>{children}</span>;
}

export function Gauge({
  label,
  value,
  tone = 'green',
  hint,
}: {
  label: string;
  value: number;
  tone?: 'green' | 'amber' | 'red' | 'blue';
  hint?: string;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="row-between" style={{ marginBlockEnd: 5 }}>
        <span className="eyebrow">{label}</span>
        <span className="num" style={{ fontSize: 12 }}>{Math.round(value)}</span>
      </div>
      <Meter value={value} tone={tone} />
      {hint && <p className="faint" style={{ fontSize: 10.5, marginBlockStart: 4 }}>{hint}</p>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function RatingBadge({ rating }: { rating: number }) {
  const tone = rating >= 8 ? 'var(--green)' : rating >= 7 ? '#9fd15f' : rating >= 6 ? 'var(--muted)' : 'var(--red)';
  return (
    <span className="num" style={{ color: tone, fontSize: 15 }}>
      {rating.toFixed(1)}
    </span>
  );
}

export function ResultDot({ result }: { result: 'W' | 'D' | 'L' }) {
  const t = useT();
  return <span className={`result-dot result-${result}`}>{t(`result.${result}`)}</span>;
}

/**
 * The list of "what that just did" lines. Every decision and every conversation
 * ends here, so a choice is never a black box.
 */
export function ChangeList({ changes }: { changes: AppliedChange[] }) {
  const t = useT();
  if (changes.length === 0) return null;
  return (
    <ul className="list">
      {changes.map((change, i) => {
        // These numbers sit on a dark nested card and must remain legible while the
        // conversation sheet is animating, not only after it reaches full opacity.
        const color = change.tone === 'good' ? '#56df8e' : change.tone === 'bad' ? '#ff8992' : 'var(--muted)';
        const sign = change.delta > 0 ? '+' : '';
        const hidden = change.before === 0 && change.after === 0;
        return (
          <li key={`${change.key}-${i}`} className="list-item" style={{ padding: '8px 0' }}>
            <span className="grow" style={{ fontSize: 13.5 }}>{t(change.key)}</span>
            {hidden ? (
              <span className="num" style={{ color, fontSize: 13 }}>{change.delta > 0 ? '▲' : change.delta < 0 ? '▼' : '•'}</span>
            ) : (
              <>
                <span className="num" style={{ color, fontSize: 13.5 }}>{sign}{change.delta}</span>
                <span className="num" style={{ color: 'var(--muted)', fontSize: 11.5, minWidth: 56, textAlign: 'end' }}>
                  {change.before}→{change.after}
                </span>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
