// Full-platform live page: big two-column layout + floating glance window.
import { useState } from 'react';
import { getCallAudio, getMic } from '../lib/audio';
import { fmtTime, MEETING_TYPES } from '../lib/prompts';
import { navigate, useStore } from '../lib/store';
import { useLiveEngine, type CallCapture, type LiveSetup } from '../lib/useLiveEngine';
import { GlancePortal, openGlanceWindow } from './Glance';
import { ActionBar, AskBox, Feed, GlanceCard, Meter, Transcript, useLiveShortcuts } from './LiveParts';
import { SetupFields, useSetupDraft } from './SetupFields';

interface Session {
  setup: LiveSetup;
  mic: MediaStream;
  call?: CallCapture;
}

export function Live() {
  const [session, setSession] = useState<Session | null>(null);
  return session ? <LiveSession {...session} /> : <LiveSetupPage onStart={setSession} />;
}

async function displayCapture(): Promise<CallCapture> {
  const c = await getCallAudio();
  return { stream: c.stream, stop: () => c.display.getTracks().forEach((t) => t.stop()) };
}

function LiveSetupPage({ onStart }: { onStart: (s: Session) => void }) {
  const { toast } = useStore();
  const [f, set] = useSetupDraft();
  const [starting, setStarting] = useState(false);

  async function start() {
    setStarting(true);
    try {
      const mic = await getMic();
      let call: CallCapture | undefined;
      if (f.mode === 'online') {
        try {
          call = await displayCapture();
        } catch (e) {
          toast(`${(e as Error).message} Continuing with mic only; you can add call audio later.`, 'error');
        }
      }
      onStart({ setup: f, mic, call });
    } catch (e) {
      toast(`Microphone access failed: ${(e as Error).message}`, 'error');
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="page narrow">
      <h1>Start a live meeting</h1>
      <p className="muted">
        Tip: the quickest way is the <b>Meeter side panel</b>. Click the toolbar icon while you're on your meeting tab. This
        page is the full-screen version. Let everyone know you're using an AI notetaker; many places legally require consent.
      </p>
      <div className="card">
        <SetupFields
          f={f}
          set={set}
          onlineHint={
            <>
              Chrome will ask what to share. Pick the <b>meeting tab</b> and turn on <b>"Share tab audio"</b>. Use headphones so
              your voice isn't picked up twice.
            </>
          }
        />
        <button className="btn primary big" onClick={start} disabled={starting}>
          {starting ? 'Requesting access…' : '● Start listening'}
        </button>
      </div>
    </div>
  );
}

function LiveSession({ setup, mic, call }: Session) {
  const { settings, toast } = useStore();
  const e = useLiveEngine(setup, mic, call);
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

  async function stop() {
    const m = await e.stop();
    glance?.close();
    navigate(`/m/${m.id}/new`);
  }

  async function addCall() {
    try {
      await e.attachCall(await displayCapture());
      toast('Call audio connected');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  return (
    <div className="live">
      <header className="live-bar">
        <div className="live-title">
          <span className={`rec ${e.paused ? 'paused' : ''}`} />
          <b>{setup.title || MEETING_TYPES[setup.type].label}</b>
          <span className="mono">{fmtTime(e.elapsed)}</span>
        </div>
        <div className="live-status">
          <Meter level={e.levels.mic} label={e.isInPerson ? 'Room mic' : 'Your mic'} on={!e.paused} />
          {!e.isInPerson &&
            (e.callOn ? (
              <Meter level={e.levels.call} label="Call audio" on={!e.paused} />
            ) : (
              <button className="btn small" onClick={addCall}>
                + Add call audio
              </button>
            ))}
          {e.pending > 0 && <span className="pill">transcribing {e.pending}…</span>}
        </div>
        <div className="live-actions">
          <button className="btn" onClick={toggleGlance} title="Alt+G">
            {glance ? '✕ Close glance' : '🪟 Glance window'}
          </button>
          <button className="btn" onClick={e.bookmark} title="Alt+B">
            🔖
          </button>
          <button className="btn" onClick={e.togglePause}>
            {e.paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button className="btn danger" onClick={stop} disabled={e.stopping}>
            {e.stopping ? 'Saving…' : '■ Stop & get notes'}
          </button>
        </div>
      </header>
      {e.callNote && <div className="note-bar">{e.callNote}</div>}

      <div className="live-grid">
        <section className="panel transcript">
          <h3>Live transcript</h3>
          <Transcript e={e} />
        </section>
        <section className="panel copilot">
          <h3>
            Copilot <span className="muted small">{settings.autoSuggest ? '⚡ auto-suggest on' : 'auto-suggest off'} · Alt+1–7</span>
          </h3>
          <ActionBar e={e} />
          <AskBox e={e} />
          <Feed e={e} />
        </section>
      </div>

      {glance && (
        <GlancePortal win={glance} onClose={() => setGlance(null)}>
          <GlanceCard e={e} fontPx={settings.glanceFontPx} />
        </GlancePortal>
      )}
    </div>
  );
}
