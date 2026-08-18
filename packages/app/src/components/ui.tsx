import type { ReactNode } from 'react';

export function Panel({
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
    <section className={`panel ${lit ? 'panel-lit' : ''} ${className}`}>
      {(title || action) && (
        <header className="panel-head">
          {title && <h2 className="eyebrow">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Meter({ value, tone = 'flood' }: { value: number; tone?: 'flood' | 'amber' | 'blood' | 'sky' }) {
  const cls = tone === 'flood' ? '' : `meter-${tone}`;
  return (
    <div className={`meter ${cls}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div>
      <div className="stat-value" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export function Chip({ children, tone }: { children: ReactNode; tone?: 'flood' | 'amber' | 'blood' | 'sky' }) {
  return <span className={`chip ${tone ? `chip-${tone}` : ''}`}>{children}</span>;
}

export function Gauge({ label, value, tone = 'flood' }: { label: string; value: number; tone?: 'flood' | 'amber' | 'blood' | 'sky' }) {
  return (
    <div style={{ flex: 1 }}>
      <div className="row-between" style={{ marginBlockEnd: 4 }}>
        <span className="eyebrow">{label}</span>
        <span className="num" style={{ fontSize: 12 }}>{Math.round(value)}</span>
      </div>
      <Meter value={value} tone={tone} />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

/** Rating badge that colours itself the way a match report would. */
export function RatingBadge({ rating }: { rating: number }) {
  const tone = rating >= 8 ? 'var(--flood)' : rating >= 7 ? '#a9d94b' : rating >= 6 ? 'var(--ink-dim)' : 'var(--blood)';
  return (
    <span className="num" style={{ color: tone, fontSize: 15 }}>
      {rating.toFixed(1)}
    </span>
  );
}
