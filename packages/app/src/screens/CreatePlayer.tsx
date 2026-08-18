import { useState } from 'react';
import { POSITIONS, type Foot, type Position } from '@fc/engine';
import { useT } from '../i18n/index.js';
import { getPack, useGame } from '../state/store.js';
import { Panel } from '../components/ui.js';

const STEPS = ['create.identity', 'create.physical', 'create.position', 'create.world'] as const;

export function CreatePlayer() {
  const t = useT();
  const pack = getPack();
  const createPlayer = useGame((s) => s.createPlayer);
  const cancel = useGame((s) => s.cancelCreation);

  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthCountry, setBirthCountry] = useState(pack.countries[0]?.code ?? 'ISR');
  const [secondCitizenship, setSecondCitizenship] = useState('');
  const [age, setAge] = useState(15);
  const [heightCm, setHeightCm] = useState(178);
  const [weightKg, setWeightKg] = useState(70);
  const [foot, setFoot] = useState<Foot>('R');
  const [primaryPos, setPrimaryPos] = useState<Position>('CAM');
  const [secondaryPos, setSecondaryPos] = useState<Position | ''>('CM');
  const [startCountry, setStartCountry] = useState(pack.countries[0]?.code ?? 'ISR');
  const [seed, setSeed] = useState('');

  const canAdvance = step !== 0 || (firstName.trim().length > 0 && lastName.trim().length > 0);

  const begin = () => {
    createPlayer({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthCountry,
      ...(secondCitizenship ? { secondCitizenship } : {}),
      age,
      heightCm,
      weightKg,
      foot,
      primaryPos,
      secondaryPos: secondaryPos ? [secondaryPos] : [],
      startCountry,
      ...(seed.trim() ? { seed: Number(seed.trim()) >>> 0 } : {}),
    });
  };

  return (
    <div className="app">
      <div className="screen stack" style={{ paddingBottom: 120 }}>
        <header>
          <p className="eyebrow">{t('create.step', { step: step + 1, total: STEPS.length })}</p>
          <h1 className="display" style={{ fontSize: 30, marginBlockStart: 6 }}>{t('create.title')}</h1>
        </header>

        {step === 0 && (
          <Panel title={t('create.identity')}>
            <div className="stack">
              <div className="field">
                <label htmlFor="fn">{t('create.firstName')}</label>
                <input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="off" />
              </div>
              <div className="field">
                <label htmlFor="ln">{t('create.lastName')}</label>
                <input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="off" />
              </div>
              <div className="field">
                <label htmlFor="bc">{t('create.country')}</label>
                <select id="bc" value={birthCountry} onChange={(e) => setBirthCountry(e.target.value)}>
                  {pack.countries.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="sc">{t('create.secondCitizenship')}</label>
                <select id="sc" value={secondCitizenship} onChange={(e) => setSecondCitizenship(e.target.value)}>
                  <option value="">{t('create.none')}</option>
                  {pack.countries.filter((c) => c.code !== birthCountry).map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </Panel>
        )}

        {step === 1 && (
          <Panel title={t('create.physical')}>
            <div className="stack">
              <NumberField label={t('create.age')} value={age} min={14} max={16} onChange={setAge} />
              <NumberField label={t('create.height')} value={heightCm} min={160} max={205} onChange={setHeightCm} />
              <NumberField label={t('create.weight')} value={weightKg} min={55} max={100} onChange={setWeightKg} />
              <div>
                <p className="eyebrow" style={{ marginBlockEnd: 6 }}>{t('create.foot')}</p>
                <div className="seg">
                  {(['L', 'R', 'B'] as Foot[]).map((f) => (
                    <button key={f} aria-pressed={foot === f} onClick={() => setFoot(f)}>{t(`create.foot.${f}`)}</button>
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        )}

        {step === 2 && (
          <Panel title={t('create.position')}>
            <div className="stack">
              <div>
                <p className="eyebrow" style={{ marginBlockEnd: 8 }}>{t('create.primaryPos')}</p>
                <PositionGrid value={primaryPos} onChange={setPrimaryPos} />
              </div>
              <div className="field">
                <label htmlFor="sp">{t('create.secondaryPos')}</label>
                <select id="sp" value={secondaryPos} onChange={(e) => setSecondaryPos(e.target.value as Position | '')}>
                  <option value="">{t('create.none')}</option>
                  {POSITIONS.filter((p) => p !== primaryPos).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
          </Panel>
        )}

        {step === 3 && (
          <Panel title={t('create.world')}>
            <div className="stack">
              <div className="field">
                <label htmlFor="start">{t('create.startCountry')}</label>
                <select id="start" value={startCountry} onChange={(e) => setStartCountry(e.target.value)}>
                  {pack.countries.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="seed">{t('create.seed')}</label>
                <input id="seed" value={seed} inputMode="numeric" onChange={(e) => setSeed(e.target.value.replace(/\D/g, ''))} />
                <span className="faint" style={{ fontSize: 11 }}>{t('create.seedHint')}</span>
              </div>
            </div>
          </Panel>
        )}

        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => (step === 0 ? cancel() : setStep(step - 1))}>
            {t('action.back')}
          </button>
          {step < STEPS.length - 1 ? (
            <button className="btn btn-primary grow" disabled={!canAdvance} onClick={() => setStep(step + 1)}>
              {t('action.next')}
            </button>
          ) : (
            <button className="btn btn-primary grow" onClick={begin}>{t('create.begin')}</button>
          )}
        </div>
      </div>
    </div>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="row">
        <button className="btn btn-ghost" onClick={() => onChange(Math.max(min, value - 1))}>−</button>
        <span className="num grow" style={{ textAlign: 'center', fontSize: 20 }}>{value}</span>
        <button className="btn btn-ghost" onClick={() => onChange(Math.min(max, value + 1))}>+</button>
      </div>
    </div>
  );
}

const POSITION_ROWS: Position[][] = [
  ['LW', 'ST', 'CF', 'RW'],
  ['LM', 'CAM', 'CM', 'RM'],
  ['LWB', 'CDM', 'CB', 'RWB'],
  ['LB', 'GK', 'RB'],
];

function PositionGrid({ value, onChange }: { value: Position; onChange: (p: Position) => void }) {
  return (
    <div className="stack pitch-lines" style={{ gap: 6, padding: 8, border: '1px solid var(--chalk-line)' }}>
      {POSITION_ROWS.map((row, i) => (
        <div key={i} className="row" style={{ gap: 6, position: 'relative', zIndex: 1 }}>
          {row.map((pos) => (
            <button
              key={pos}
              onClick={() => onChange(pos)}
              className="num"
              style={{
                flex: 1,
                padding: '10px 4px',
                fontSize: 12,
                borderRadius: 2,
                border: '1px solid var(--chalk-line-strong)',
                background: value === pos ? 'var(--flood)' : 'rgba(238,244,238,0.03)',
                color: value === pos ? 'var(--pitch-900)' : 'var(--ink-dim)',
              }}
            >
              {pos}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
