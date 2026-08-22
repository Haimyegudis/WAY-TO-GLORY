import { useEffect } from 'react';
import { useT } from '../i18n/index.js';
import { useGame, type CelebrationKind } from '../state/store.js';

/**
 * The moment he won something.
 *
 * A league, a cup, a golden boot - the game knew about all of them and told him in a
 * line of text in a mailbox, next to a message about a sponsor. A trophy is the only
 * thing in a career that is purely a reward, and it should stop everything for five
 * seconds and make a noise. Confetti is CSS: forty pieces of paper on a loop, no
 * library, no images, and it costs nothing on a phone.
 */
export function Celebration({ kind, titleKey, args }: { kind: CelebrationKind; titleKey: string; args?: Record<string, string | number> }) {
  const t = useT();
  const clear = useGame((s) => s.clearCelebration);

  // It closes itself. Nobody should have to dismiss a trophy.
  useEffect(() => {
    const timer = setTimeout(clear, 6500);
    return () => clearTimeout(timer);
  }, [clear, titleKey]);

  return (
    <div className="celebration" onClick={clear} role="dialog" aria-modal="true" aria-label={t(titleKey, args)}>
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 40 }, (_, i) => (
          <span
            key={i}
            className="confetto"
            style={{
              left: `${(i * 97) % 100}%`,
              animationDelay: `${(i % 10) * 0.18}s`,
              animationDuration: `${2.6 + ((i * 13) % 9) * 0.22}s`,
              background: ['var(--amber)', 'var(--green)', '#fff', 'var(--blue, #6aa9ff)'][i % 4],
              transform: `rotate(${(i * 37) % 360}deg)`,
            }}
          />
        ))}
      </div>

      <div className="celebration-card">
        <p className="eyebrow" style={{ color: 'var(--amber)' }}>
          {t(kind === 'award' ? 'celebrate.personal' : 'celebrate.team')}
        </p>
        <div className="celebration-trophy" aria-hidden="true">{kind === 'award' ? '🏅' : '🏆'}</div>
        <h2 className="title" style={{ marginBlock: '6px 4px' }}>{t(titleKey, args)}</h2>
        <p className="faint" style={{ fontSize: 13 }}>{t('celebrate.tap')}</p>
      </div>
    </div>
  );
}
