import { useEffect, useRef, useState } from 'react';
import { defaultShirtNumber, type Foot, type Position } from '@fc/engine';
import { useLang, useT } from '../i18n/index.js';
import { countryName } from '../lib/names.js';
import {
  BUILD_SHAPES,
  EYE_COLOURS,
  EYE_SHAPES,
  FACIAL_HAIRS,
  HAIR_COLOURS,
  HAIR_STYLES,
  LIMB_LENGTHS,
  MOUTH_SHAPES,
  NOSE_SHAPES,
  SKIN_TONES,
  defaultLook,
  lookFromSeed,
  type AvatarLook,
} from '@fc/engine';
import { AvatarView } from '../avatar/AvatarView.js';
import { getPack, useGame } from '../state/store.js';
import { Card } from '../components/ui.js';
import { PitchPicker } from '../components/PitchPicker.js';

const STEPS = ['create.identity', 'create.physical', 'create.look', 'create.position', 'create.world'] as const;

/**
 * The same numbers the engine applies to a new player's attributes, shown while he
 * is being built so height and weight are a real choice rather than flavour.
 */
function buildEffects(heightCm: number, weightKg: number): { key: string; delta: number }[] {
  const tall = (heightCm - 180) / 10;
  const expectedKg = 76 + (heightCm - 180) * 0.9;
  const heavy = (weightKg - expectedKg) / 6;
  const rows = [
    { key: 'attr.heading', delta: tall * 3.4 + heavy * 0.9 },
    { key: 'attr.jumping', delta: tall * 2.6 },
    { key: 'attr.strength', delta: tall * 1.6 + heavy * 1.8 },
    { key: 'attr.marking', delta: tall * 0.8 + heavy * 0.9 },
    { key: 'attr.acceleration', delta: -tall * 3.0 - heavy * 1.6 },
    { key: 'attr.pace', delta: -tall * 2.4 - heavy * 1.4 },
    { key: 'attr.agility', delta: -tall * 3.0 - heavy * 1.2 },
    { key: 'attr.balance', delta: -tall * 1.2 + heavy * 1.4 },
    { key: 'attr.stamina', delta: -heavy * 1.0 },
  ];
  return rows
    .map((row) => ({ key: row.key, delta: Math.round(row.delta) }))
    .filter((row) => row.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/** A row of choices with a label above it, which is most of this screen. */
function Picker({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBlockStart: 14 }}>
      <p className="eyebrow" style={{ marginBlockEnd: 6 }}>{label}</p>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={`look-chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

function Swatch({ colour, on, onClick }: { colour: string; on: boolean; onClick: () => void }) {
  return (
    <button
      className={`look-swatch ${on ? 'on' : ''}`}
      aria-pressed={on}
      style={{ background: colour }}
      onClick={onClick}
    />
  );
}

/** The kit he is shown in before he has a club: plain, and not anybody's colours. */
const KIT = { shirt: '#e9edf3', shorts: '#1b2333', socks: '#e9edf3' };

export function CreatePlayer() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const pack = getPack();
  const createPlayer = useGame((s) => s.createPlayer);
  const cancel = useGame((s) => s.cancelCreation);

  // Coming back from the club offers, the form opens on the last step with every answer
  // where he left it: he came back to change one thing, not to type it all again.
  const draft = useGame((s) => s.draft);
  const home = pack.countries[0]?.code ?? 'ISR';

  const [step, setStep] = useState(draft ? STEPS.length - 1 : 0);
  const [firstName, setFirstName] = useState(draft?.firstName ?? '');
  const [lastName, setLastName] = useState(draft?.lastName ?? '');
  const [birthCountry, setBirthCountry] = useState(draft?.birthCountry ?? home);
  const [secondCitizenship, setSecondCitizenship] = useState(draft?.secondCitizenship ?? '');
  const [age, setAge] = useState(draft?.age ?? 15);
  const [heightCm, setHeightCm] = useState(draft?.heightCm ?? 178);
  const [weightKg, setWeightKg] = useState(draft?.weightKg ?? 70);
  const [foot, setFoot] = useState<Foot>(draft?.foot ?? 'R');
  const [primaryPos, setPrimaryPos] = useState<Position>(draft?.primaryPos ?? 'CAM');
  const [secondaryPos, setSecondaryPos] = useState<Position | ''>(draft?.secondaryPos?.[0] ?? 'CM');
  const [startCountry, setStartCountry] = useState(draft?.startCountry ?? home);
  const [seed, setSeed] = useState(draft?.seed !== undefined ? String(draft.seed) : '');
  const [picking, setPicking] = useState<'primary' | 'secondary'>('primary');
  const [shirtNumber, setShirtNumber] = useState(draft?.shirtNumber ?? 10);
  /** Until he touches it, the number follows the position he picked. */
  const [shirtTouched, setShirtTouched] = useState(draft?.shirtNumber !== undefined);
  const [look, setLook] = useState<AvatarLook>(draft?.look ?? defaultLook());

  // The back gesture belongs to this form while it is open: it walks back through the
  // steps, and only once he is at the first one does it mean anything else.
  const setBackHandler = useGame((s) => s.setBackHandler);
  const stepNow = useRef(step);
  stepNow.current = step;
  useEffect(() => {
    setBackHandler(() => {
      if (stepNow.current === 0) return false;
      setStep(stepNow.current - 1);
      return true;
    });
    return () => setBackHandler(null);
  }, [setBackHandler]);

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
      shirtNumber: shirtTouched ? shirtNumber : defaultShirtNumber(primaryPos),
      look,
      startCountry,
      ...(seed.trim() ? { seed: Number(seed.trim()) >>> 0 } : {}),
    });
  };

  return (
    <>
      <div className="device-frame">
        <img src="/bg/stadium.jpg" alt="" className="backdrop-photo" />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(6,11,24,0.78), rgba(6,11,24,0.9) 55%, rgba(5,9,20,0.95))' }} />
      </div>
      <div className="app">
      <div className="screen stack" style={{ paddingBottom: 120 }}>
        <header>
          <p className="eyebrow">{t('create.step', { step: step + 1, total: STEPS.length })}</p>
          <h1 className="title">{t('create.title')}</h1>
        </header>

        {step === 0 && (
          <Card title={t('create.identity')}>
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
                    <option key={c.code} value={c.code}>{countryName(c, lang)}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="sc">{t('create.secondCitizenship')}</label>
                <select id="sc" value={secondCitizenship} onChange={(e) => setSecondCitizenship(e.target.value)}>
                  <option value="">{t('create.none')}</option>
                  {pack.countries.filter((c) => c.code !== birthCountry).map((c) => (
                    <option key={c.code} value={c.code}>{countryName(c, lang)}</option>
                  ))}
                </select>
              </div>
            </div>
          </Card>
        )}

        {step === 1 && (
          <Card title={t('create.physical')}>
            <div className="stack">
              <NumberField label={t('create.age')} value={age} min={14} max={16} onChange={setAge} />
              <NumberField label={t('create.height')} value={heightCm} min={160} max={205} onChange={setHeightCm} />
              <NumberField label={t('create.weight')} value={weightKg} min={55} max={100} onChange={setWeightKg} />

              <div>
                <NumberField
                  label={t('create.shirtNumber')}
                  value={shirtTouched ? shirtNumber : defaultShirtNumber(primaryPos)}
                  min={1}
                  max={99}
                  onChange={(value) => { setShirtTouched(true); setShirtNumber(value); }}
                />
                <p className="faint" style={{ fontSize: 11.5, marginBlockStart: 6 }}>{t('create.shirtNumberHint')}</p>
              </div>

              <div className="card" style={{ background: 'var(--surface-2)', padding: 12 }}>
                <p className="eyebrow" style={{ marginBlockEnd: 8 }}>{t('create.buildEffects')}</p>
                <ul className="list">
                  {buildEffects(heightCm, weightKg).map((effect) => (
                    <li key={effect.key} className="list-item" style={{ padding: '6px 0' }}>
                      <span className="grow" style={{ fontSize: 13 }}>{t(effect.key)}</span>
                      <span
                        className="num"
                        style={{ fontSize: 13, color: effect.delta > 0 ? 'var(--green)' : 'var(--red)' }}
                      >
                        {effect.delta > 0 ? '+' : ''}{effect.delta}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="eyebrow" style={{ marginBlockEnd: 6 }}>{t('create.foot')}</p>
                <div className="seg">
                  {(['L', 'R', 'B'] as Foot[]).map((f) => (
                    <button key={f} aria-pressed={foot === f} onClick={() => setFoot(f)}>{t(`create.foot.${f}`)}</button>
                  ))}
                </div>
                <p className="faint" style={{ fontSize: 11.5, marginBlockStart: 6 }}>{t(`create.foot.${foot}.desc`)}</p>
              </div>
            </div>
          </Card>
        )}

        {/*
          * Him, in three dimensions.
          *
          * Eighteen seasons of a career and the only thing on screen that was supposed
          * to be him was a shirt number. He is built out of shapes rather than a
          * downloaded model, so it costs nothing to ship and every choice below moves a
          * number rather than swapping a picture.
          */}
        {step === 2 && (
          <Card title={t('create.look')}>
            <AvatarView look={look} heightCm={heightCm} kit={KIT} height={250} />

            <Picker label={t('look.skin')}>
              {SKIN_TONES.map((tone, i) => (
                <Swatch key={tone} colour={tone} on={look.skin === i} onClick={() => setLook({ ...look, skin: i })} />
              ))}
            </Picker>

            <Picker label={t('look.hair')}>
              {HAIR_STYLES.map((style) => (
                <Chip key={style} on={look.hair === style} onClick={() => setLook({ ...look, hair: style })}>
                  {t(`look.hair.${style}`)}
                </Chip>
              ))}
            </Picker>

            <Picker label={t('look.hairColour')}>
              {HAIR_COLOURS.map((colour, i) => (
                <Swatch key={colour} colour={colour} on={look.hairColour === i} onClick={() => setLook({ ...look, hairColour: i })} />
              ))}
            </Picker>

            <Picker label={t('look.facialHair')}>
              {FACIAL_HAIRS.map((style) => (
                <Chip key={style} on={look.facialHair === style} onClick={() => setLook({ ...look, facialHair: style })}>
                  {t(`look.facialHair.${style}`)}
                </Chip>
              ))}
            </Picker>

            <Picker label={t('look.eyes')}>
              {EYE_SHAPES.map((shape) => (
                <Chip key={shape} on={look.eyes === shape} onClick={() => setLook({ ...look, eyes: shape })}>
                  {t(`look.eyes.${shape}`)}
                </Chip>
              ))}
            </Picker>

            <Picker label={t('look.eyeColour')}>
              {EYE_COLOURS.map((colour, i) => (
                <Swatch key={colour} colour={colour} on={look.eyeColour === i} onClick={() => setLook({ ...look, eyeColour: i })} />
              ))}
            </Picker>

            <Picker label={t('look.nose')}>
              {NOSE_SHAPES.map((shape) => (
                <Chip key={shape} on={look.nose === shape} onClick={() => setLook({ ...look, nose: shape })}>
                  {t(`look.nose.${shape}`)}
                </Chip>
              ))}
            </Picker>

            <Picker label={t('look.mouth')}>
              {MOUTH_SHAPES.map((shape) => (
                <Chip key={shape} on={look.mouth === shape} onClick={() => setLook({ ...look, mouth: shape })}>
                  {t(`look.mouth.${shape}`)}
                </Chip>
              ))}
            </Picker>

            <Picker label={t('look.build')}>
              {BUILD_SHAPES.map((shape) => (
                <Chip key={shape} on={look.build === shape} onClick={() => setLook({ ...look, build: shape })}>
                  {t(`look.build.${shape}`)}
                </Chip>
              ))}
            </Picker>

            <Picker label={t('look.limbs')}>
              {LIMB_LENGTHS.map((length) => (
                <Chip key={length} on={look.limbs === length} onClick={() => setLook({ ...look, limbs: length })}>
                  {t(`look.limbs.${length}`)}
                </Chip>
              ))}
            </Picker>

            <Picker label={t('look.sleeves')}>
              {(['short', 'long'] as const).map((length) => (
                <Chip key={length} on={look.sleeves === length} onClick={() => setLook({ ...look, sleeves: length })}>
                  {t(`look.sleeves.${length}`)}
                </Chip>
              ))}
            </Picker>

            <Picker label={t('look.wearing')}>
              <Chip on={look.earring} onClick={() => setLook({ ...look, earring: !look.earring })}>{t('look.earring')}</Chip>
              <Chip on={look.necklace} onClick={() => setLook({ ...look, necklace: !look.necklace })}>{t('look.necklace')}</Chip>
              <Chip on={look.bracelet} onClick={() => setLook({ ...look, bracelet: !look.bracelet })}>{t('look.bracelet')}</Chip>
            </Picker>

            <button className="btn btn-quiet btn-block" style={{ marginBlockStart: 12 }} onClick={() => setLook(lookFromSeed(String(Date.now())))}>
              {t('look.surprise')}
            </button>
          </Card>
        )}

        {step === 3 && (
          <Card title={t('create.position')}>
            <div className="stack">
              <div className="seg">
                <button aria-pressed={picking === 'primary'} onClick={() => setPicking('primary')}>
                  {t('create.primaryPos')}
                </button>
                <button aria-pressed={picking === 'secondary'} onClick={() => setPicking('secondary')}>
                  {t('create.secondaryPos')}
                </button>
              </div>

              <PitchPicker
                value={picking === 'primary' ? primaryPos : (secondaryPos || primaryPos)}
                secondary={picking === 'primary' ? secondaryPos : primaryPos}
                onPick={(pos) => {
                  if (picking === 'primary') {
                    setPrimaryPos(pos);
                    if (secondaryPos === pos) setSecondaryPos('');
                  } else {
                    setSecondaryPos(pos === primaryPos ? '' : pos);
                  }
                }}
              />

              <div className="row-between">
                <span className="faint" style={{ fontSize: 12.5 }}>{t('create.primaryPos')}</span>
                <span className="chip chip-pink">{primaryPos} · {t(`pos.${primaryPos}`)}</span>
              </div>
              <div className="row-between">
                <span className="faint" style={{ fontSize: 12.5 }}>{t('create.secondaryPos')}</span>
                {secondaryPos ? (
                  <span className="chip chip-amber">{secondaryPos} · {t(`pos.${secondaryPos}`)}</span>
                ) : (
                  <button className="chip" onClick={() => setPicking('secondary')}>{t('create.none')}</button>
                )}
              </div>
            </div>
          </Card>
        )}

        {step === 4 && (
          <Card title={t('create.world')}>
            <div className="stack">
              <div className="field">
                <label htmlFor="start">{t('create.startCountry')}</label>
                <select id="start" value={startCountry} onChange={(e) => setStartCountry(e.target.value)}>
                  {pack.countries.map((c) => (
                    <option key={c.code} value={c.code}>{countryName(c, lang)}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="seed">{t('create.seed')}</label>
                <input id="seed" value={seed} inputMode="numeric" onChange={(e) => setSeed(e.target.value.replace(/\D/g, ''))} />
                <span className="faint" style={{ fontSize: 11 }}>{t('create.seedHint')}</span>
              </div>
            </div>
          </Card>
        )}

        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-quiet" onClick={() => (step === 0 ? cancel() : setStep(step - 1))}>
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
    </>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="row">
        <button className="btn btn-quiet" onClick={() => onChange(Math.max(min, value - 1))}>−</button>
        <span className="num grow" style={{ textAlign: 'center', fontSize: 20 }}>{value}</span>
        <button className="btn btn-quiet" onClick={() => onChange(Math.min(max, value + 1))}>+</button>
      </div>
    </div>
  );
}
