import { useState } from 'react';
import { saveSizeBytes, serialize } from '@fc/engine';
import { LANG_LABEL, useLang, useT, type Lang } from '../i18n/index.js';
import { useGame } from '../state/store.js';
import { Panel } from '../components/ui.js';
import { CloudPanel } from '../cloud/CloudPanel.js';

export function SettingsScreen() {
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
          <h1 className="display" style={{ fontSize: 26, marginBlockStart: 4 }}>{t('app.title')}</h1>
        </div>
        <button className="eyebrow" onClick={() => goto('hub')}>← {t('nav.hub')}</button>
      </header>

      <Panel title={t('settings.language')}>
        <div className="seg">
          {(Object.keys(LANG_LABEL) as Lang[]).map((code) => (
            <button key={code} aria-pressed={lang === code} onClick={() => setLang(code)}>
              {LANG_LABEL[code]}
            </button>
          ))}
        </div>
      </Panel>

      <CloudPanel />

      <Panel title={t('settings.dev')}>
        <div className="stack" style={{ gap: 8 }}>
          <div className="row-between">
            <span className="eyebrow">{t('settings.seed')}</span>
            <span className="num">{state.careerSeed}</span>
          </div>
          <div className="row-between">
            <span className="eyebrow">{t('settings.saveSize')}</span>
            <span className="num">{Math.round(saveSizeBytes(state) / 1024)} KB</span>
          </div>
          <button className="btn btn-ghost btn-block" onClick={download}>{t('settings.export')}</button>
        </div>
      </Panel>

      <Panel>
        {confirming ? (
          <div className="stack">
            <p className="headline">{t('action.deleteCareer')}?</p>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-ghost grow" onClick={() => setConfirming(false)}>{t('action.cancel')}</button>
              <button className="btn btn-danger grow" onClick={() => void deleteSave()}>{t('action.confirm')}</button>
            </div>
          </div>
        ) : (
          <button className="btn btn-danger btn-block" onClick={() => setConfirming(true)}>
            {t('action.deleteCareer')}
          </button>
        )}
      </Panel>

      <p className="faint" style={{ fontSize: 11 }}>{t('home.credits')}</p>
    </div>
  );
}
