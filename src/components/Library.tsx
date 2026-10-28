import { useEffect, useMemo, useState } from 'react';
import { hasKey, PROVIDERS } from '../lib/ai';
import { fmtTime, MEETING_TYPES } from '../lib/prompts';
import { meetingsDb } from '../lib/storage';
import { useStore } from '../lib/store';
import type { Meeting } from '../lib/types';

export function Library() {
  const { settings } = useStore();
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    meetingsDb.all().then(setMeetings);
  }, []);

  const list = useMemo(() => {
    if (!meetings) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return meetings;
    return meetings.filter((m) =>
      (m.title + ' ' + (m.notes ?? '') + ' ' + m.segments.map((s) => s.text).join(' ')).toLowerCase().includes(needle),
    );
  }, [meetings, q]);

  const ready = hasKey(settings);

  return (
    <div className="page">
      <section className="hero">
        <h1>
          Walk into any meeting <span className="grad">fully prepared</span>.
        </h1>
        <p>
          Live transcription, an AI copilot that tells you what to say as the conversation happens, and Otter-grade notes
          afterwards. It's free and private, and there's nothing to install.
        </p>
        {!ready && (
          <div className="setup-banner">
            <b>Step 1:</b> connect a free AI key. It takes about a minute with Google Gemini.{' '}
            <a className="btn primary" href="#/settings">
              Connect AI →
            </a>
          </div>
        )}
        <div className="hero-actions">
          <a className="btn primary big" href="#/live">
            ● Start live meeting
          </a>
          <a className="btn big" href="#/upload">
            ⬆ Upload a recording
          </a>
          <a className="btn big" href="#/ask">
            💬 Ask across meetings
          </a>
        </div>
        {ready && <p className="muted small">Using {PROVIDERS[settings.provider].name}{settings.provider !== 'builtin' ? ` · ${settings.chatModel[settings.provider]}` : ''}</p>}
      </section>

      <section className="features">
        {[
          ['⚡', 'Real-time copilot', 'What to say, answers to questions, objection handling, fact-checks and smart questions, while you talk.'],
          ['🪟', 'Glance window', 'An always-on-top floating card. Park it under your webcam to read without looking away.'],
          ['🎧', 'Hears both sides', 'Your mic plus the call audio from Meet, Zoom or Teams, labelled You and Them. In-person mode too.'],
          ['📝', 'AI notes', 'Summary, decisions, action items, a follow-up email, plus deal, interview or study insights.'],
          ['🧠', 'Meeting memory', 'Search and chat across every meeting you have ever recorded.'],
          ['🔒', 'Private & free', 'No server and no account. Everything stays in your browser, with your own free AI key.'],
        ].map(([i, t, d]) => (
          <div key={t} className="feature">
            <span>{i}</span>
            <b>{t}</b>
            <p>{d}</p>
          </div>
        ))}
      </section>

      <section>
        <div className="row between">
          <h2>Your meetings</h2>
          <input className="search" placeholder="Search all meetings…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {meetings === null ? (
          <p className="muted">Loading…</p>
        ) : list.length === 0 ? (
          <p className="muted">{q ? 'No matches.' : 'No meetings yet. Start one above.'}</p>
        ) : (
          <div className="cards">
            {list.map((m) => (
              <a key={m.id} href={`#/m/${m.id}`} className="mcard">
                <b>{m.title}</b>
                <span className="muted small">
                  {MEETING_TYPES[m.type].emoji} {new Date(m.createdAt).toLocaleString()} · {fmtTime(m.durationMs)}
                </span>
                <p>
                  {(m.notes?.split('\n').find((l) => l.trim() && !l.startsWith('#')) ??
                    m.segments.slice(0, 3).map((s) => s.text).join(' ')).slice(0, 160) || 'Empty meeting'}
                </p>
                {!m.notes && m.segments.length > 0 && <em className="pill">notes not generated</em>}
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
