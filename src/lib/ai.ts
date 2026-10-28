// Provider-agnostic AI layer. Every call goes straight from the browser to the
// provider with the user's own key — there is no Meeter server in between.
import { builtinChat, builtinTranscribe } from './builtin';
import type { ChatMsg, KeyedProvider, ProviderId, Settings, TranscriberId } from './types';

export const PROVIDERS: Record<
  ProviderId,
  { name: string; keyUrl: string; free: string; audio: boolean }
> = {
  builtin: {
    name: 'Chrome built-in AI (on-device)',
    keyUrl: '',
    free: 'Free, private, no account or key needed. Runs Gemini Nano on your computer.',
    audio: false,
  },
  gemini: {
    name: 'Google Gemini',
    keyUrl: 'https://aistudio.google.com/apikey',
    free: 'Free tier — recommended. Handles chat and transcription.',
    audio: true,
  },
  compatible: {
    name: 'OpenAI-compatible (Groq / OpenRouter / Ollama)',
    keyUrl: 'https://console.groq.com/keys',
    free: 'Groq has a free tier with fast Llama + Whisper. Ollama is free and fully local.',
    audio: true,
  },
  openai: {
    name: 'OpenAI (ChatGPT models)',
    keyUrl: 'https://platform.openai.com/api-keys',
    free: 'Pay-as-you-go API key (separate from a ChatGPT subscription).',
    audio: true,
  },
  anthropic: {
    name: 'Anthropic (Claude models)',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    free: 'Pay-as-you-go API key (separate from a Claude subscription). No audio — pair with a transcriber.',
    audio: false,
  },
};

export interface ChatRequest {
  system: string;
  messages: ChatMsg[];
  maxTokens?: number;
  signal?: AbortSignal;
  onToken?: (fullTextSoFar: string) => void;
}

function baseUrl(s: Settings, p: 'openai' | 'compatible') {
  if (p === 'compatible') return s.compatibleBaseUrl.replace(/\/+$/, '');
  return 'https://api.openai.com/v1';
}

async function fail(res: Response): Promise<never> {
  let msg = `${res.status} ${res.statusText}`;
  try {
    const body = await res.text();
    try {
      const j = JSON.parse(body);
      msg = j.error?.message || j.message || body || msg;
    } catch {
      if (body) msg = body.slice(0, 300);
    }
  } catch {
    /* ignore */
  }
  if (res.status === 429) msg = `Rate limit reached — slow down auto-suggest or wait a moment. (${msg})`;
  if (res.status === 401 || res.status === 403) msg = `API key rejected — check Settings. (${msg})`;
  throw new Error(msg);
}

async function* sse(res: Response): AsyncGenerator<string> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
      if (line.startsWith('data:')) yield line.slice(5).trim();
    }
  }
  if (buf.startsWith('data:')) yield buf.slice(5).trim();
}

export function hasKey(s: Settings, p: ProviderId | TranscriberId = s.provider) {
  if (p === 'builtin') return true;
  // Local Ollama needs no key.
  if (p === 'compatible' && /localhost|127\.0\.0\.1/.test(s.compatibleBaseUrl)) return true;
  return !!s.keys[p]?.trim();
}

export async function chat(s: Settings, req: ChatRequest): Promise<string> {
  if (s.provider === 'builtin') return builtinChat(req.system, req.messages, req.onToken, req.signal);
  const p: KeyedProvider = s.provider;
  if (!hasKey(s, p)) throw new Error(`Add your ${PROVIDERS[p].name} API key in Settings first.`);
  const model = s.chatModel[p];
  const maxTokens = req.maxTokens ?? 1024;
  let out = '';
  const emit = (t: string) => {
    if (!t) return;
    out += t;
    req.onToken?.(out);
  };

  if (p === 'gemini') {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
      {
        method: 'POST',
        signal: req.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': s.keys.gemini.trim() },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: req.messages.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.5 },
        }),
      },
    );
    if (!res.ok) await fail(res);
    for await (const d of sse(res)) {
      try {
        const j = JSON.parse(d);
        const parts = j.candidates?.[0]?.content?.parts ?? [];
        // Skip "thought" parts from thinking models.
        emit(parts.filter((x: { thought?: boolean }) => !x.thought).map((x: { text?: string }) => x.text ?? '').join(''));
      } catch {
        /* partial line */
      }
    }
    return out;
  }

  if (p === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: req.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': s.keys.anthropic.trim(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: req.system,
        messages: req.messages,
        stream: true,
      }),
    });
    if (!res.ok) await fail(res);
    for await (const d of sse(res)) {
      try {
        const j = JSON.parse(d);
        if (j.type === 'content_block_delta' && j.delta?.type === 'text_delta') emit(j.delta.text);
        if (j.type === 'error') throw new Error(j.error?.message ?? 'Anthropic stream error');
      } catch (e) {
        if (e instanceof Error && !(e instanceof SyntaxError)) throw e;
      }
    }
    return out;
  }

  // openai + any OpenAI-compatible endpoint
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (s.keys[p]?.trim()) headers.Authorization = `Bearer ${s.keys[p].trim()}`;
  const res = await fetch(`${baseUrl(s, p)}/chat/completions`, {
    method: 'POST',
    signal: req.signal,
    headers,
    body: JSON.stringify({
      model,
      stream: true,
      max_completion_tokens: p === 'openai' ? maxTokens : undefined,
      max_tokens: p === 'compatible' ? maxTokens : undefined,
      messages: [{ role: 'system', content: req.system }, ...req.messages],
    }),
  });
  if (!res.ok) await fail(res);
  for await (const d of sse(res)) {
    if (d === '[DONE]') break;
    try {
      emit(JSON.parse(d).choices?.[0]?.delta?.content ?? '');
    } catch {
      /* partial line */
    }
  }
  return out;
}

