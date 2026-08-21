import { useState } from 'react';
import {
  MENTOR_COOLDOWN_WEEKS,
  canTalkToMentor,
  mentorById,
  mentorChoices,
  mentorTopics,
  type MentorReply,
  type MentorTopic,
} from '@fc/engine';
import { hasTranslation, useLang, useT } from '../i18n/index.js';
import { useGame } from '../state/store.js';
import { countryName as localisedCountry } from '../lib/names.js';
import { getPack } from '../state/store.js';
import { Card, Chip, Empty, Meter, Stat } from '../components/ui.js';

/**
 * The old player who took an interest.
 *
 * Everything else in the game tells him numbers. This screen is the one place somebody
 * tells him what to do about them - and because the advice sets the brief his agent
 * works to, taking it is a move rather than a mood.
 */
export function MentorScreen() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const state = useGame((s) => s.state)!;
  const goto = useGame((s) => s.goto);
  const chooseMentor = useGame((s) => s.chooseMentor);
  const askMentor = useGame((s) => s.askMentor);
  const takeAdvice = useGame((s) => s.takeMentorAdvice);
  const pack = getPack();

  const [picking, setPicking] = useState(false);
  const [reply, setReply] = useState<MentorReply | null>(null);
  const [taken, setTaken] = useState(false);

  const held = state.mentor;
  const mentor = held ? mentorById(held.id) : undefined;
  const age = state.world.season - state.player.birthYear;
  const topics: MentorTopic[] = mentorTopics(state, age);
  const questionKey = (topic: MentorTopic) => {
    // Different wording on later meetings prevents a contextual system from looking
    // like a static FAQ. The career clock and conversation count make it stable across
    // save/reload, while the topic hash stops every button changing in lockstep.
    const hash = [...topic].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    const variant = (state.world.season * 52 + state.world.week + (held?.talks ?? 0) + hash) % 3;
    const candidate = variant === 0 ? `mentor.ask.${topic}` : `mentor.ask.${topic}.v${variant + 1}`;
    return hasTranslation(lang, candidate) ? candidate : `mentor.ask.${topic}`;
  };
  const name = (mentor: { name: string; nameHe: string }) => (lang === 'he' ? mentor.nameHe : mentor.name);
  // The clubs they are remembered with are in the pack, so they read in Hebrew too.
  const clubLabel = (raw: string) => {
    if (lang !== 'he') return raw;
    // The pack spells clubs the way the federations do - "Liverpool FC", "Real Madrid CF" -
    // so the short name is what matches how an old player would say it.
    const club =
      pack.clubs.find((entry) => entry.shortName === raw) ?? pack.clubs.find((entry) => entry.name === raw);
    return club?.nameHe ?? raw;
  };
  const country = (code: string) => localisedCountry(pack.countries.find((c) => c.code === code), lang) || code;

  const ask = (topic: MentorTopic) => {
    const answer = askMentor(topic);
    setReply(answer);
    setTaken(false);
  };

  if (!mentor || picking) {
    return (
      <div className="screen stack">
        <header className="row-between">
          <div>
            <p className="eyebrow">{t('mentor.title')}</p>
            <h1 className="title">{t('mentor.choose')}</h1>
          </div>
          <button className="eyebrow" onClick={() => (picking ? setPicking(false) : goto('social'))}>
            ← {t('action.back')}
          </button>
        </header>

        <p className="faint" style={{ fontSize: 12 }}>{t('mentor.chooseHint')}</p>

        <div className="stack" style={{ gap: 8 }}>
          {mentorChoices(state).map((candidate) => (
            <button
              key={candidate.id}
              className="option"
              onClick={() => {
                chooseMentor(candidate.id);
                setPicking(false);
                setReply(null);
              }}
            >
              <div className="row-between">
                <span style={{ fontSize: 15, fontWeight: 700 }}>{name(candidate)}</span>
                <Chip tone="amber">{t(`mentor.tag.${candidate.tag}`)}</Chip>
              </div>
              <p className="faint" style={{ fontSize: 12, marginBlockStart: 5 }}>
                {country(candidate.country)} · {candidate.position} · {candidate.era} · {clubLabel(candidate.club)}
              </p>
              <p className="faint" style={{ fontSize: 12, marginBlockStart: 3 }}>
                {t(`mentor.voice.${candidate.voice}`)}
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const ready = canTalkToMentor(state);

  return (
    <div className="screen stack">
      <header className="row-between">
        <div>
          <p className="eyebrow">{t('mentor.title')}</p>
          <h1 className="title">{name(mentor)}</h1>
        </div>
        <button className="eyebrow" onClick={() => goto('social')}>← {t('action.back')}</button>
      </header>

      <Card>
        <div className="row-between" style={{ marginBlockEnd: 8 }}>
          <span className="faint" style={{ fontSize: 12 }}>
            {country(mentor.country)} · {mentor.position} · {mentor.era} · {clubLabel(mentor.club)}
          </span>
          <Chip tone="amber">{t(`mentor.tag.${mentor.tag}`)}</Chip>
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 1.6 }}>{t(`mentor.voice.${mentor.voice}`)}</p>

        <div className="statrow" style={{ marginBlockStart: 12 }}>
          <Stat label={t('mentor.talks')} value={held?.talks ?? 0} />
          <Stat label={t('mentor.followed')} value={held?.followed ?? 0} />
        </div>
        <div style={{ marginBlockStart: 10 }}>
          <div className="row-between" style={{ marginBlockEnd: 4 }}>
            <span className="eyebrow">{t('mentor.bond')}</span>
            <span className="num" style={{ fontSize: 12 }}>{Math.round(held?.bond ?? 0)}</span>
          </div>
          <Meter value={held?.bond ?? 0} tone="amber" />
          {/* A bar with a number on it and no explanation is a bar nobody trusts. */}
          <p className="faint" style={{ fontSize: 11.5, marginBlockStart: 6, lineHeight: 1.6 }}>
            {t('mentor.bondHint')}
          </p>
        </div>
      </Card>

      {reply ? (
        <Card>
          <p style={{ fontSize: 14.5, lineHeight: 1.7 }}>{t(reply.lineKey)}</p>

          {reply.brief && !taken && (
            <>
              <p className="choice-impact choice-impact-neutral" style={{ marginBlockStart: 12 }}>
                {t(`mentor.brief.${reply.brief}`)}
              </p>
              <div className="row" style={{ gap: 8, marginBlockStart: 14 }}>
                <button
                  className="btn btn-primary grow"
                  onClick={() => {
                    takeAdvice(reply);
                    setTaken(true);
                  }}
                >
                  {t('mentor.take')}
                </button>
                <button className="btn grow" onClick={() => setReply(null)}>{t('mentor.ignore')}</button>
              </div>
            </>
          )}
          {taken && <p style={{ fontSize: 13, marginBlockStart: 12, color: 'var(--amber)' }}>{t('mentor.taken')}</p>}
          {!reply.brief && (
            <button className="btn btn-block" style={{ marginBlockStart: 14 }} onClick={() => setReply(null)}>
              {t('action.close')}
            </button>
          )}
        </Card>
      ) : ready ? (
        <div className="stack" style={{ gap: 8 }}>
          {topics.map((topic) => (
            <button key={topic} className="option" onClick={() => ask(topic)}>
              <span style={{ display: 'block', fontWeight: 600 }}>{t(questionKey(topic))}</span>
              <span className="faint" style={{ display: 'block', fontSize: 11.5, marginBlockStart: 4 }}>
                {t(`mentor.ask.${topic}.hint`)}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <Empty>{t('mentor.tooSoon')}</Empty>
      )}

      <p className="faint center" style={{ fontSize: 11.5 }}>
        {t('mentor.cooldown', { weeks: MENTOR_COOLDOWN_WEEKS })}
      </p>

      <button className="btn btn-block" onClick={() => setPicking(true)}>{t('mentor.change')}</button>
    </div>
  );
}
