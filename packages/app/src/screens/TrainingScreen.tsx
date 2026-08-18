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
import { Meter, Card } from '../components/ui.js';

const INTENSITIES: TrainingIntensity[] = ['light', 'normal', 'intensive', 'extreme'];
const DIETS: DietLevel[] = ['poor', 'normal', 'professional', 'nutritionist'];
const FOCUSES: TrainingFocus[] = ['balanced', 'physical', 'technical', 'mental', 'finishing', 'defending', 'goalkeeping', 'recovery'];

const GK_ATTRS: AttributeKey[] = ['reflexes', 'handling', 'positioningGK', 'kicking'];
const TECHNICAL: AttributeKey[] = ATTRIBUTE_KEYS.filter(
  (k) => !PHYSICAL_ATTRS.includes(k) && !MENTAL_ATTRS.includes(k) && !GK_ATTRS.includes(k),
);

interface PlanEffect {
  key: string;
  arrow: string;
  tone: 'good' | 'bad' | 'neutral';
}

/**
 * What the current plan is doing, in plain terms. The player should be able to see
 * why he is sharp and exhausted, or fresh and blunt, without reading the engine.
 */
function planEffects(plan: { intensity: TrainingIntensity; diet: DietLevel; focus: TrainingFocus }): PlanEffect[] {
  const byIntensity: Record<TrainingIntensity, PlanEffect[]> = {
    light: [
      { key: 'train.effect.development', arrow: '↓↓', tone: 'bad' },
      { key: 'train.effect.sharpness', arrow: '↓', tone: 'bad' },
      { key: 'train.effect.fatigue', arrow: '↓↓', tone: 'good' },
      { key: 'train.effect.injury', arrow: '↓', tone: 'good' },
    ],
    normal: [
      { key: 'train.effect.development', arrow: '–', tone: 'neutral' },
      { key: 'train.effect.sharpness', arrow: '–', tone: 'neutral' },
      { key: 'train.effect.fatigue', arrow: '–', tone: 'neutral' },
      { key: 'train.effect.injury', arrow: '–', tone: 'neutral' },
    ],
    intensive: [
      { key: 'train.effect.development', arrow: '↑', tone: 'good' },
      { key: 'train.effect.sharpness', arrow: '↑', tone: 'good' },
      { key: 'train.effect.fatigue', arrow: '↑', tone: 'bad' },
      { key: 'train.effect.injury', arrow: '↑', tone: 'bad' },
    ],
    extreme: [
      { key: 'train.effect.development', arrow: '↑↑', tone: 'good' },
      { key: 'train.effect.sharpness', arrow: '↑↑', tone: 'good' },
      { key: 'train.effect.fatigue', arrow: '↑↑↑', tone: 'bad' },
      { key: 'train.effect.injury', arrow: '↑↑↑', tone: 'bad' },
    ],
  };

  const byDiet: Record<DietLevel, PlanEffect> = {
    poor: { key: 'train.effect.recovery', arrow: '↓↓', tone: 'bad' },
    normal: { key: 'train.effect.recovery', arrow: '–', tone: 'neutral' },
    professional: { key: 'train.effect.recovery', arrow: '↑', tone: 'good' },
    nutritionist: { key: 'train.effect.recovery', arrow: '↑↑', tone: 'good' },
  };

  return [...byIntensity[plan.intensity], byDiet[plan.diet], { key: `train.focus.${plan.focus}`, arrow: '↑', tone: 'good' }];
}

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
        <p className="eyebrow">{t('nav.train')}</p>
        <h1 className="title">{t('train.title')}</h1>
      </header>

      <Card>
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
            <p className="faint" style={{ fontSize: 11.5, marginBlockStart: 6 }}>
              {t(`train.intensity.${plan.intensity}.desc`)}
            </p>
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
            <p className="faint" style={{ fontSize: 11.5, marginBlockStart: 6 }}>
              {t(`train.diet.${plan.diet}.desc`)}
            </p>
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
                    background: plan.focus === focus ? 'var(--amber)' : 'rgba(238,244,238,0.03)',
                    color: plan.focus === focus ? 'var(--bg)' : 'var(--muted)',
                    borderColor: plan.focus === focus ? 'var(--amber)' : 'var(--line-strong)',
                  }}
                >
                  {t(`train.focus.${focus}`)}
                </button>
              ))}
            </div>
          </div>

          <p className="faint" style={{ fontSize: 11.5 }}>{t('train.warning')}</p>

          <div className="card" style={{ background: 'var(--surface-2)', padding: 12 }}>
            <p className="eyebrow" style={{ marginBlockEnd: 8 }}>{t('train.effects')}</p>
            <ul className="list">
              {planEffects(plan).map((effect) => (
                <li key={effect.key} className="list-item" style={{ padding: '7px 0' }}>
                  <span className="grow" style={{ fontSize: 13 }}>{t(effect.key)}</span>
                  <span
                    className="num"
                    style={{ fontSize: 13, color: effect.tone === 'good' ? 'var(--green)' : effect.tone === 'bad' ? 'var(--red)' : 'var(--muted)' }}
                  >
                    {effect.arrow}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <Card>
        <div className="stack" style={{ gap: 10 }}>
          <Line label={t('train.fatigue')} value={player.condition.fatigue} tone={player.condition.fatigue > 60 ? 'red' : 'amber'} />
          <Line label={t('train.sharpness')} value={player.condition.sharpness} tone="blue" />
        </div>
      </Card>

      <Card title={t('train.physical')}>
        <AttrList keys={PHYSICAL_ATTRS} />
      </Card>
      <Card title={isKeeper ? t('train.goalkeeping') : t('train.technical')}>
        <AttrList keys={isKeeper ? GK_ATTRS : TECHNICAL} />
      </Card>
      <Card title={t('train.mental')}>
        <AttrList keys={MENTAL_ATTRS} />
      </Card>

      <Card title={t('train.injuryHistory')}>
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
      </Card>
    </div>
  );
}

function Line({ label, value, tone }: { label: string; value: number; tone: 'amber' | 'amber' | 'red' | 'blue' | 'green' }) {
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
            <Meter value={value} tone={value >= 75 ? 'amber' : value >= 55 ? 'blue' : 'amber'} />
          </div>
        );
      })}
    </div>
  );
}
