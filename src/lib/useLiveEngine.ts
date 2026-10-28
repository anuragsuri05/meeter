// The live meeting engine: capture → transcribe → copilot → save.
// Shared by the extension side panel and the full platform's Live page.
import { useCallback, useEffect, useRef, useState } from 'react';
import { chat, resolveTranscriber, transcribe } from './ai';
import { AudioChunker } from './audio';
import { builtinAudioSupported } from './builtin';
import { ACTIONS, copilotSystem, copilotUser, fmtTime, MEETING_TYPES } from './prompts';
import { BrowserSpeech, browserSpeechSupported } from './speech';
import { meetingsDb, uid } from './storage';
import { useStore } from './store';
import type { CaptureMode, Meeting, MeetingType, Segment, Suggestion } from './types';

export interface LiveSetup {
  title: string;
  type: MeetingType;
  mode: CaptureMode;
  goal: string;
  context: string;
}

export interface CallCapture {
  stream: MediaStream;
  /** Extra teardown, e.g. stopping tab-audio playback or a screen share. */
  stop?: () => void;
}

export function useLiveEngine(setup: LiveSetup, mic: MediaStream, initialCall?: CallCapture) {
  const { settings, toast } = useStore();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [meetingId] = useState(uid);
  const [createdAt] = useState(Date.now);
  const t0 = useRef(createdAt);
  const [segments, setSegments] = useState<Segment[]>([]);
  const segRef = useRef<Segment[]>([]);
  const [interim, setInterim] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const sugRef = useRef<Suggestion[]>([]);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const bookmarksRef = useRef<number[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [levels, setLevels] = useState({ mic: 0, call: 0 });
  const [callOn, setCallOn] = useState(false);
  const [callNote, setCallNote] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [stopping, setStopping] = useState(false);

  const calls = useRef<CallCapture[]>([]);
  const chunkers = useRef<{ mic?: AudioChunker; call?: AudioChunker }>({});
  const speech = useRef<BrowserSpeech | null>(null);
  const queues = useRef<Record<string, Promise<void>>>({});
  const prevText = useRef<Record<string, string>>({});
  const abort = useRef<AbortController | null>(null);
  const lastAuto = useRef(0);
  const wordsSince = useRef(0);
  const levelBuf = useRef({ mic: 0, call: 0 });
  const stoppedRef = useRef(false);
  const runningRef = useRef<string | null>(null);
  runningRef.current = running;

  const isInPerson = setup.mode === 'inperson';
  const youLabel = isInPerson ? 'Room' : 'You';

  const snapshot = useCallback(
    (): Meeting => ({
      id: meetingId,
      title: setup.title || `${MEETING_TYPES[setup.type].label} · ${new Date(createdAt).toLocaleDateString()}`,
      type: setup.type,
      mode: setup.mode,
      source: 'live',
      createdAt,
      durationMs: Date.now() - t0.current,
      goal: setup.goal,
      context: setup.context,
      segments: segRef.current,
      suggestions: sugRef.current,
      bookmarks: bookmarksRef.current,
      chat: [],
    }),
    [meetingId, setup, createdAt],
  );

  // ---------- copilot ----------
  const runAction = useCallback(
    async (id: string, label: string, instruction: string, auto = false) => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      const sug: Suggestion = { id: uid(), kind: id, label: auto ? `⚡ ${label}` : label, text: '', t: Date.now() - t0.current };
      const upsert = (patch: Partial<Suggestion>) => {
        sugRef.current = sugRef.current.some((x) => x.id === sug.id)
          ? sugRef.current.map((x) => (x.id === sug.id ? { ...x, ...patch } : x))
          : [{ ...sug, ...patch }, ...sugRef.current];
        setSuggestions(sugRef.current);
      };
      upsert({});
      setRunning(id);
      const s = settingsRef.current;
      try {
        const text = await chat(s, {
          system: copilotSystem(setup, s.userName),
          // On-device AI has a small context window: send less transcript.
          messages: [{ role: 'user', content: copilotUser(segRef.current, instruction, s.provider === 'builtin' ? 3500 : 9000) }],
          maxTokens: 400,
          signal: ctrl.signal,
          onToken: (t) => upsert({ text: t }),
        });
        upsert({ text: text || '_(no suggestion)_' });
      } catch (e) {
        if ((e as Error).name === 'AbortError') {
          sugRef.current = sugRef.current.filter((x) => x.id !== sug.id || x.text);
          setSuggestions(sugRef.current);
        } else {
          upsert({ text: (e as Error).message, error: true });
        }
      } finally {
        if (abort.current === ctrl) setRunning(null);
      }
    },
    [setup],
  );

  const runPreset = useCallback(
    (id: string, auto = false) => {
      const a = ACTIONS.find((x) => x.id === id)!;
      runAction(a.id, a.label, a.prompt, auto);
    },
    [runAction],
  );

  const maybeAutoSuggest = useCallback(
    (seg: Segment) => {
      const s = settingsRef.current;
      if (!s.autoSuggest || stoppedRef.current) return;
      if (seg.speaker !== 'Them' && !isInPerson) return;
      const question = seg.text.includes('?');
      const need = isInPerson ? (question ? 4 : 30) : question ? 3 : 10;
      if (wordsSince.current < need) return;
      const now = Date.now();
      if (now - lastAuto.current < s.autoSuggestGapSec * 1000) return;
      if (runningRef.current) return;
      lastAuto.current = now;
      wordsSince.current = 0;
      runPreset(question ? 'answer' : 'reply', true);
    },
    [isInPerson, runPreset],
  );

  // ---------- transcript ----------
  const addSegment = useCallback(
    (speaker: string, text: string, t: number) => {
      text = text.trim();
      if (!text) return;
      const list = segRef.current;
      const last = list[list.length - 1];
      let seg: Segment;
      if (last && last.speaker === speaker && t >= last.t && t - last.t < 25000 && last.text.length < 450) {
        seg = { ...last, text: `${last.text} ${text}` };
        segRef.current = [...list.slice(0, -1), seg];
      } else {
        seg = { id: uid(), speaker, text, t };
        const idx = list.findIndex((x) => x.t > t);
        segRef.current = idx < 0 ? [...list, seg] : [...list.slice(0, idx), seg, ...list.slice(idx)];
      }
      setSegments(segRef.current);
      wordsSince.current += text.split(/\s+/).length;
      maybeAutoSuggest({ ...seg, text });
    },
    [maybeAutoSuggest],
  );

  const enqueue = useCallback(
    (speaker: string, wav: Blob, start: number) => {
      setPending((n) => n + 1);
      const prev = queues.current[speaker] ?? Promise.resolve();
      queues.current[speaker] = prev.then(async () => {
        try {
          const text = await transcribe(settingsRef.current, wav, { previous: prevText.current[speaker]?.slice(-200) });
          if (text) {
            prevText.current[speaker] = text;
            addSegment(speaker, text, start);
          }
        } catch (e) {
          toast(`Transcription: ${(e as Error).message}`, 'error');
        } finally {
          setPending((n) => n - 1);
        }
      });
    },
    [addSegment, toast],
  );

  /** Can the AI transcriber actually turn call audio into text on this setup? */
  const canTranscribeAudio = useCallback(async () => {
    const t = resolveTranscriber(settingsRef.current);
    return t !== 'builtin' || (await builtinAudioSupported());
  }, []);

  const attachCall = useCallback(
    async (cap: CallCapture) => {
      calls.current.push(cap);
      const ok = await canTranscribeAudio();
      setCallNote(
        ok
          ? null
          : "Call audio is connected, but this browser can't transcribe it on-device yet. Use speaker mode (no headphones) or add a free Gemini/Groq key in Settings.",
      );
      await chunkers.current.call?.stop();
      const c = new AudioChunker(cap.stream, {
        t0: t0.current,
        onLevel: (l) => (levelBuf.current.call = l),
        onChunk: (wav, start) => {
          if (ok) enqueue('Them', wav, start);
        },
      });
      await c.start();
      chunkers.current.call = c;
      setCallOn(true);
      cap.stream.getAudioTracks()[0]?.addEventListener('ended', () => {
        setCallOn(false);
        if (!stoppedRef.current) toast('Call audio stopped.', 'error');
      });
    },
    [canTranscribeAudio, enqueue, toast],
  );

  const releaseAll = useCallback(() => {
    stoppedRef.current = true;
    speech.current?.stop();
    chunkers.current.mic?.stop();
    chunkers.current.call?.stop();
    mic.getTracks().forEach((t) => t.stop());
    for (const c of calls.current) {
      c.stream.getTracks().forEach((t) => t.stop());
      c.stop?.();
    }
  }, [mic]);

  // ---------- lifecycle ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = settingsRef.current;
      // Mic: free browser speech unless the user chose AI and it can actually do audio.
      const aiMic = s.micEngine === 'ai' && (await canTranscribeAudio());
      const useBrowser = !aiMic && browserSpeechSupported();
      if (cancelled) return;
      if (!aiMic && !useBrowser) toast('No speech recognition available for your mic in this browser.', 'error');
      const mc = new AudioChunker(mic, {
        t0: t0.current,
        onLevel: (l) => (levelBuf.current.mic = l),
        onChunk: (wav, start) => {
          if (aiMic) enqueue(youLabel, wav, start);
        },
      });
      mc.start().catch((e) => toast(`Mic: ${e.message}`, 'error'));
      chunkers.current.mic = mc;
      if (useBrowser) {
        let speechStart = 0;
        speech.current = new BrowserSpeech(
          s.language,
          (txt) => {
            if (txt && !speechStart) speechStart = Date.now() - t0.current;
            setInterim(txt);
          },
          (txt) => {
            addSegment(youLabel, txt, speechStart || Date.now() - t0.current);
            speechStart = 0;
            setInterim('');
          },
          (msg) => toast(msg, 'error'),
        );
        speech.current.start();
      }
      if (initialCall) attachCall(initialCall);
    })();

    const tick = setInterval(() => {
      setElapsed(Date.now() - t0.current);
      setLevels({ ...levelBuf.current });
    }, 100);
    const autosave = setInterval(() => {
      if (segRef.current.length && !stoppedRef.current) meetingsDb.put(snapshot()).catch(() => {});
    }, 10000);

    let wake: { release(): Promise<void> } | null = null;
    (navigator as unknown as { wakeLock?: { request(t: string): Promise<{ release(): Promise<void> }> } }).wakeLock
      ?.request('screen')
      .then((w) => (wake = w))
      .catch(() => {});

    const onUnload = () => {
      if (segRef.current.length) meetingsDb.put(snapshot()).catch(() => {});
      releaseAll();
    };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      cancelled = true;
      clearInterval(tick);
      clearInterval(autosave);
      window.removeEventListener('beforeunload', onUnload);
      wake?.release().catch(() => {});
      releaseAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePause = useCallback(() => {
    setPaused((p) => {
      const next = !p;
      chunkers.current.mic?.setPaused(next);
      chunkers.current.call?.setPaused(next);
      speech.current?.setPaused(next);
      return next;
    });
  }, []);

  const bookmark = useCallback(() => {
    const t = Date.now() - t0.current;
    bookmarksRef.current = [...bookmarksRef.current, t];
    setBookmarks(bookmarksRef.current);
    toast(`🔖 Bookmarked ${fmtTime(t)}`);
  }, [toast]);

  /** Stops capture, waits for in-flight transcription, saves, and returns the meeting. */
  const stop = useCallback(async (): Promise<Meeting> => {
    setStopping(true);
    abort.current?.abort();
    speech.current?.stop();
    if (interim) addSegment(youLabel, interim, Date.now() - t0.current);
    await Promise.all([chunkers.current.mic?.stop(), chunkers.current.call?.stop()]);
    await Promise.race([Promise.all(Object.values(queues.current)), new Promise((r) => setTimeout(r, 25000))]);
    releaseAll();
    const m = snapshot();
    await meetingsDb.put(m);
    return m;
  }, [addSegment, interim, releaseAll, snapshot, youLabel]);

  return {
    meetingId,
    segments,
    interim,
    suggestions,
    bookmarks,
    elapsed,
    paused,
    running,
    levels,
    callOn,
    callNote,
    pending,
    stopping,
    youLabel,
    isInPerson,
    runAction,
    runPreset,
    togglePause,
    bookmark,
    attachCall,
    stop,
  };
}

export type LiveEngine = ReturnType<typeof useLiveEngine>;
