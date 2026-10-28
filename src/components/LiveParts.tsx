import { useEffect, useRef, useState } from 'react';
import { ACTIONS, fmtTime } from '../lib/prompts';
import type { LiveEngine } from '../lib/useLiveEngine';
import { Markdown } from './Markdown';

export function Meter({ level, label, on }: { level: number; label: string; on: boolean }) {
  return (
    <span className={`meter ${on ? '' : 'off'}`} title={label}>
      <i style={{ transform: `scaleX(${on ? Math.max(0.04, level) : 0})` }} />
      {label}
    </span>
  );
}

export function Transcript({ e, compact = false }: { e: LiveEngine; compact?: boolean }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [e.segments.length, e.interim]);
  const segs = compact ? e.segments.slice(-30) : e.segments;
  return (
    <div className="scroll">
      {segs.length === 0 && !e.interim && (
        <p className="muted empty">Listening… {e.callOn ? 'The other side appears as "Them".' : 'Start talking.'}</p>
      )}
      {segs.map((s) => (
        <div key={s.id} className={`line ${s.speaker === 'You' ? 'me' : 'them'}`}>
          <span className="who">
            {s.speaker} <em>{fmtTime(s.t)}</em>
          </span>
          <p>{s.text}</p>
        </div>
      ))}
      {e.interim && (
        <div className="line me interim">
          <span className="who">{e.youLabel}</span>
          <p>{e.interim}</p>
        </div>
      )}
      <div ref={end} />
    </div>
  );
}

export function ActionBar({ e, count = ACTIONS.length }: { e: LiveEngine; count?: number }) {
  return (
    <div className="actions">
      {ACTIONS.slice(0, count).map((a) => (
        <button
          key={a.id}
          className={`action ${e.running === a.id ? 'busy' : ''}`}
          onClick={() => e.runPreset(a.id)}
          title={`${a.hint} (Alt+${a.key})`}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

export function AskBox({ e }: { e: LiveEngine }) {
  const [ask, setAsk] = useState('');
  return (
    <form
      className="ask"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!ask.trim()) return;
        e.runAction('custom', ask.trim().slice(0, 40), ask.trim());
        setAsk('');
      }}
    >
      <input value={ask} onChange={(ev) => setAsk(ev.target.value)} placeholder="Ask anything… e.g. what's their real objection?" />
      <button className="btn primary">Ask</button>
    </form>
  );
}

export function Feed({ e, limit }: { e: LiveEngine; limit?: number }) {
  const list = limit ? e.suggestions.slice(0, limit) : e.suggestions;
  return (
    <div className="scroll feed">
      {list.length === 0 && (
        <p className="muted empty">
          Suggestions appear here. Tap an action, or let auto-suggest prepare a reply whenever the other side finishes
          speaking.
        </p>
      )}
      {list.map((s, i) => (
        <article key={s.id} className={`sug ${i === 0 ? 'latest' : ''} ${s.error ? 'error' : ''}`}>
          <header>
            <b>{s.label}</b> <em>{fmtTime(s.t)}</em>
          </header>
          {s.text ? <Markdown text={s.text} /> : <span className="dots">Thinking</span>}
        </article>
      ))}
    </div>
  );
}

/** Alt+1..7 actions, Alt+B bookmark, Alt+G glance (optional). */
export function useLiveShortcuts(e: LiveEngine, extra?: { onGlance?: () => void; win?: Window | null }) {
  useEffect(() => {
    const on = (ev: KeyboardEvent) => {
      if (!ev.altKey) return;
      const a = ACTIONS.find((x) => ev.code === `Digit${x.key}`);
      if (a) {
        ev.preventDefault();
        e.runPreset(a.id);
      } else if (ev.code === 'KeyB') {
        ev.preventDefault();
        e.bookmark();
      } else if (ev.code === 'KeyG' && extra?.onGlance) {
        ev.preventDefault();
        extra.onGlance();
      }
    };
    window.addEventListener('keydown', on);
    extra?.win?.addEventListener('keydown', on);
    return () => {
      window.removeEventListener('keydown', on);
      extra?.win?.removeEventListener('keydown', on);
    };
  });
}

export function GlanceCard({ e, fontPx }: { e: LiveEngine; fontPx: number }) {
  const latest = e.suggestions[0];
  const lastThem = [...e.segments].reverse().find((s) => s.speaker !== 'You');
  return (
    <div className="glance" style={{ fontSize: fontPx }}>
      <div className="glance-top">
        <span className={`rec ${e.paused ? 'paused' : ''}`} /> {fmtTime(e.elapsed)}
        {e.running && <span className="dots small">thinking</span>}
      </div>
      <div className="glance-main">
        {latest ? (
          latest.text ? (
            <Markdown text={latest.text} />
          ) : (
            <span className="dots">Thinking</span>
          )
        ) : (
          <span className="muted">Suggestions will appear here.</span>
        )}
      </div>
      {lastThem && <div className="glance-heard">“{lastThem.text.slice(-140)}”</div>}
      <div className="glance-btns">
        {ACTIONS.slice(0, 5).map((a) => (
          <button key={a.id} onClick={() => e.runPreset(a.id)} className={e.running === a.id ? 'busy' : ''}>
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
