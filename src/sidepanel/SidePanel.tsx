// Extension side panel: the everyday surface. Start on the current tab, get live suggestions,
// and jump to the full platform for anything deep.
import { useEffect, useState } from 'react';
import { getMic, getTabAudio } from '../lib/audio';
import { fmtTime, MEETING_TYPES } from '../lib/prompts';
import { meetingsDb } from '../lib/storage';
import { useStore } from '../lib/store';
import { openOnboarding, openPlatform } from '../lib/handoff';
import { useLiveEngine, type CallCapture, type LiveSetup } from '../lib/useLiveEngine';
import type { Meeting } from '../lib/types';
import { GlancePortal, openGlanceWindow } from '../components/Glance';
import { HandoffButtons, useAiStatus } from '../components/Handoff';
import { ActionBar, AskBox, Feed, GlanceCard, Meter, Transcript, useLiveShortcuts } from '../components/LiveParts';
import { SetupFields, useSetupDraft } from '../components/SetupFields';

type View = { kind: 'idle' } | { kind: 'live'; setup: LiveSetup; mic: MediaStream; call?: CallCapture } | { kind: 'done'; meeting: Meeting };

export function SidePanel() {
  const [view, setView] = useState<View>({ kind: 'idle' });
  return (
    <div className="sp">
      {view.kind === 'idle' && <Idle onStart={(setup, mic, call) => setView({ kind: 'live', setup, mic, call })} />}
      {view.kind === 'live' && (
        <LivePanel setup={view.setup} mic={view.mic} call={view.call} onDone={(meeting) => setView({ kind: 'done', meeting })} />
      )}
      {view.kind === 'done' && <Done m={view.meeting} onAgain={() => setView({ kind: 'idle' })} />}
    </div>
  );
}

function Header({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sp-head">
      <b className="brand">
        <span className="logo">◉</span> Meeter
      </b>
      <div className="row">
        {children}
        <button className="btn small" onClick={() => openPlatform('/')} title="Open the full platform">
          Platform ↗
        </button>
      </div>
    </header>
  );
}

async function micPermission(): Promise<PermissionState> {
  try {
    return (await navigator.permissions.query({ name: 'microphone' as PermissionName })).state;
  } catch {
    return 'prompt';
  }
}

function Idle({ onStart }: { onStart: (s: LiveSetup, mic: MediaStream, call?: CallCapture) => void }) {
  const { settings, toast } = useStore();
  const ai = useAiStatus();
  const [f, set] = useSetupDraft();
  const [more, setMore] = useState(false);
  const [recent, setRecent] = useState<Meeting[]>([]);
  const [mic, setMic] = useState<PermissionState>('prompt');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    meetingsDb.all().then((l) => setRecent(l.slice(0, 5)));
    micPermission().then(setMic);
  }, []);

  async function start() {
    if ((await micPermission()) !== 'granted') {
      // Side panels can't show the permission prompt; onboarding (a normal tab) can.
      openOnboarding('mic');
      return;
    }
    setStarting(true);
    try {
      const stream = await getMic();
      let call: CallCapture | undefined;
      let setup = f;
      if (f.mode === 'online') {
        try {
          const t = await getTabAudio();
          call = { stream: t.stream, stop: t.stop };
          if (!f.title && t.title) setup = { ...f, title: t.title.replace(/\s*[-|–].*$/, '').slice(0, 60) };
        } catch (e) {
          toast(`${(e as Error).message} Starting with your mic only.`, 'error');
        }
      }
      onStart(setup, stream, call);
    } catch (e) {
      toast(`Microphone: ${(e as Error).message}`, 'error');
    } finally {
      setStarting(false);
    }
  }

  return (
    <>
      <Header />
      <div className="sp-body">
        {!settings.onboarded && (
          <div className="setup-banner">
            Finish the 1-minute setup to get started.
            <button className="btn primary small" onClick={() => openOnboarding()}>
              Start onboarding
            </button>
          </div>
        )}
        <div className={`ai-status ${ai.ready ? 'ok' : 'bad'}`}>
          <span>●</span> {ai.label}
          {!ai.ready && (
            <button className="btn small" onClick={() => openOnboarding('ai')}>
              Fix
            </button>
          )}
        </div>
        {mic !== 'granted' && (
          <div className="ai-status bad">
            <span>●</span> Microphone not allowed yet
            <button className="btn small" onClick={() => openOnboarding('mic')}>
              Allow
            </button>
          </div>
        )}

        <div className="card tight">
          <h3>Start on this tab</h3>
          <p className="muted small">
            Open your Meet, Zoom or Teams tab, then press Start. Meeter hears you and the call.
          </p>
          <label className="field">
            Meeting type
            <select value={f.type} onChange={(e) => set({ type: e.target.value as LiveSetup['type'] })}>
              {(Object.keys(MEETING_TYPES) as LiveSetup['type'][]).map((t) => (
                <option key={t} value={t}>
                  {MEETING_TYPES[t].emoji} {MEETING_TYPES[t].label}
                </option>
              ))}
            </select>
          </label>
          {more ? (
            <SetupFields f={f} set={set} compact />
          ) : (
            <>
              <label className="field">
                Your goal
                <input value={f.goal} onChange={(e) => set({ goal: e.target.value })} placeholder="What do you want out of this meeting?" />
              </label>
              <button className="linkish small" onClick={() => setMore(true)}>
                + Title, listening mode, background (resume, pricing…){f.context ? ' · background saved ✓' : ''}
              </button>
            </>
          )}
          <button className="btn primary big full" onClick={start} disabled={starting}>
            {starting ? 'Starting…' : '● Start listening'}
          </button>
        </div>

        <div className="sp-links">
          <button className="btn" onClick={() => openPlatform('/upload')}>
            ⬆ Upload recording
          </button>
          <button className="btn" onClick={() => openPlatform('/ask')}>
            💬 Ask my meetings
          </button>
          <button className="btn" onClick={() => openPlatform('/settings')}>
            ⚙ Settings
          </button>
        </div>

        {recent.length > 0 && (
          <>
            <h3 className="sp-h">Recent</h3>
            {recent.map((m) => (
              <button key={m.id} className="sp-recent" onClick={() => openPlatform(`/m/${m.id}`)}>
                <b>{m.title}</b>
                <span className="muted small">
                  {new Date(m.createdAt).toLocaleDateString()} · {fmtTime(m.durationMs)}
                </span>
              </button>
            ))}
          </>
        )}
      </div>
    </>
  );
}

