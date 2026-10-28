// Chrome's built-in, on-device Gemini Nano via the Prompt API (Chrome 138+ in extensions).
// Free, private, no account and no API key. The model downloads once (~2–4 GB) on first use.

type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

interface LMContent {
  type: 'text' | 'audio';
  value: string | Blob;
}
interface LMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | LMContent[];
}
interface LMSession {
  prompt(input: string | LMMessage[], o?: { signal?: AbortSignal }): Promise<string>;
  promptStreaming(input: string | LMMessage[], o?: { signal?: AbortSignal }): ReadableStream<string>;
  clone(o?: { signal?: AbortSignal }): Promise<LMSession>;
  destroy(): void;
  inputQuota?: number;
}
interface LMStatic {
  availability(o?: object): Promise<Availability>;
  create(o?: {
    initialPrompts?: LMMessage[];
    expectedInputs?: { type: string; languages?: string[] }[];
    expectedOutputs?: { type: string; languages?: string[] }[];
    monitor?: (m: EventTarget) => void;
    signal?: AbortSignal;
  }): Promise<LMSession>;
}

const LM = (): LMStatic | undefined => (globalThis as unknown as { LanguageModel?: LMStatic }).LanguageModel;

const TEXT_IO = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
};

export async function builtinStatus(): Promise<Availability | 'unsupported'> {
  const lm = LM();
  if (!lm) return 'unsupported';
  try {
    return await lm.availability(TEXT_IO);
  } catch {
    return 'unavailable';
  }
}

/** Must be called from a user click the first time (the download needs a user gesture). */
export async function prepareBuiltin(onProgress?: (fraction: number) => void): Promise<void> {
  const lm = LM();
  if (!lm) throw new Error(UNSUPPORTED);
  const s = await lm.create({
    ...TEXT_IO,
    monitor(m) {
      m.addEventListener('downloadprogress', (e) => onProgress?.((e as unknown as { loaded: number }).loaded));
    },
  });
  s.destroy();
}

const UNSUPPORTED =
  "This browser has no built-in AI. Use Chrome 138+ on a desktop with enough memory, or pick another AI in Settings (an API key, or Ollama).";

// Cache one primed session per system prompt; clone it per request (cheap, keeps the system prompt warm).
let cached: { system: string; session: LMSession } | null = null;

async function sessionFor(system: string, signal?: AbortSignal): Promise<LMSession> {
  const lm = LM();
  if (!lm) throw new Error(UNSUPPORTED);
  const status = await builtinStatus();
  if (status === 'unavailable' || status === 'unsupported') throw new Error(UNSUPPORTED);
  if (status !== 'available')
    throw new Error('On-device AI is still downloading. Open Meeter onboarding or Settings to finish setting it up.');
  if (cached?.system !== system) {
    cached?.session.destroy();
    cached = { system, session: await lm.create({ ...TEXT_IO, initialPrompts: [{ role: 'system', content: system }] }) };
  }
  return cached.session.clone({ signal });
}

/** Roughly what fits in Nano's context window, in characters (leaves room for the answer). */
export const BUILTIN_CHAR_BUDGET = 9000;

function fit(text: string, max: number) {
  if (text.length <= max) return text;
  const head = Math.floor(max * 0.35);
  return text.slice(0, head) + '\n…(trimmed to fit on-device AI)…\n' + text.slice(text.length - (max - head));
}

export async function builtinChat(
  system: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  onToken?: (full: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const sys = fit(system, BUILTIN_CHAR_BUDGET * 0.6);
  const recent = messages.slice(-4).map((m) => ({ ...m, content: fit(m.content, BUILTIN_CHAR_BUDGET * 0.4) }));
  const session = await sessionFor(sys, signal);
  try {
    const stream = session.promptStreaming(recent as LMMessage[], { signal });
    const reader = stream.getReader();
    let out = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      // Older Chrome streamed the whole text so far; newer streams deltas. Handle both.
      out = value.startsWith(out) && out.length > 0 ? value : out + value;
      onToken?.(out);
    }
    return out;
  } finally {
    session.destroy();
  }
}

let audioSupport: Promise<boolean> | null = null;

/** Multimodal (audio) Prompt API: transcribes call audio on-device when the browser supports it. */
export function builtinAudioSupported(): Promise<boolean> {
  if (!audioSupport) {
    audioSupport = (async () => {
      const lm = LM();
      if (!lm) return false;
      try {
        return (await lm.availability({ expectedInputs: [{ type: 'audio' }] })) === 'available';
      } catch {
        return false;
      }
    })();
  }
  return audioSupport;
}

let audioSession: LMSession | null = null;

export async function builtinTranscribe(wav: Blob, language: string, signal?: AbortSignal): Promise<string> {
  const lm = LM();
  if (!lm || !(await builtinAudioSupported()))
    throw new Error('On-device transcription of call audio is not supported in this Chrome yet. Use "speaker mode" or add a free Gemini/Groq key.');
  audioSession ??= await lm.create({ expectedInputs: [{ type: 'audio' }, { type: 'text' }] });
  const s = await audioSession.clone({ signal });
  try {
    return await s.prompt(
      [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              value: `Transcribe this audio verbatim (language: ${language}). Output only the spoken words. If there is no speech, output <none>.`,
            },
            { type: 'audio', value: wav },
          ],
        },
      ],
      { signal },
    );
  } finally {
    s.destroy();
  }
}
