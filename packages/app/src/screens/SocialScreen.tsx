import { relationshipLabel, type PlayerActionId } from '@fc/engine';
import { useT } from '../i18n/index.js';
import { availableActions, useGame } from '../state/store.js';
import { Card, Empty, Meter } from '../components/ui.js';

const CATEGORY_ORDER = ['manager', 'teammates', 'fans', 'board', 'personal'] as const;

/**
 * Where the player works on the people around him. Every option says what it is
 * aimed at and how risky it is; the result sheet then says exactly what it did.
 */
export function SocialScreen() {
  const t = useT();
  const state = useGame((s) => s.state)!;
  const runAction = useGame((s) => s.runAction);

  const actions = availableActions(state);
  const left = state.socialActions.perWeek - state.socialActions.used;

  return (
    <div className="screen stack">
      <header>
        <p className="eyebrow">{t('social.title')}</p>
        <h1 className="title">{t('social.standing')}</h1>
      </header>

      <Card>
        <div className="stack" style={{ gap: 12 }}>
          <Relation label={t('rel.manager')} value={state.relationships.manager} />
          <Relation label={t('rel.teammates')} value={state.relationships.teammates} />
          <Relation label={t('rel.fans')} value={state.relationships.fans} />
          <Relation label={t('rel.board')} value={state.relationships.board} />
          <Relation label={t('rel.media')} value={state.relationships.media} />
        </div>
      </Card>

      <div className="row-between">
        <span className="eyebrow">{t('social.actions')}</span>
        <span className="chip chip-amber">{t('social.left', { count: left })}</span>
      </div>

      {left <= 0 && <Empty>{t('social.noneLeft')}</Empty>}

      {CATEGORY_ORDER.map((category) => {
        const inCategory = actions.filter((a) => a.category === category);
        if (inCategory.length === 0) return null;
        return (
          <Card key={category} title={t(`social.cat.${category}`)}>
            <div className="stack" style={{ gap: 8 }}>
              {inCategory.map((action) => (
                <button
                  key={action.id}
                  className="option"
                  onClick={() => runAction(action.id as PlayerActionId)}
                >
                  <div className="row-between">
                    <span style={{ fontSize: 14.5, fontWeight: 600 }}>{t(`action.${action.id}`)}</span>
                    {action.riskKey && <span className={`risk ${riskClass(action.riskKey)}`}>{t(action.riskKey)}</span>}
                  </div>
                  <p className="faint" style={{ fontSize: 12, marginBlockStart: 4 }}>
                    {t(`action.${action.id}.desc`)}
                  </p>
                </button>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function Relation({ label, value }: { label: string; value: number }) {
  const t = useT();
  const tone = value >= 62 ? 'green' : value >= 40 ? 'amber' : 'red';
  return (
    <div>
      <div className="row-between" style={{ marginBlockEnd: 5 }}>
        <span style={{ fontSize: 13.5 }}>{label}</span>
        <span className="faint" style={{ fontSize: 12 }}>
          {t(relationshipLabel(value))} · <span className="num">{Math.round(value)}</span>
        </span>
      </div>
      <Meter value={value} tone={tone} />
    </div>
  );
}

function riskClass(key: string): string {
  if (key.endsWith('high')) return 'risk-high';
  if (key.endsWith('medium')) return 'risk-medium';
  return 'risk-low';
}