function LivePanel({ setup, mic, call, onDone }: { setup: LiveSetup; mic: MediaStream; call?: CallCapture; onDone: (m: Meeting) => void }) {
  const { settings, toast } = useStore();
  const e = useLiveEngine(setup, mic, call);
  const [tab, setTab] = useState<'suggest' | 'transcript'>('suggest');
  const [glance, setGlance] = useState<Window | null>(null);

  async function toggleGlance() {
    if (glance) {
      glance.close();
      setGlance(null);
      return;
    }
    try {
      setGlance(await openGlanceWindow());
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }
  useLiveShortcuts(e, { onGlance: toggleGlance, win: glance });

  async function addCall() {
    try {
      const t = await getTabAudio();
      await e.attachCall({ stream: t.stream, stop: t.stop });
      toast('Call audio connected');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  async function stop() {
    glance?.close();
    onDone(await e.stop());
  }

  return (
    <>
      <header className="sp-head live">
        <div className="row">
          <span className={`rec ${e.paused ? 'paused' : ''}`} />
          <span className="mono">{fmtTime(e.elapsed)}</span>
          <Meter level={e.levels.mic} label={e.isInPerson ? 'Room' : 'You'} on={!e.paused} />
          {!e.isInPerson &&
            (e.callOn ? (
              <Meter level={e.levels.call} label="Call" on={!e.paused} />
            ) : (
              <button className="btn small" onClick={addCall}>
                + Call audio
              </button>
            ))}
        </div>
        <div className="row">
          <button className="btn small" onClick={e.togglePause} title="Pause">
            {e.paused ? '▶' : '⏸'}
          </button>
          <button className="btn small" onClick={e.bookmark} title="Bookmark (Alt+B)">
            🔖
          </button>
          <button className="btn small danger" onClick={stop} disabled={e.stopping}>
            {e.stopping ? 'Saving…' : '■ Stop'}
          </button>
        </div>
      </header>
      {e.callNote && <div className="note-bar">{e.callNote}</div>}
      <div className="sp-live">
        <ActionBar e={e} />
        <AskBox e={e} />
        <nav className="tabs mini">
          <button className={tab === 'suggest' ? 'on' : ''} onClick={() => setTab('suggest')}>
            ⚡ Suggestions
          </button>
          <button className={tab === 'transcript' ? 'on' : ''} onClick={() => setTab('transcript')}>
            🗒 Transcript {e.pending > 0 ? `(${e.pending}…)` : ''}
          </button>
          {'documentPictureInPicture' in window && (
            <button onClick={toggleGlance} title="Floating window (Alt+G)">
              🪟 {glance ? 'Close' : 'Float'}
            </button>
          )}
        </nav>
        {tab === 'suggest' ? <Feed e={e} limit={15} /> : <Transcript e={e} compact />}
      </div>
      {glance && (
        <GlancePortal win={glance} onClose={() => setGlance(null)}>
          <GlanceCard e={e} fontPx={settings.glanceFontPx} />
        </GlancePortal>
      )}
    </>
  );
}

function Done({ m, onAgain }: { m: Meeting; onAgain: () => void }) {
  return (
    <>
      <Header />
      <div className="sp-body">
        <div className="card tight">
          <h3>✅ Meeting saved</h3>
          <p className="muted small">
            {m.title} · {fmtTime(m.durationMs)} · {m.segments.length} transcript segments
          </p>
          <button className="btn primary big full" onClick={() => openPlatform(`/m/${m.id}/new`)}>
            📝 Open AI notes in the platform
          </button>
        </div>
        <div className="card tight">
          <HandoffButtons m={m} compact />
        </div>
        <button className="btn full" onClick={onAgain}>
          Start another meeting
        </button>
      </div>
    </>
  );
}
