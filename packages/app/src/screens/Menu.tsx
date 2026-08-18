import { LANG_LABEL, useLang, useT, type Lang } from '../i18n/index.js';
import { useGame } from '../state/store.js';

export function Menu() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  const hasSave = useGame((s) => s.hasSave);
  const startCreation = useGame((s) => s.startCreation);
  const loadSave = useGame((s) => s.loadSave);

  return (
    <div className="app">
      <div className="screen pitch-lines" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 26, paddingBottom: 30 }}>
        <header style={{ position: 'relative', zIndex: 1 }}>
          <p className="eyebrow" dir="ltr" style={{ marginBlockEnd: 10 }}>2025 / 26</p>
          <h1 className="display" style={{ fontSize: 46, lineHeight: 0.98 }}>
            {t('app.title')}
          </h1>
          <p className="muted" style={{ marginBlockStart: 10, maxWidth: 300 }}>
            {t('home.subtitle')}
          </p>
        </header>

        <div className="stack" style={{ position: 'relative', zIndex: 1 }}>
          {hasSave && (
            <button className="btn btn-primary btn-block" onClick={() => void loadSave()}>
              {t('action.loadCareer')}
            </button>
          )}
          <button className={`btn btn-block ${hasSave ? 'btn-ghost' : 'btn-primary'}`} onClick={startCreation}>
            {t('action.newCareer')}
          </button>
          {!hasSave && <p className="faint" style={{ fontSize: 13 }}>{t('home.noSave')}</p>}
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <p className="eyebrow" style={{ marginBlockEnd: 8 }}>{t('home.language')}</p>
          <div className="seg">
            {(Object.keys(LANG_LABEL) as Lang[]).map((code) => (
              <button key={code} aria-pressed={lang === code} onClick={() => setLang(code)}>
                {LANG_LABEL[code]}
              </button>
            ))}
          </div>
        </div>

        <p className="faint" style={{ fontSize: 11, position: 'relative', zIndex: 1 }}>{t('home.credits')}</p>
      </div>
    </div>
  );
}
