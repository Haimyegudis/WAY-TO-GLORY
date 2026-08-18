import type { DecisionResult } from '@fc/engine';
import { useT } from '../i18n/index.js';
import { useGame } from '../state/store.js';
import { ChangeList } from '../components/ui.js';

/**
 * What the last choice actually did. This is the whole point of the decision loop:
 * the player should never wonder why he lost his place or why the crowd turned.
 */
export function ResultSheet({ result }: { result: DecisionResult }) {
  const t = useT();
  const clearResult = useGame((s) => s.clearResult);

  return (
    <div className="sheet-backdrop" onClick={clearResult}>
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-grip" />
        <p className="eyebrow" style={{ color: 'var(--amber)' }}>{t('result.title')}</p>
        {result.narrativeKey && (
          <h2 className="headline" style={{ marginBlock: '8px 14px' }}>{t(result.narrativeKey)}</h2>
        )}

        {result.changes.length > 0 ? (
          <div className="card" style={{ padding: '4px 14px' }}>
            <ChangeList changes={result.changes} />
          </div>
        ) : (
          <p className="faint" style={{ fontSize: 13.5 }}>{t('result.nothingChanged')}</p>
        )}

        {result.consequences.length > 0 && (
          <div className="stack" style={{ gap: 8, marginBlockStart: 12 }}>
            {result.consequences.map((consequence, i) => (
              <div
                key={`${consequence.id}-${i}`}
                className="card"
                style={{
                  padding: 12,
                  borderColor: severeConsequence(consequence.id) ? 'rgba(239,68,68,0.4)' : 'rgba(242,193,78,0.35)',
                }}
              >
                <p className="eyebrow" style={{ color: severeConsequence(consequence.id) ? 'var(--red)' : 'var(--amber)' }}>
                  {t(`consequence.${consequence.id}.tag`)}
                </p>
                <p style={{ fontSize: 13.5, marginBlockStart: 4 }}>{t(`consequence.${consequence.id}`, consequence.args)}</p>
              </div>
            ))}
          </div>
        )}

        <button className="btn btn-primary btn-block" style={{ marginBlockStart: 16 }} onClick={clearResult}>
          {t('action.gotIt')}
        </button>
      </div>
    </div>
  );
}

function severeConsequence(id: string): boolean {
  return [
    'droppedFromSquad',
    'transferListed',
    'fined',
    'dressingRoomFallout',
    'fansTurned',
    'boardWarning',
    'clubSeeksReplacement',
    'injuryPickedUp',
    'apologyRejected',
  ].includes(id);
}
