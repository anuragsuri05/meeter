import { useEffect, useState } from 'react';
import { MEETING_TYPES } from '../lib/prompts';
import type { MeetingType } from '../lib/types';
import type { LiveSetup } from '../lib/useLiveEngine';

const DRAFT_KEY = 'meeter.liveSetup';

/** Setup form state, remembered between meetings (except the title). */
export function useSetupDraft() {
  const [f, setF] = useState<LiveSetup>(() => {
    const base: LiveSetup = { title: '', type: 'general', mode: 'online', goal: '', context: '' };
    try {
      return { ...base, ...JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}'), title: '' };
    } catch {
      return base;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...f, title: '' }));
    } catch {
      /* ignore */
    }
  }, [f]);
  return [f, (p: Partial<LiveSetup>) => setF((x) => ({ ...x, ...p }))] as const;
}

export function SetupFields({
  f,
  set,
  compact = false,
  onlineHint,
}: {
  f: LiveSetup;
  set: (p: Partial<LiveSetup>) => void;
  compact?: boolean;
  onlineHint?: React.ReactNode;
}) {
  async function loadFile(file: File) {
    const text = await file.text();
    set({ context: (f.context ? f.context + '\n\n' : '') + `--- ${file.name} ---\n` + text });
  }

  return (
    <>
      <label className="field">
        Meeting title
        <input value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Acme discovery call" />
      </label>

      <div className="field">
        Meeting type
        {compact ? (
          <select value={f.type} onChange={(e) => set({ type: e.target.value as MeetingType })}>
            {(Object.keys(MEETING_TYPES) as MeetingType[]).map((t) => (
              <option key={t} value={t}>
                {MEETING_TYPES[t].emoji} {MEETING_TYPES[t].label}
              </option>
            ))}
          </select>
        ) : (
          <div className="type-grid">
            {(Object.keys(MEETING_TYPES) as MeetingType[]).map((t) => (
              <button key={t} className={`type ${f.type === t ? 'on' : ''}`} onClick={() => set({ type: t })}>
                <span>{MEETING_TYPES[t].emoji}</span>
                {MEETING_TYPES[t].label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="field">
        How should Meeter listen?
        <div className="seg">
          <button className={f.mode === 'online' ? 'on' : ''} onClick={() => set({ mode: 'online' })}>
            🎧 Online call: my mic + the call's audio
          </button>
          <button className={f.mode === 'inperson' ? 'on' : ''} onClick={() => set({ mode: 'inperson' })}>
            🔊 In person / speaker mode: the mic hears everyone
          </button>
        </div>
        {f.mode === 'online' && onlineHint && <span className="muted small">{onlineHint}</span>}
        {f.mode === 'inperson' && (
          <span className="muted small">
            Works everywhere for free. For calls, play the audio on your speakers (no headphones) so the mic hears both sides.
          </span>
        )}
      </div>

      <label className="field">
        Your goal <span className="muted small">(the copilot steers toward this)</span>
        <input
          value={f.goal}
          onChange={(e) => set({ goal: e.target.value })}
          placeholder="e.g. Close a pilot at ₹4L, book a follow-up with their CTO"
        />
      </label>

      <label className="field">
        Background the AI can use <span className="muted small">(resume, product, pricing, agenda; it's kept for next time)</span>
        <textarea
          rows={compact ? 3 : 6}
          value={f.context}
          onChange={(e) => set({ context: e.target.value })}
          placeholder="Paste anything the copilot should know so its suggestions are accurate and about YOU."
        />
        <input type="file" accept=".txt,.md,.csv,.json,.html" onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
      </label>
    </>
  );
}
