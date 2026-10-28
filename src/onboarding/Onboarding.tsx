// First-run onboarding (opens in a tab on install). Tabs can show permission prompts and
// start the on-device model download, which the side panel can't.
import { useEffect, useState } from 'react';
import { PROVIDERS } from '../lib/ai';
import { builtinStatus, prepareBuiltin } from '../lib/builtin';
import { ASSISTANTS, isExtension, openPlatform } from '../lib/handoff';
import { MEETING_TYPES } from '../lib/prompts';
import { useStore } from '../lib/store';
import type { AssistantId, KeyedProvider, MeetingType } from '../lib/types';

const STEPS = ['welcome', 'you', 'mic', 'ai', 'account', 'use', 'done'] as const;
type Step = (typeof STEPS)[number];

export function Onboarding() {
  const fromHash = () => {
    const h = window.location.hash.slice(1) as Step;
    return STEPS.includes(h) ? h : 'welcome';
  };
  const [step, setStep] = useState<Step>(fromHash);
  const i = STEPS.indexOf(step);
  const go = (s: Step) => {
    setStep(s);
    history.replaceState(null, '', `#${s}`);
  };
  const next = () => go(STEPS[Math.min(STEPS.length - 1, i + 1)]);
  const back = () => go(STEPS[Math.max(0, i - 1)]);

  return (
    <div className="ob">
      <div className="ob-card">
        <div className="ob-progress">
          {STEPS.map((s, k) => (
            <i key={s} className={k <= i ? 'on' : ''} />
          ))}
        </div>
        {step === 'welcome' && <Welcome next={next} />}
        {step === 'you' && <You next={next} />}
        {step === 'mic' && <Mic next={next} />}
        {step === 'ai' && <Ai next={next} />}
        {step === 'account' && <Account next={next} />}
        {step === 'use' && <Use next={next} />}
        {step === 'done' && <Done />}
        {i > 0 && step !== 'done' && (
          <button className="linkish small ob-back" onClick={back}>
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}

function Welcome({ next }: { next: () => void }) {
  return (
    <>
      <div className="ob-logo">◉</div>
      <h1>Welcome to Meeter</h1>
      <p className="lead">Your AI copilot for every meeting. It listens, tells you what to say in real time, and writes your notes.</p>
      <ul className="ob-list">
        <li>⚡ Live suggestions: what to say, answers, fact-checks, smart questions</li>
        <li>🎧 Hears you and the other side on Meet, Zoom and Teams</li>
        <li>📝 Notes, action items and follow-up emails after every call</li>
        <li>🔒 Free and private: your meetings stay on your computer</li>
      </ul>
      <button className="btn primary big full" onClick={next}>
        Start setup (1 minute) →
      </button>
    </>
  );
}

function You({ next }: { next: () => void }) {
  const { settings, update } = useStore();
  const [type, setType] = useState<MeetingType>(() => {
    try {
      return JSON.parse(localStorage.getItem('meeter.liveSetup') ?? '{}').type ?? 'general';
    } catch {
      return 'general';
    }
  });
  const save = () => {
    try {
      const d = JSON.parse(localStorage.getItem('meeter.liveSetup') ?? '{}');
      localStorage.setItem('meeter.liveSetup', JSON.stringify({ ...d, type }));
    } catch {
      /* ignore */
    }
    next();
  };
  return (
    <>
      <h2>About you</h2>
      <label className="field">
        Your name
        <input value={settings.userName === 'Me' ? '' : settings.userName} onChange={(e) => update({ userName: e.target.value || 'Me' })} placeholder="e.g. Laksh" autoFocus />
      </label>
      <div className="field">
        What will you use Meeter for most?
        <div className="type-grid">
          {(Object.keys(MEETING_TYPES) as MeetingType[]).map((t) => (
            <button key={t} className={`type ${type === t ? 'on' : ''}`} onClick={() => setType(t)}>
              <span>{MEETING_TYPES[t].emoji}</span>
              {MEETING_TYPES[t].label}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        Main meeting language
        <select value={settings.language} onChange={(e) => update({ language: e.target.value })}>
          {[
            ['en-US', 'English (US)'],
            ['en-IN', 'English (India)'],
            ['en-GB', 'English (UK)'],
            ['hi-IN', 'Hindi'],
            ['es-ES', 'Spanish'],
            ['fr-FR', 'French'],
            ['de-DE', 'German'],
            ['pt-BR', 'Portuguese (BR)'],
            ['ja-JP', 'Japanese'],
          ].map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <button className="btn primary big full" onClick={save}>
        Continue →
      </button>
    </>
  );
}

function Mic({ next }: { next: () => void }) {
  const [state, setState] = useState<'idle' | 'granted' | 'denied'>('idle');
  useEffect(() => {
    navigator.permissions
      ?.query({ name: 'microphone' as PermissionName })
      .then((p) => p.state === 'granted' && setState('granted'))
      .catch(() => {});
  }, []);
  async function ask() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      setState('granted');
    } catch {
      setState('denied');
    }
  }
  return (
    <>
      <h2>🎙️ Allow your microphone</h2>
      <p className="lead">Meeter needs your mic to hear you. Nothing is recorded until you press Start in a meeting.</p>
      {state === 'granted' ? (
        <div className="ob-ok">✓ Microphone allowed</div>
      ) : (
        <button className="btn primary big full" onClick={ask}>
          Allow microphone
        </button>
      )}
      {state === 'denied' && (
        <p className="warn small">
          Blocked. Click the 🔒 / tune icon in the address bar, set Microphone to <b>Allow</b>, then press the button again.
        </p>
      )}
      {state === 'granted' && (
        <button className="btn primary big full" onClick={next}>
          Continue →
        </button>
      )}
    </>
  );
}

function Ai({ next }: { next: () => void }) {
  const { settings, update } = useStore();
  const [status, setStatus] = useState<string>('checking');
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [alt, setAlt] = useState<KeyedProvider>('gemini');

  useEffect(() => {
    builtinStatus().then(setStatus);
  }, []);

  async function download() {
    setErr('');
    setProgress(0);
    try {
      await prepareBuiltin((f) => setProgress(f));
      setStatus(await builtinStatus());
      update({ provider: 'builtin' });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setProgress(null);
    }
  }

  const builtinOk = status === 'available';
  const builtinPossible = status === 'downloadable' || status === 'downloading';
  const usingKey = settings.provider !== 'builtin' && settings.keys[settings.provider as KeyedProvider]?.trim();

  return (
    <>
      <h2>🧠 Turn on the free AI</h2>
      <p className="lead">
        Live suggestions run on <b>Chrome's built-in AI</b>. It's on your own computer, free forever, with no account and no
        API key.
      </p>

      {status === 'checking' && <p className="muted">Checking your browser…</p>}
      {builtinOk && <div className="ob-ok">✓ On-device AI is ready</div>}
      {builtinPossible && (
        <>
          {progress !== null ? (
            <div>
              <p className="small">Downloading the on-device model (one time, a few GB)… {Math.round(progress * 100)}%</p>
              <progress value={progress} max={1} />
            </div>
          ) : (
            <button className="btn primary big full" onClick={download}>
              ⬇ Set up free on-device AI
            </button>
          )}
          <p className="muted small">You can continue while it downloads.</p>
        </>
      )}
      {err && <p className="warn small">{err}</p>}

      {(status === 'unavailable' || status === 'unsupported') && (
        <div className="ob-alt">
          <p className="warn small">
            This computer or browser can't run the on-device AI. It needs desktop Chrome 138+ with about 22 GB free disk
            and 16 GB RAM or a 4 GB+ GPU. Choose a free alternative:
          </p>
          <div className="seg">
            <button className={alt === 'gemini' ? 'on' : ''} onClick={() => setAlt('gemini')}>
              Free Gemini key (recommended)
            </button>
            <button className={alt === 'compatible' ? 'on' : ''} onClick={() => setAlt('compatible')}>
              Free Groq key
            </button>
          </div>
          <p className="small">
            1. Open{' '}
            <a href={PROVIDERS[alt].keyUrl} target="_blank" rel="noreferrer">
              {alt === 'gemini' ? 'Google AI Studio' : 'Groq console'} ↗
            </a>{' '}
            and sign in with your Google account. 2. Click <b>Create API key</b>. 3. Paste it here:
          </p>
          <input
            type="password"
            placeholder="Paste key"
            value={settings.keys[alt]}
            onChange={(e) =>
              update((s) => ({
                ...s,
                provider: alt,
                keys: { ...s.keys, [alt]: e.target.value },
                ...(alt === 'compatible' ? { compatibleBaseUrl: 'https://api.groq.com/openai/v1' } : {}),
              }))
            }
          />
        </div>
      )}

      <details className="ob-more">
        <summary>Advanced: use an API key for higher quality (Gemini, OpenAI, Claude, Groq, Ollama)</summary>
        <p className="small muted">
          You can switch to any provider later in <a onClick={() => openPlatform('/settings')}>Settings</a>. A free Gemini key also
          transcribes the other side of the call very accurately.
        </p>
      </details>

      <button className="btn primary big full" onClick={next} disabled={!builtinOk && !builtinPossible && !usingKey}>
        Continue →
      </button>
    </>
  );
}

function Account({ next }: { next: () => void }) {
  const { settings, update } = useStore();
  return (
    <>
      <h2>🔗 Connect your ChatGPT, Claude or Gemini</h2>
      <p className="lead">
        After a meeting, one click opens <b>your own account</b> with the whole meeting already typed in, so you can go deep
        with the assistant you already pay for or use free.
      </p>
      <div className="assist-grid">
        {(Object.keys(ASSISTANTS) as AssistantId[]).map((a) => (
          <div key={a} className={`assist ${settings.assistant === a ? 'on' : ''}`}>
            <button className="assist-pick" onClick={() => update({ assistant: a })} aria-pressed={settings.assistant === a}>
              <span className="big-ico">{ASSISTANTS[a].icon}</span>
              <b>{ASSISTANTS[a].name}</b>
              {settings.assistant === a && <em>Default</em>}
            </button>
            <a className="btn small" href={ASSISTANTS[a].url} target="_blank" rel="noreferrer">
              Sign in ↗
            </a>
          </div>
        ))}
      </div>
      <p className="muted small">
        Sign in on their website as usual; Meeter never sees your password. Why not run the live copilot on these accounts
        too? ChatGPT, Claude and Gemini don't let other apps use your subscription, so the live part runs on the free
        on-device AI instead.
      </p>
      <button className="btn primary big full" onClick={next}>
        Continue →
      </button>
    </>
  );
}

function Use({ next }: { next: () => void }) {
  return (
    <>
      <h2>🚀 How to use Meeter</h2>
      <ol className="ob-steps">
        <li>
          <b>Pin it:</b> click the 🧩 puzzle icon in Chrome's toolbar, then the 📌 next to Meeter.
        </li>
        <li>
          <b>Join your meeting</b> in Chrome (Google Meet, Zoom web, Teams web…).
        </li>
        <li>
          <b>Click the Meeter icon</b> (or press <kbd>Alt</kbd>+<kbd>M</kbd>). The side panel opens. Press <b>Start listening</b>.
        </li>
        <li>
          Read suggestions in the panel, or tap <b>🪟 Float</b> for a window you can park under your webcam.
        </li>
        <li>
          Press <b>Stop</b> to get notes, or <b>Continue in ChatGPT/Claude/Gemini</b>.
        </li>
      </ol>
      <p className="muted small">
        Please tell people you're using an AI notetaker; many places require everyone's consent to record. Some interviews
        and exams don't allow AI help, so follow their rules.
      </p>
      <button className="btn primary big full" onClick={next}>
        Finish →
      </button>
    </>
  );
}

function Done() {
  const { update } = useStore();
  useEffect(() => update({ onboarded: true }), [update]);
  async function openPanel() {
    try {
      const w = await chrome.windows.getCurrent();
      await chrome.sidePanel.open({ windowId: w.id! });
    } catch {
      /* older Chrome: the toolbar icon still works */
    }
  }
  return (
    <>
      <div className="ob-logo">🎉</div>
      <h1>You're all set</h1>
      <p className="lead">Click the Meeter icon on any meeting tab to start. Want more? Everything lives in the platform.</p>
      {isExtension() && (
        <button className="btn primary big full" onClick={openPanel}>
          Open Meeter side panel
        </button>
      )}
      <button className="btn big full" onClick={() => openPlatform('/')}>
        Explore the full platform
      </button>
    </>
  );
}