export function resolveTranscriber(s: Settings): TranscriberId {
  if (s.transcriber !== 'auto') return hasKey(s, s.transcriber) ? s.transcriber : 'builtin';
  if (s.provider !== 'anthropic' && s.provider !== 'builtin' && s.keys[s.provider]?.trim()) return s.provider;
  // Claude / built-in have no cloud audio API: borrow any other configured key, else try on-device.
  for (const t of ['gemini', 'compatible', 'openai'] as const) if (s.keys[t]?.trim()) return t;
  return 'builtin';
}

// Whisper-family models invent these on near-silent audio.
const HALLUCINATIONS = /^(thank you\.?|thanks for watching!?|you|\.|bye\.?|\[.*\]|\(.*\)|no speech\.?)$/i;

async function blobToBase64(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function transcribe(
  s: Settings,
  wav: Blob,
  opts: { previous?: string; signal?: AbortSignal } = {},
): Promise<string> {
  const t = resolveTranscriber(s);
  const lang = s.language.split('-')[0];
  let text = '';

  if (t === 'builtin') {
    text = await builtinTranscribe(wav, s.language, opts.signal);
  } else if (t === 'gemini') {
    const model = s.transcribeModel[t];
    const data = await blobToBase64(wav);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        signal: opts.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': s.keys.gemini.trim() },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text:
                    `Transcribe this audio verbatim (expected language: ${s.language}; keep any code-switching as spoken). ` +
                    `Output ONLY the spoken words as plain text — no labels, timestamps or commentary. ` +
                    `If there is no intelligible speech, output exactly: <none>` +
                    (opts.previous ? `\nFor context, the preceding words were: "${opts.previous}"` : ''),
                },
                { inline_data: { mime_type: 'audio/wav', data } },
              ],
            },
          ],
          generationConfig: { temperature: 0 },
        }),
      },
    );
    if (!res.ok) await fail(res);
    const j = await res.json();
    text = (j.candidates?.[0]?.content?.parts ?? [])
      .filter((x: { thought?: boolean }) => !x.thought)
      .map((x: { text?: string }) => x.text ?? '')
      .join('');
  } else {
    const fd = new FormData();
    fd.append('file', wav, 'audio.wav');
    fd.append('model', s.transcribeModel[t]);
    if (lang) fd.append('language', lang);
    if (opts.previous) fd.append('prompt', opts.previous);
    const headers: Record<string, string> = {};
    if (s.keys[t]?.trim()) headers.Authorization = `Bearer ${s.keys[t].trim()}`;
    const res = await fetch(`${baseUrl(s, t)}/audio/transcriptions`, {
      method: 'POST',
      signal: opts.signal,
      headers,
      body: fd,
    });
    if (!res.ok) await fail(res);
    text = (await res.json()).text ?? '';
  }

  text = text.replace(/<none>/gi, '').trim();
  return HALLUCINATIONS.test(text) ? '' : text;
}

export async function listModels(s: Settings, p: KeyedProvider): Promise<string[]> {
  if (p === 'gemini') {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
      headers: { 'x-goog-api-key': s.keys.gemini.trim() },
    });
    if (!res.ok) await fail(res);
    const j = await res.json();
    return (j.models ?? [])
      .filter((m: { supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: { name: string }) => m.name.replace(/^models\//, ''));
  }
  if (p === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
      headers: {
        'x-api-key': s.keys.anthropic.trim(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
    });
    if (!res.ok) await fail(res);
    return ((await res.json()).data ?? []).map((m: { id: string }) => m.id);
  }
  const headers: Record<string, string> = {};
  if (s.keys[p]?.trim()) headers.Authorization = `Bearer ${s.keys[p].trim()}`;
  const res = await fetch(`${baseUrl(s, p)}/models`, { headers });
  if (!res.ok) await fail(res);
  return ((await res.json()).data ?? []).map((m: { id: string }) => m.id).sort();
}
