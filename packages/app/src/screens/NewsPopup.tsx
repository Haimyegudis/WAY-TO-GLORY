import { useEffect } from 'react';
import type { InboxMessage } from '@fc/engine';
import { formatSeason, hasTranslation, useLang, useT } from '../i18n/index.js';
import { getPack, useGame } from '../state/store.js';
import { localiseArgs } from '../lib/club.js';
import { DecisionOptions } from './DecisionSheet.js';

/**
 * Anything that happened this week, put in front of him.
 *
 * The inbox was a list he had to remember to open, so a manager falling out with him, a
 * scout at the ground and a sponsor calling all had the same weight as nothing at all -
 * a dot on a card he might scroll past. News is news: it comes up, it is read, and it is
 * dismissed one at a time.
 *
 * A message that carries a question is answered here rather than filed, which is the
 * whole reason it was sent.
 */
export function NewsPopup() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state);
  const pending = useGame((s) => s.pendingNews);
  const dismiss = useGame((s) => s.dismissNews);
  const applyAction = useGame((s) => s.applyInboxAction);
  const pack = getPack();

  const message: InboxMessage | undefined = state?.inbox.find((entry) => entry.id === pending[0]);

  /*
   * A message that is no longer there must not block the ones behind it.
   *
   * The inbox keeps the last eighty messages, so a busy run of weeks can evict one that
   * is still sitting at the head of the queue - and the popup, finding nothing to draw,
   * drew nothing and left the whole queue stuck behind it for the rest of the career.
   * That is why the notifications stopped after the first few.
   */
  useEffect(() => {
    if (state && pending.length > 0 && !message) dismiss();
  }, [state, pending, message, dismiss]);

  if (!state || pending.length === 0 || !message) return null;

  const question = message.decisionId
    ? state.pendingDecisions.find((decision) => decision.id === message.decisionId) ?? null
    : null;
  const args = localiseArgs(message.args, pack.clubs, lang);
  const title = t(message.titleKey, args);

  return (
    <div className="sheet-backdrop" onClick={() => dismiss()}>
      <div
        className="sheet mail"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-grip" />
        <div className="row-between">
          <p className="eyebrow">{t(`inboxFrom.${message.category}`)}</p>
          {pending.length > 1 && (
            <span className="faint" style={{ fontSize: 11.5 }}>
              {t('news.more', { count: pending.length - 1 })}
            </span>
          )}
        </div>
        <h2 className="headline" style={{ marginBlockStart: 4 }}>{title}</h2>
        <p className="faint" style={{ fontSize: 11.5, marginBlockStart: 4 }}>
          {formatSeason(message.season)} · {t('hub.week', { week: message.week })}
        </p>
        {hasTranslation(lang, `${message.titleKey}.body`) && (
          <p style={{ fontSize: 13.5, marginBlockStart: 12, lineHeight: 1.6 }}>
            {t(`${message.titleKey}.body`, args)}
          </p>
        )}
        {question ? (
          <div style={{ marginBlockStart: 16 }}>
            <DecisionOptions decision={question} onAnswered={() => dismiss()} />
          </div>
        ) : message.action ? (
          <div className="stack" style={{ marginBlockStart: 16, gap: 8 }}>
            <button className="btn btn-primary btn-block" onClick={() => applyAction(message.id)}>
              {t('inbox.action.applyTraining')}
            </button>
            <button className="btn btn-quiet btn-block" onClick={() => dismiss()}>
              {pending.length > 1 ? t('news.next') : t('action.close')}
            </button>
          </div>
        ) : (
          <button className="btn btn-primary btn-block" style={{ marginBlockStart: 16 }} onClick={() => dismiss()}>
            {pending.length > 1 ? t('news.next') : t('action.close')}
          </button>
        )}
      </div>
    </div>
  );
}
