import { useState } from 'react';
import { saveSizeBytes, serialize } from '@fc/engine';
import { LANG_LABEL, useLang, useT, type Lang } from '../i18n/index.js';
import { useGame } from '../state/store.js';
import { useMusicSetting } from '../components/ThemeMusic.js';
import { Card } from '../components/ui.js';
import { CloudPanel } from '../cloud/CloudPanel.js';

export function SettingsScreen() {
  const [soundOn, setSoundOn] = useMusicSetting();
  const save = useGame((s) => s.save);
  const showToast = useGame((s) => s.showToast);
  const t = useT();
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  const state = useGame((s) => s.state)!;
  const goto = useGame((s) => s.goto);
  const deleteSave = useGame((s) => s.deleteSave);
  const [confirming, setConfirming] = useState(false);

  const download = () => {
    const blob = new Blob([serialize(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `football-career-${state.player.lastName.toLowerCase()}-${state.world.season}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="screen stack">
      <header className="row-between">
        <div>
          <p className="eyebrow">{t('settings.title')}</p>
          <h1 className="title">{t('app.title')}</h1>
        </div>
        <button className="eyebrow" onClick={() => goto('hub')}>← {t('nav.hub')}</button>
      </header>

      <Card title={t('settings.language')}>
        <div className="seg">
          {(Object.keys(LANG_LABEL) as Lang[]).map((code) => (
            <button key={code} aria-pressed={lang === code} onClick={() => setLang(code)}>
              {LANG_LABEL[code]}
            </button>
          ))}
        </div>
      </Card>

      <Card title={t('settings.saves')}>
        <button className="btn btn-block" onClick={() => { void save(); showToast(t('settings.saved')); }}>
          {t('settings.saveNow')}
        </button>
        <p className="faint" style={{ fontSize: 11.5, marginBlockStart: 8 }}>{t('settings.savesHint')}</p>
      </Card>

      <Card title={t('settings.sound')}>
        <div className="seg">
          <button aria-pressed={soundOn} onClick={() => setSoundOn(true)}>{t('settings.sound.on')}</button>
          <button aria-pressed={!soundOn} onClick={() => setSoundOn(false)}>{t('settings.sound.off')}</button>
        </div>
        <p className="faint" style={{ fontSize: 11.5, marginBlockStart: 8 }}>{t('settings.sound.hint')}</p>
      </Card>

      <CloudPanel />

      <Card title={t('settings.dev')}>
        <div className="stack" style={{ gap: 8 }}>
          <div className="row-between">
            <span className="eyebrow">{t('settings.seed')}</span>
            <span className="num">{state.careerSeed}</span>
          </div>
          <div className="row-between">
            <span className="eyebrow">{t('settings.saveSize')}</span>
            <span className="num">{Math.round(saveSizeBytes(state) / 1024)} KB</span>
          </div>
          <button className="btn btn-quiet btn-block" onClick={download}>{t('settings.export')}</button>
        </div>
      </Card>

      <Card>
        {confirming ? (
          <div className="stack">
            <p className="headline">{t('action.deleteCareer')}?</p>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-quiet grow" onClick={() => setConfirming(false)}>{t('action.cancel')}</button>
              <button className="btn btn-danger grow" onClick={() => void deleteSave()}>{t('action.confirm')}</button>
            </div>
          </div>
        ) : (
          <button className="btn btn-danger btn-block" onClick={() => setConfirming(true)}>
            {t('action.deleteCareer')}
          </button>
        )}
      </Card>

      <p className="faint" style={{ fontSize: 11 }}>{t('home.credits')}</p>
    </div>
  );
}
