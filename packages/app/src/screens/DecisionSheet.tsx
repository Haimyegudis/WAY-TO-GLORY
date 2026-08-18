import type { PendingDecision } from '@fc/engine';
import { useT } from '../i18n/index.js';
import { useGame } from '../state/store.js';

/**
 * The decision sheet is where the game actually happens. Options show a qualitative
 * risk label and never a probability: the uncertainty is the point.
 */
export function DecisionSheet({ decision }: { decision: PendingDecision }) {
  const t = useT();
  const decide = useGame((s) => s.decide);

  return (
    <div className="decision-backdrop">
      <div className="decision">
        <p className="eyebrow" style={{ color: 'var(--flood)' }}>{t(`category.${decision.category}`)}</p>
        <h2 className="display" style={{ fontSize: 21, marginBlock: '10px 18px', lineHeight: 1.25 }}>
          {t(decision.textKey, decision.textArgs)}
        </h2>

        <div className="stack" style={{ gap: 9 }}>
          {decision.options.map((option, i) => (
            <button
              key={option.id}
              className="option"
              style={{ animation: `rise 0.3s ease both`, animationDelay: `${80 + i * 60}ms` }}
              onClick={() => decide(decision.id, option.id)}
            >
              <span style={{ fontSize: 14.5 }}>{t(`${decision.textKey}.${option.id}`)}</span>
              {option.riskKey && (
                <span className={`risk ${riskClass(option.riskKey)}`} style={{ display: 'block', marginBlockStart: 5 }}>
                  {t(option.riskKey)}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function riskClass(key: string): string {
  if (key.endsWith('high')) return 'risk-high';
  if (key.endsWith('medium')) return 'risk-medium';
  return 'risk-low';
}
