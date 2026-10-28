import { useEffect, useMemo, useRef, useState } from 'react';
import { chat } from '../lib/ai';
import { chatSystem, fmtTime, MEETING_TYPES, meetingToMarkdown, notesSystem, splitTitle, transcriptText } from '../lib/prompts';
import { meetingsDb } from '../lib/storage';
import { navigate, useStore } from '../lib/store';
import type { Meeting } from '../lib/types';
import { BUILTIN_CHAR_BUDGET } from '../lib/builtin';
import { ChatBox } from './ChatBox';
import { HandoffButtons } from './Handoff';
import { Markdown } from './Markdown';

type Tab = 'notes' | 'transcript' | 'copilot' | 'chat';

export function MeetingView({ id, autoNotes }: { id: string; autoNotes: boolean }) {
  const { settings, toast } = useStore();
  const [m, setM] = useState<Meeting | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('notes');
  const [gen, setGen] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const started = useRef(false);

  useEffect(() => {
    meetingsDb.get(id).then((x) => setM(x ?? null));
  }, [id]);

  const save = (next: Meeting) => {
    setM(next);
    meetingsDb.put(next).catch((e) => toast(String(e), 'error'));
  };

  async function generate(meeting: Meeting) {
    if (!meeting.segments.length) {
      toast('Nothing was transcribed, so there are no notes to generate.', 'error');
      return;
    }
    setGen('');
    setTab('notes');
    try {
      let source = `Transcript:\n${transcriptText(meeting.segments, 300000)}`;
      // On-device AI can't read a long meeting at once: condense it in parts first (map-reduce).
      if (settings.provider === 'builtin' && source.length > BUILTIN_CHAR_BUDGET * 0.6) {
        const lines = transcriptText(meeting.segments).split('\n');
        const parts: string[] = [];
        let cur = '';
        for (const l of lines) {
          if (cur.length + l.length > BUILTIN_CHAR_BUDGET * 0.6) {
            parts.push(cur);
            cur = '';
          }
          cur += l + '\n';
        }
        if (cur) parts.push(cur);
        const digests: string[] = [];
        for (let k = 0; k < parts.length; k++) {
          setGen(`_Reading part ${k + 1} of ${parts.length}…_`);
          digests.push(
            await chat(settings, {
              system: 'You condense meeting transcript excerpts. Keep every fact, number, name, decision, commitment and question, with [mm:ss] timestamps. Bullets only.',
              messages: [{ role: 'user', content: parts[k] }],
              maxTokens: 600,
            }),
          );
        }
        source = `Condensed transcript (in order):\n${digests.join('\n')}`;
      }
      const out = await chat(settings, {
        system: notesSystem(meeting, settings.userName),
        messages: [{ role: 'user', content: source }],
        maxTokens: 4096,
        onToken: (t) => setGen(splitTitle(t).body),
      });
      const { title, body } = splitTitle(out);
      const keepTitle = meeting.title && !/· \d/.test(meeting.title) && meeting.source === 'live';
      save({ ...meeting, notes: body, title: keepTitle || !title ? meeting.title : title });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setGen(null);
    }
  }

  useEffect(() => {
    if (m && autoNotes && !m.notes && !started.current) {
      started.current = true;
      navigate(`/m/${m.id}`);
      generate(m);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, autoNotes]);

  const filtered = useMemo(() => {
    if (!m) return [];
    const needle = q.trim().toLowerCase();
    return needle ? m.segments.filter((s) => s.text.toLowerCase().includes(needle)) : m.segments;
  }, [m, q]);

  if (m === undefined) return <div className="page">Loading…</div>;
  if (m === null)
    return (
      <div className="page">
        <p>Meeting not found.</p>
        <a href="#/">← Back</a>
      </div>
    );

  const download = () => {
    const blob = new Blob([meetingToMarkdown(m)], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${m.title.replace(/[^\w\- ]+/g, '').slice(0, 60) || 'meeting'}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast('Copied');
  };

  const remove = async () => {
    if (!confirm(`Delete "${m.title}" permanently?`)) return;
    await meetingsDb.remove(m.id);
    navigate('/');
  };

  const speakers = [...new Set(m.segments.map((s) => s.speaker))];
  const talk = speakers.map((sp) => ({
    sp,
    words: m.segments.filter((s) => s.speaker === sp).reduce((n, s) => n + s.text.split(/\s+/).length, 0),
  }));
  const totalWords = talk.reduce((n, x) => n + x.words, 0) || 1;

  return (
    <div className="page">
      <a href="#/" className="back">
        ← All meetings
      </a>
      <div className="meeting-head">
        <div>
          <input
            className="title-input"
            value={m.title}
            onChange={(e) => setM({ ...m, title: e.target.value })}
            onBlur={() => save(m)}
            aria-label="Meeting title"
          />
          <p className="muted">
            {MEETING_TYPES[m.type].emoji} {MEETING_TYPES[m.type].label} · {new Date(m.createdAt).toLocaleString()} ·{' '}
            {fmtTime(m.durationMs)} · {m.segments.length} segments
          </p>
          {talk.length > 1 && (
            <div className="talk">
              {talk.map((x) => (
                <span key={x.sp} style={{ flex: x.words }} title={`${x.sp}: ${Math.round((x.words / totalWords) * 100)}%`}>
                  {x.sp} {Math.round((x.words / totalWords) * 100)}%
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="row wrap">
          <button className="btn" onClick={download}>
            ⬇ Export .md
          </button>
          <button className="btn" onClick={() => copy(meetingToMarkdown(m))}>
            Copy all
          </button>
          <button className="btn danger ghost" onClick={remove}>
            Delete
          </button>
        </div>
      </div>

      <nav className="tabs">
        {(['notes', 'transcript', 'copilot', 'chat'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {{ notes: '📝 AI notes', transcript: '🗒 Transcript', copilot: '⚡ Copilot log', chat: '💬 Ask this meeting' }[t]}
          </button>
        ))}
      </nav>

      {m.segments.length > 0 && (
        <div className="card tight">
          <HandoffButtons m={m} />
        </div>
      )}

      {tab === 'notes' && (
        <div className="card">
          <div className="row between">
            <h3>AI notes</h3>
            <div className="row">
              {m.notes && gen === null && (
                <button className="btn" onClick={() => copy(m.notes!)}>
                  Copy
                </button>
              )}
              <button className="btn primary" onClick={() => generate(m)} disabled={gen !== null}>
                {gen !== null ? 'Writing…' : m.notes ? '↻ Regenerate' : '✨ Generate notes'}
              </button>
            </div>
          </div>
          {gen !== null ? (
            gen ? <Markdown text={gen} /> : <p className="dots">Reading the whole meeting</p>
          ) : m.notes ? (
            <Markdown text={m.notes} />
          ) : (
            <p className="muted">No notes yet. Generate a summary, decisions, action items and a follow-up email.</p>
          )}
        </div>
      )}

      {tab === 'transcript' && (
        <div className="card">
          <input className="search" placeholder="Search transcript…" value={q} onChange={(e) => setQ(e.target.value)} />
          {m.bookmarks.length > 0 && (
            <p className="small">
              🔖 Bookmarks: {m.bookmarks.map((b) => fmtTime(b)).join(' · ')}
            </p>
          )}
          <div className="transcript-full">
            {filtered.map((s) => (
              <div key={s.id} className={`line ${s.speaker === 'You' ? 'me' : 'them'}`}>
                <span className="who">
                  {s.speaker} <em>{fmtTime(s.t)}</em>
                </span>
                <p>{s.text}</p>
              </div>
            ))}
            {!filtered.length && <p className="muted">No matches.</p>}
          </div>
        </div>
      )}

      {tab === 'copilot' && (
        <div className="card">
          {m.suggestions.length === 0 && <p className="muted">No copilot suggestions were used in this meeting.</p>}
          {m.suggestions.map((s) => (
            <article key={s.id} className={`sug ${s.error ? 'error' : ''}`}>
              <header>
                <b>{s.label}</b> <em>{fmtTime(s.t)}</em>
              </header>
              <Markdown text={s.text} />
            </article>
          ))}
        </div>
      )}

      {tab === 'chat' && (
        <div className="card">
          <ChatBox
            system={() => chatSystem(m, settings.userName)}
            messages={m.chat}
            onChange={(chatMsgs) => save({ ...m, chat: chatMsgs })}
            starters={[
              'What were the key decisions?',
              'What did they object to and how should I handle it next time?',
              'Draft a LinkedIn message to follow up',
              'What should I prepare for the next meeting?',
            ]}
          />
        </div>
      )}
    </div>
  );
}
