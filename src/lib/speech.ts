// Free, instant, on-device-ish transcription of the microphone via the Web Speech API
// (Chrome/Edge/Safari). Restarts itself because browsers end sessions after silence.

interface SR extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
interface SREvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

const Ctor = (): (new () => SR) | undefined =>
  (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR })
    .SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition;

export const browserSpeechSupported = () => !!Ctor();

export class BrowserSpeech {
  private rec: SR | null = null;
  private active = false;

  constructor(
    private lang: string,
    private onInterim: (text: string) => void,
    private onFinal: (text: string) => void,
    private onError: (msg: string) => void,
  ) {}

  start() {
    const C = Ctor();
    if (!C) {
      this.onError('Browser speech recognition is not supported here — switch "Your mic" to AI in Settings.');
      return;
    }
    this.active = true;
    const rec = new C();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) this.onFinal(r[0].transcript.trim());
        else interim += r[0].transcript;
      }
      this.onInterim(interim.trim());
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.active = false;
        this.onError('Microphone speech recognition was blocked.');
      }
    };
    rec.onend = () => {
      if (this.active) setTimeout(() => this.active && this.restart(), 250);
    };
    this.rec = rec;
    try {
      rec.start();
    } catch {
      /* already started */
    }
  }

  private restart() {
    try {
      this.rec?.start();
    } catch {
      this.start();
    }
  }

  setPaused(p: boolean) {
    if (p) {
      this.active = false;
      this.rec?.stop();
    } else if (!this.active) {
      this.start();
    }
  }

  stop() {
    this.active = false;
    this.rec?.abort();
    this.rec = null;
  }
}
