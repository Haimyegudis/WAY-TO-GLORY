import { useState } from 'react';
import { LANG_LABEL, formatSeason, useLang, useT, type Lang } from '../i18n/index.js';
import { useGame } from '../state/store.js';

/**
 * Title screen. If the artwork is present it carries the screen on its own; if it
 * is missing the same composition is drawn with type and gradients instead, so the
 * game never opens on a broken image.
 */
export function Menu() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  const saves = useGame((s) => s.saves);
  const startCreation = useGame((s) => s.startCreation);
  const loadSave = useGame((s) => s.loadSave);
  const deleteSave = useGame((s) => s.deleteSave);
  const [artFailed, setArtFailed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // The careers hide behind a button: a title screen is not a file manager.
  const [listOpen, setListOpen] = useState(false);

  return (
    <>
      <div className="device-frame">
        {artFailed && <div className="backdrop" />}
        {!artFailed && (
          <>
            <img src="/bg/hero.jpg" alt="" className="hero-art" onError={() => setArtFailed(true)} />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(180deg, rgba(6,11,24,0.05) 0%, rgba(6,11,24,0.15) 45%, rgba(6,11,24,0.82) 74%, rgba(4,8,18,0.96) 100%)',
              }}
            />
          </>
        )}
      </div>

      <div className="app">
        <div
          className="screen"
          style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            gap: 18,
            paddingBottom: 26,
          }}
        >
          <h1 className="sr-only">{t('app.title')}</h1>
          {artFailed && (
            <header style={{ marginBlockEnd: 'auto', paddingBlockStart: '22vh', textAlign: 'center' }}>
              <p className="eyebrow" dir="ltr">2026 / 27</p>
              <h1
                style={{
                  fontSize: 44,
                  fontWeight: 700,
                  lineHeight: 1.05,
                  marginBlockStart: 10,
                  background: 'linear-gradient(180deg, #ffe9a8, var(--amber) 60%, #b8862a)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                {t('app.title')}
              </h1>
              <p className="muted" style={{ marginBlockStart: 10 }}>{t('home.subtitle')}</p>
            </header>
          )}

          <div className="stack">
            {saves.length > 0 && !listOpen && (
              <button className="btn btn-amber btn-block" onClick={() => setListOpen(true)}>
                {t('action.loadCareer')} ({saves.length})
              </button>
            )}

            {saves.length > 0 && listOpen && (
              <div className="save-list">
                <div className="row-between" style={{ marginBlockEnd: 6 }}>
                  <p className="eyebrow">{t('home.careers')}</p>
                  <button className="eyebrow" onClick={() => setListOpen(false)}>{t('action.close')}</button>
                </div>
                {saves.map((save) => (
                  <div key={save.id} className="save-row">
                    <button className="save-open" onClick={() => void loadSave(save.id)}>
                      <span className="save-name">
                        {save.playerName}
                        {save.retired && <span className="chip"> {t('home.retired')}</span>}
                      </span>
                      <span className="save-meta faint">
                        {save.clubName || t('hub.freeAgent')} · {formatSeason(save.season)} ·{' '}
                        {t('home.saveLine', { age: save.age, ovr: save.ovr })}
                      </span>
                    </button>
                    {confirmDelete === save.id ? (
                      <span className="row" style={{ gap: 6 }}>
                        <button
                          className="save-delete danger"
                          onClick={() => {
                            void deleteSave(save.id);
                            setConfirmDelete(null);
                          }}
                        >
                          {t('action.confirmDelete')}
                        </button>
                        <button className="save-delete" onClick={() => setConfirmDelete(null)}>
                          {t('action.cancel')}
                        </button>
                      </span>
                    ) : (
                      <button
                        className="save-delete"
                        aria-label={t('action.deleteSave')}
                        onClick={() => setConfirmDelete(save.id)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button className={`btn btn-block ${saves.length > 0 ? '' : 'btn-amber'}`} onClick={startCreation}>
              {t('action.newCareer')}
            </button>
          </div>

          <div className="seg">
            {(Object.keys(LANG_LABEL) as Lang[]).map((code) => (
              <button key={code} aria-pressed={lang === code} onClick={() => setLang(code)}>
                {LANG_LABEL[code]}
              </button>
            ))}
          </div>

          <p className="faint center" style={{ fontSize: 11 }}>{t('home.credits')}</p>
        </div>
      </div>
    </>
  );
}
