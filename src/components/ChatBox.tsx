import { useEffect, useRef, useState } from 'react';
import { chat } from '../lib/ai';
import { useStore } from '../lib/store';
import type { ChatMsg } from '../lib/types';
import { Markdown } from './Markdown';

interface Props {
  system: (msgs: ChatMsg[]) => string;
  messages: ChatMsg[];
  onChange: (msgs: ChatMsg[]) => void;
  placeholder?: string;
  starters?: string[];
}

export function ChatBox({ system, messages, onChange, placeholder, starters = [] }: Props) {
  const { settings, toast } = useStore();
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [messages.length, streaming]);
  useEffect(() => () => abort.current?.abort(), []);

  async function send(text: string) {
    const q = text.trim();
    if (!q || streaming !== null) return;
    setInput('');
    const next: ChatMsg[] = [...messages, { role: 'user', content: q }];
    onChange(next);
    setStreaming('');
    abort.current = new AbortController();
    try {
      const out = await chat(settings, {
        system: system(next),
        messages: next.slice(-12),
        maxTokens: 2048,
        signal: abort.current.signal,
        onToken: setStreaming,
      });
      onChange([...next, { role: 'assistant', content: out || '_(no answer)_' }]);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast((e as Error).message, 'error');
      onChange(next);
    } finally {
      setStreaming(null);
    }
  }

  return (
    <div className="chat">
      <div className="chat-log">
        {messages.length === 0 && streaming === null && starters.length > 0 && (
          <div className="starters">
            {starters.map((s) => (
              <button key={s} className="chip" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.role === 'assistant' ? <Markdown text={m.content} /> : m.content}
          </div>
        ))}
        {streaming !== null && (
          <div className="bubble assistant">{streaming ? <Markdown text={streaming} /> : <span className="dots">Thinking</span>}</div>
        )}
        <div ref={end} />
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={placeholder ?? 'Ask anything…'} />
        {streaming !== null ? (
          <button type="button" className="btn" onClick={() => abort.current?.abort()}>
            Stop
          </button>
        ) : (
          <button className="btn primary" disabled={!input.trim()}>
            Ask
          </button>
        )}
      </form>
    </div>
  );
}
