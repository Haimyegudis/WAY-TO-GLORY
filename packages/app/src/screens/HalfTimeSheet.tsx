import { useState } from 'react';
import type { HalfTimeInstructionId, PendingHalfTime } from '@fc/engine';
import { useLang, useT } from '../i18n/index.js';
import { useGame } from '../state/store.js';
import { club } from '../state/selectors.js';
import { clubShortName } from '../lib/club.js';
import { Crest } from '../components/ui.js';

/**
 * The dressing room.
 *
 * Forty-five minutes gone and somebody wants something from him. A manager who does not
 * trust him yet tells him what the second half looks like and he can take it or go his
 * own way; a player the manager listens to is asked instead. Either way it is a trade -
 * every instruction gives something up - and the second half is played out under it.
 */
export function HalfTimeSheet({ half }: { half: PendingHalfTime }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  const chooseHalfTime = useGame((s) => s.chooseHalfTime);
  const [defying, setDefying] = useState(false);

  const home = club(state, half.homeClubId);
  const away = club(state, half.awayClubId);
  const demand = half.demand;
  const choosing = demand === null || defying;

  return (
    <div className="sheet-backdrop">
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t('halfTime.title')}>
        <div className="sheet-grip" />
        <p className="eyebrow" style={{ color: 'var(--amber)' }}>{t('halfTime.title')}</p>

        <div className="live-board" style={{ marginBlock: '10px 14px' }}>
          <div className="live-side">
            <Crest club={home} size="lg" />
            <span>{clubShortName(home, lang) || half.homeClubId}</span>
          </div>
          <div className="live-score">
            <span className="num" dir="ltr">{half.score[0]}–{half.score[1]}</span>
            <span className="live-clock num" dir="ltr">45′</span>
          </div>
          <div className="live-side">
            <Crest club={away} size="lg" />
            <span>{clubShortName(away, lang) || half.awayClubId}</span>
          </div>
        </div>

        <p className="faint" style={{ fontSize: 13, marginBlockEnd: 12 }}>
          {t('halfTime.yourHalf', { rating: half.rating.toFixed(1) })}
        </p>

        {demand !== null && !defying && (
          <>
            <div className="card" style={{ padding: 14, marginBlockEnd: 12 }}>
              <p className="eyebrow" style={{ color: 'var(--amber)' }}>{t('halfTime.managerSays')}</p>
              <p style={{ fontSize: 14.5, fontWeight: 600, marginBlockStart: 6 }}>
                {t(`halfTime.demand.${demand}`)}
              </p>
              <p className="faint" style={{ fontSize: 12.5, marginBlockStart: 6 }}>
                {t(`halfTime.instruction.${demand}.hint`)}
              </p>
            </div>
            <div className="stack" style={{ gap: 9 }}>
              <button className="option" onClick={() => chooseHalfTime(demand)}>
                <span style={{ fontSize: 14.5, fontWeight: 600 }}>{t('halfTime.obey')}</span>
                <span className="risk risk-low" style={{ display: 'block', marginBlockStart: 5 }}>
                  {t('halfTime.obey.hint')}
                </span>
              </button>
              <button className="option" onClick={() => setDefying(true)}>
                <span style={{ fontSize: 14.5, fontWeight: 600 }}>{t('halfTime.refuse')}</span>
                <span className="risk risk-high" style={{ display: 'block', marginBlockStart: 5 }}>
                  {t('halfTime.refuse.hint')}
                </span>
              </button>
            </div>
          </>
        )}

        {choosing && (
          <>
            <p className="eyebrow" style={{ marginBlockEnd: 8 }}>
              {demand === null ? t('halfTime.freeChoice') : t('halfTime.yourWay')}
            </p>
            <div className="stack" style={{ gap: 9 }}>
              {half.options
                .filter((id) => !defying || id !== demand)
                .map((id: HalfTimeInstructionId, i: number) => (
                  <button
                    key={id}
                    className="option"
                    style={{ animation: 'rise 0.3s ease both', animationDelay: `${60 + i * 45}ms` }}
                    onClick={() => chooseHalfTime(id)}
                  >
                    <span style={{ fontSize: 14.5, fontWeight: 600 }}>{t(`halfTime.instruction.${id}`)}</span>
                    <span className="risk" style={{ display: 'block', marginBlockStart: 5 }}>
                      {t(`halfTime.instruction.${id}.hint`)}
                    </span>
                  </button>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
