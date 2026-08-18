import {
  ATTRIBUTE_KEYS,
  MENTAL_ATTRS,
  PHYSICAL_ATTRS,
  type AttributeKey,
  type DietLevel,
  type TrainingFocus,
  type TrainingIntensity,
} from '@fc/engine';
import { useT } from '../i18n/index.js';
import { useGame } from '../state/store.js';
import { Meter, Panel } from '../components/ui.js';

const INTENSITIES: TrainingIntensity[] = ['light', 'normal', 'intensive', 'extreme'];
const DIETS: DietLevel[] = ['poor', 'normal', 'professional', 'nutritionist'];
const FOCUSES: TrainingFocus[] = ['balanced', 'physical', 'technical', 'mental', 'finishing', 'defending', 'goalkeeping', 'recovery'];

const GK_ATTRS: AttributeKey[] = ['reflexes', 'handling', 'positioningGK', 'kicking'];
const TECHNICAL: AttributeKey[] = ATTRIBUTE_KEYS.filter(
  (k) => !PHYSICAL_ATTRS.includes(k) && !MENTAL_ATTRS.includes(k) && !GK_ATTRS.includes(k),
);

export function TrainingScreen() {
  const t = useT();
  const state = useGame((s) => s.state)!;
  const update = useGame((s) => s.updateTraining);
  const plan = state.training;
  const player = state.player;
  const isKeeper = player.primaryPos === 'GK';

  return (
    <div className="screen stack">
      <header>
        <p className="eyebrow">{t('train.title')}</p>
        <h1 className="display" style={{ fontSize: 26, marginBlockStart: 4 }}>{t('train.intensity')}</h1>
      </header>

      <Panel>
        <div className="stack">
          <div>
            <p className="eyebrow" style={{ marginBlockEnd: 6 }}>{t('train.intensity')}</p>
            <div className="seg">
              {INTENSITIES.map((level) => (
                <button key={level} aria-pressed={plan.intensity === level} onClick={() => update({ intensity: level })}>
                  {t(`train.intensity.${level}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="eyebrow" style={{ marginBlockEnd: 6 }}>{t('train.diet')}</p>
            <div className="seg">
              {DIETS.map((level) => (
                <button key={level} aria-pressed={plan.diet === level} onClick={() => update({ diet: level })}>
                  {t(`train.diet.${level}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="eyebrow" style={{ marginBlockEnd: 6 }}>{t('train.focus')}</p>
            <div className="grid-2" style={{ gap: 6 }}>
              {FOCUSES.filter((f) => f !== 'goalkeeping' || isKeeper).map((focus) => (
                <button
                  key={focus}
                  onClick={() => update({ focus })}
                  className="btn"
                  style={{
                    padding: '9px 6px',
                    fontSize: 12.5,
                    background: plan.focus === focus ? 'var(--flood)' : 'rgba(238,244,238,0.03)',
                    color: plan.focus === focus ? 'var(--pitch-900)' : 'var(--ink-dim)',
                    borderColor: plan.focus === focus ? 'var(--flood)' : 'var(--chalk-line-strong)',
                  }}
                >
                  {t(`train.focus.${focus}`)}
                </button>
              ))}
            </div>
          </div>

          <p className="faint" style={{ fontSize: 11.5 }}>{t('train.warning')}</p>
        </div>
      </Panel>

      <Panel>
        <div className="stack" style={{ gap: 10 }}>
          <Line label={t('train.fatigue')} value={player.condition.fatigue} tone={player.condition.fatigue > 60 ? 'blood' : 'amber'} />
          <Line label={t('train.sharpness')} value={player.condition.sharpness} tone="sky" />
        </div>
      </Panel>

      <Panel title={t('train.physical')}>
        <AttrList keys={PHYSICAL_ATTRS} />
      </Panel>
      <Panel title={isKeeper ? t('train.goalkeeping') : t('train.technical')}>
        <AttrList keys={isKeeper ? GK_ATTRS : TECHNICAL} />
      </Panel>
      <Panel title={t('train.mental')}>
        <AttrList keys={MENTAL_ATTRS} />
      </Panel>

      <Panel title={t('train.injuryHistory')}>
        {player.condition.injuryHistory.length === 0 && player.condition.injuries.length === 0 ? (
          <p className="faint" style={{ fontSize: 13 }}>{t('train.noInjuries')}</p>
        ) : (
          <ul className="list">
            {[...player.condition.injuries, ...player.condition.injuryHistory].map((injury) => (
              <li key={injury.id} className="list-item">
                <span className="num faint" style={{ fontSize: 11, minWidth: 36 }}>{injury.season}</span>
                <span className="grow" style={{ fontSize: 13 }}>{t(`injury.${injury.type}`)}</span>
                <span className="faint" style={{ fontSize: 11.5 }}>
                  {t('train.weeksOut', { weeks: injury.weeksOut })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Line({ label, value, tone }: { label: string; value: number; tone: 'flood' | 'amber' | 'blood' | 'sky' }) {
  return (
    <div>
      <div className="row-between" style={{ marginBlockEnd: 4 }}>
        <span className="eyebrow">{label}</span>
        <span className="num" style={{ fontSize: 12 }}>{Math.round(value)}</span>
      </div>
      <Meter value={value} tone={tone} />
    </div>
  );
}

function AttrList({ keys }: { keys: readonly AttributeKey[] }) {
  const t = useT();
  const state = useGame((s) => s.state)!;
  return (
    <div>
      {keys.map((key) => {
        const value = Math.round(state.player.attributes[key]);
        return (
          <div key={key} className="attr-row">
            <span style={{ fontSize: 13 }}>{t(`attr.${key}`)}</span>
            <span className="num">{value}</span>
            <Meter value={value} tone={value >= 75 ? 'flood' : value >= 55 ? 'sky' : 'amber'} />
          </div>
        );
      })}
    </div>
  );
}
