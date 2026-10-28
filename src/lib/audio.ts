// Audio capture + voice-activity chunking. Each MediaStream (your mic, the call's
// audio) gets its own chunker so speakers are separated at the source: "You" vs "Them".

const TARGET_RATE = 16000;


export interface ChunkerOptions {
  /** Called with a 16 kHz mono WAV of one utterance-ish chunk. */
  onChunk: (wav: Blob, startMs: number, endMs: number) => void;
  /** 0..1 input level, ~20x/sec, for meters. */
  onLevel?: (level: number) => void;
  /** Reference time (Date.now()) the meeting started. */
  t0: number;
  minSec?: number;
  maxSec?: number;
}

export class AudioChunker {
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private src: MediaStreamAudioSourceNode | null = null;
  private parts: Float32Array[] = [];
  private samples = 0;
  private silenceSamples = 0;
  private speechSamples = 0;
  private chunkStart = 0;
  private noiseFloor = 0.004;
  private paused = false;

  constructor(private stream: MediaStream, private opts: ChunkerOptions) {}

  async start() {
    this.ctx = new AudioContext();
    // Shipped as a file (public/tap-worklet.js): extension CSP forbids blob: worklets.
    await this.ctx.audioWorklet.addModule(new URL('tap-worklet.js', document.baseURI).href);
    this.src = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, 'meeter-tap');
    const mute = this.ctx.createGain();
    mute.gain.value = 0; // keep the graph pulled without echoing audio to speakers
    this.src.connect(this.node).connect(mute).connect(this.ctx.destination);
    this.chunkStart = Date.now() - this.opts.t0;
    this.node.port.onmessage = (e: MessageEvent<Float32Array>) => this.push(e.data);
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  setPaused(p: boolean) {
    this.paused = p;
    if (p) this.flush();
  }

  private push(block: Float32Array) {
    const rate = this.ctx!.sampleRate;
    let sum = 0;
    for (let i = 0; i < block.length; i++) sum += block[i] * block[i];
    const rms = Math.sqrt(sum / block.length);
    this.opts.onLevel?.(Math.min(1, rms * 8));
    if (this.paused) return;

    // Adaptive noise floor so quiet system audio and loud mics both work.
    this.noiseFloor = rms < this.noiseFloor ? rms * 0.5 + this.noiseFloor * 0.5 : this.noiseFloor * 0.999 + rms * 0.001;
    const speaking = rms > Math.max(0.006, this.noiseFloor * 2.5);

    if (this.samples === 0) this.chunkStart = Date.now() - this.opts.t0 - (block.length / rate) * 1000;
    this.parts.push(block);
    this.samples += block.length;
    if (speaking) {
      this.speechSamples += block.length;
      this.silenceSamples = 0;
    } else {
      this.silenceSamples += block.length;
    }

    const dur = this.samples / rate;
    const minSec = this.opts.minSec ?? 4;
    const maxSec = this.opts.maxSec ?? 15;
    // Leading silence: keep the buffer short so chunks start near speech.
    if (this.speechSamples === 0 && dur > 1.5) {
      this.reset();
      return;
    }
    if ((dur >= minSec && this.silenceSamples / rate >= 0.7) || dur >= maxSec) this.flush();
  }

  private reset() {
    this.parts = [];
    this.samples = 0;
    this.silenceSamples = 0;
    this.speechSamples = 0;
  }

  flush() {
    if (!this.ctx || this.samples === 0) return;
    const rate = this.ctx.sampleRate;
    const enough = this.speechSamples / rate >= 0.35;
    const pcm = concat(this.parts, this.samples);
    const start = this.chunkStart;
    this.reset();
    if (!enough) return;
    const end = start + (pcm.length / rate) * 1000;
    this.opts.onChunk(encodeWav(downsample(pcm, rate, TARGET_RATE), TARGET_RATE), start, end);
  }

  async stop() {
    this.flush();
    this.node?.port.close();
    this.src?.disconnect();
    this.node?.disconnect();
    await this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}

function concat(parts: Float32Array[], total: number) {
  const out = new Float32Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input;
  const ratio = from / to;
  const len = Math.floor(input.length / ratio);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    // Box-filter average over the source window — cheap anti-aliasing.
    const a = Math.floor(i * ratio);
    const b = Math.min(input.length, Math.floor((i + 1) * ratio));
    let s = 0;
    for (let j = a; j < b; j++) s += input[j];
    out[i] = s / Math.max(1, b - a);
  }
  return out;
}

export function encodeWav(pcm: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + pcm.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const x = Math.max(-1, Math.min(1, pcm[i]));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

export async function getMic(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
}

/**
 * Captures the other side of the call. The user picks the meeting tab (Meet/Zoom web/Teams web)
 * and ticks "Share tab audio" — or, on Windows/ChromeOS, the whole screen with system audio.
 */
export async function getCallAudio(): Promise<{ stream: MediaStream; display: MediaStream }> {
  const display = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    // Chrome-only hints; ignored elsewhere.
    ...({ systemAudio: 'include', preferCurrentTab: false, selfBrowserSurface: 'exclude' } as object),
  } as DisplayMediaStreamOptions);
  const tracks = display.getAudioTracks();
  if (!tracks.length) {
    display.getTracks().forEach((t) => t.stop());
    throw new Error('No audio was shared. Pick the meeting tab and turn on "Share tab audio" (or "Share system audio").');
  }
  return { stream: new MediaStream(tracks), display };
}

/**
 * Extension-only: capture the active tab's audio with chrome.tabCapture (no share picker).
 * Tab capture mutes the tab for the user, so we route the audio back to the speakers.
 */
export async function getTabAudio(): Promise<{ stream: MediaStream; stop: () => void; title: string }> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) throw new Error('No active tab found.');
  if (/^(chrome|edge|about|chrome-extension):/.test(tab.url ?? '')) throw new Error('Switch to your meeting tab first.');
  let streamId: string;
  try {
    streamId = await new Promise<string>((resolve, reject) =>
      chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (id) =>
        chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve(id),
      ),
    );
  } catch (e) {
    throw new Error(
      `Chrome blocked tab audio (${(e as Error).message}). Click the Meeter toolbar icon (or press Alt+M) while on the meeting tab, then try again.`,
    );
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
  } as unknown as MediaStreamConstraints);
  const ctx = new AudioContext();
  ctx.createMediaStreamSource(stream).connect(ctx.destination);
  return { stream, title: tab.title ?? '', stop: () => void ctx.close().catch(() => {}) };
}

/** Decode any audio/video file the browser can play into 16 kHz mono PCM. */
export async function decodeFile(file: File): Promise<Float32Array> {
  const ctx = new AudioContext();
  try {
    const audio = await ctx.decodeAudioData(await file.arrayBuffer());
    const mono = new Float32Array(audio.length);
    for (let c = 0; c < audio.numberOfChannels; c++) {
      const d = audio.getChannelData(c);
      for (let i = 0; i < d.length; i++) mono[i] += d[i] / audio.numberOfChannels;
    }
    return downsample(mono, audio.sampleRate, TARGET_RATE);
  } finally {
    await ctx.close().catch(() => {});
  }
}

export const PCM_RATE = TARGET_RATE;
