import { useState } from 'react';
import { chat, hasKey, listModels, PROVIDERS, resolveTranscriber } from '../lib/ai';
import { ASSISTANTS, openOnboarding } from '../lib/handoff';
import { browserSpeechSupported } from '../lib/speech';
import { useStore } from '../lib/store';
import type { AssistantId, KeyedProvider, ProviderId, TranscriberId } from '../lib/types';
import { useAiStatus } from './Handoff';

const ORDER: ProviderId[] = ['builtin', 'gemini', 'compatible', 'openai', 'anthropic'];
type KeyedTranscriber = Exclude<TranscriberId, 'builtin'>;

export function SettingsPage() {
  const { settings: s, update, toast } = useStore();
  const [models, setModels] = useState<Partial<Record<KeyedProvider, string[]>>>({});
  const [testing, setTesting] = useState(false);
  const [show, setShow] = useState(false);
  const p = s.provider;
  const kp = p === 'builtin' ? null : p;
  const transcriber = resolveTranscriber(s);
  const ai = useAiStatus();

  async function test() {
    setTesting(true);
    try {
      const out = await chat(s, {
        system: 'Reply with a short friendly confirmation.',
        messages: [{ role: 'user', content: 'Say "Meeter is connected" and nothing else.' }],
        maxTokens: 50,
      });
      toast(`✅ ${PROVIDERS[p].name}: ${out.trim() || 'connected'}`);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setTesting(false);
    }
  }

  async function loadModels(id: KeyedProvider) {
    try {
      const list = await listModels(s, id);
      setModels((m) => ({ ...m, [id]: list }));
      toast(`Loaded ${list.length} models`);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  return (
    <div className="page narrow">
      <h1>Settings</h1>

      <section className="card explain">
        <h3>How Meeter uses AI, for free</h3>
        <ul>
          <li>
            <b>Live copilot:</b> runs on <b>Chrome's built-in AI</b> on your own computer. Free, with no account or key.{' '}
            <span className={ai.ready ? 'ok' : 'warn'}>({ai.label})</span>{' '}
            <button className="linkish" onClick={() => openOnboarding('ai')}>
              Set up
            </button>
          </li>
          <li>
            <b>Deep analysis:</b> one click opens <b>your own ChatGPT, Claude or Gemini account</b> with the meeting typed in.
          </li>
          <li>
            <b>Optional:</b> an API key (a free Gemini or Groq key works) for top quality and for transcribing the other side
            of the call on any device.
          </li>
        </ul>
        <p className="muted small">
          Your keys and meetings stay in this browser. Meeter has no server.{' '}
          <button className="linkish" onClick={() => openOnboarding()}>
            Re-run onboarding
          </button>
        </p>
      </section>

      <section className="card">
        <h3>Your assistant account (for "Continue in…")</h3>
        <div className="seg">
          {(Object.keys(ASSISTANTS) as AssistantId[]).map((a) => (
            <button key={a} className={s.assistant === a ? 'on' : ''} onClick={() => update({ assistant: a })}>
              {ASSISTANTS[a].icon} {ASSISTANTS[a].name}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>AI provider</h3>
        <div className="provider-grid">
          {ORDER.map((id) => (
            <button
              key={id}
              className={`provider ${p === id ? 'on' : ''}`}
              onClick={() => update({ provider: id })}
              aria-pressed={p === id}
            >
              <b>{PROVIDERS[id].name}</b>
              <span>{PROVIDERS[id].free}</span>
              {hasKey(s, id) && <em className="ok">● key set</em>}
            </button>
          ))}
        </div>

        {p === 'builtin' && (
          <p className="small">
            <span className={ai.ready ? 'ok' : 'warn'}>● {ai.label}</span>{' '}
            {!ai.ready && (
              <button className="linkish" onClick={() => openOnboarding('ai')}>
                Set it up
              </button>
            )}
            <br />
            <span className="muted">
              The on-device model has a small memory, so very long meetings are summarised in parts. It can't transcribe
              the other side of a call on most devices yet; add a free Gemini or Groq key below as the transcriber, or
              use speaker mode.
            </span>
          </p>
        )}

        {kp === 'compatible' && (
          <label className="field">
            Base URL
            <input
              value={s.compatibleBaseUrl}
              onChange={(e) => update({ compatibleBaseUrl: e.target.value })}
              placeholder="https://api.groq.com/openai/v1"
            />
            <span className="muted small">
              Groq: https://api.groq.com/openai/v1 · OpenRouter: https://openrouter.ai/api/v1 · Ollama (local, free):
              http://localhost:11434/v1. Start Ollama with OLLAMA_ORIGINS=chrome-extension://* so the extension can reach it.
            </span>
          </label>
        )}

        {kp && (
          <>
            <label className="field">
              {PROVIDERS[kp].name} API key{' '}
              <a href={PROVIDERS[kp].keyUrl} target="_blank" rel="noreferrer" className="small">
                Get a key ↗
              </a>
              <div className="row">
                <input
                  type={show ? 'text' : 'password'}
                  value={s.keys[kp]}
                  onChange={(e) => update((x) => ({ ...x, keys: { ...x.keys, [kp]: e.target.value } }))}
                  placeholder="Paste your key"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button className="btn" onClick={() => setShow(!show)}>
                  {show ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            <label className="field">
              Chat model
              <div className="row">
                <input
                  list={`models-${kp}`}
                  value={s.chatModel[kp]}
                  onChange={(e) => update((x) => ({ ...x, chatModel: { ...x.chatModel, [kp]: e.target.value } }))}
                />
                <datalist id={`models-${kp}`}>
                  {(models[kp] ?? []).map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                <button className="btn" onClick={() => loadModels(kp)} disabled={!hasKey(s, kp)}>
                  Load list
                </button>
              </div>
              <span className="muted small">Fast models give the snappiest live suggestions (Flash / mini / Haiku / Llama on Groq).</span>
            </label>
          </>
        )}

        <button className="btn primary" onClick={test} disabled={testing || !hasKey(s, p)}>
          {testing ? 'Testing…' : 'Test connection'}
        </button>
      </section>

      <section className="card">
        <h3>Transcription</h3>
        <label className="field">
          Your mic
          <select value={s.micEngine} onChange={(e) => update({ micEngine: e.target.value as 'browser' | 'ai' })}>
            <option value="browser">Browser speech recognition: free, instant{!browserSpeechSupported() ? ' (not supported in this browser)' : ''}</option>
            <option value="ai">AI transcriber: more accurate, uses API quota</option>
          </select>
        </label>
        <label className="field">
          AI transcriber (for the other side of the call and uploads)
          <select value={s.transcriber} onChange={(e) => update({ transcriber: e.target.value as 'auto' | TranscriberId })}>
            <option value="auto">Auto: use whichever key is set (now: {transcriber === 'builtin' ? 'on-device' : transcriber})</option>
            <option value="gemini">Gemini (free tier)</option>
            <option value="compatible">OpenAI-compatible, e.g. Groq Whisper (free tier)</option>
            <option value="openai">OpenAI Whisper / gpt-4o-transcribe</option>
            <option value="builtin">On-device (only on supported Chrome builds)</option>
          </select>
        </label>
        {s.transcriber !== 'auto' && s.transcriber !== 'builtin' && s.transcriber !== p && (
          <label className="field">
            {PROVIDERS[s.transcriber].name} API key
            <input
              type="password"
              value={s.keys[s.transcriber]}
              onChange={(e) => update((x) => ({ ...x, keys: { ...x.keys, [x.transcriber as KeyedTranscriber]: e.target.value } }))}
            />
          </label>
        )}
        {s.transcriber === 'auto' && transcriber === 'builtin' && (
          <label className="field">
            Free Gemini key for transcribing the other side (optional, recommended)
            <input
              type="password"
              value={s.keys.gemini}
              placeholder="Paste a key from aistudio.google.com/apikey"
              onChange={(e) => update((x) => ({ ...x, keys: { ...x.keys, gemini: e.target.value } }))}
            />
          </label>
        )}
        <div className="grid2">
          {(['gemini', 'compatible', 'openai'] as KeyedTranscriber[]).map((t) => (
            <label className="field" key={t}>
              {t} transcription model
              <input
                value={s.transcribeModel[t]}
                onChange={(e) =>
                  update((x) => ({ ...x, transcribeModel: { ...x.transcribeModel, [t]: e.target.value } }))
                }
              />
            </label>
          ))}
          <label className="field">
            Language (BCP-47)
            <input value={s.language} onChange={(e) => update({ language: e.target.value })} placeholder="en-US, hi-IN, es-ES…" />
          </label>
        </div>
      </section>

      <section className="card">
        <h3>Copilot</h3>
        <label className="field">
          Your name (how the AI refers to you)
          <input value={s.userName} onChange={(e) => update({ userName: e.target.value })} />
        </label>
        <label className="check">
          <input type="checkbox" checked={s.autoSuggest} onChange={(e) => update({ autoSuggest: e.target.checked })} />
          Auto-suggest: when the other side finishes speaking, prepare what to say
        </label>
        <label className="field">
          Minimum seconds between auto-suggestions: {s.autoSuggestGapSec}s
          <input
            type="range"
            min={8}
            max={90}
            value={s.autoSuggestGapSec}
            onChange={(e) => update({ autoSuggestGapSec: Number(e.target.value) })}
          />
          <span className="muted small">Raise this if you hit free-tier rate limits.</span>
        </label>
        <label className="field">
          Glance window text size: {s.glanceFontPx}px
          <input
            type="range"
            min={14}
            max={40}
            value={s.glanceFontPx}
            onChange={(e) => update({ glanceFontPx: Number(e.target.value) })}
          />
        </label>
      </section>
    </div>
  );
}
