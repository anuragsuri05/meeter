import { useState } from 'react';
import { resolveTranscriber, transcribe } from '../lib/ai';
import { decodeFile, encodeWav, PCM_RATE } from '../lib/audio';
import { MEETING_TYPES } from '../lib/prompts';
import { meetingsDb, uid } from '../lib/storage';
import { navigate, useStore } from '../lib/store';
import type { Meeting, MeetingType, Segment } from '../lib/types';

// 5-minute pieces: ~9.6 MB of 16 kHz WAV each, under every provider's upload limit.
const PIECE_SEC = 300;

export function Upload() {
  const { settings, toast } = useStore();
  const [type, setType] = useState<MeetingType>('general');
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const transcriber = resolveTranscriber(settings);

  async function run(file: File) {
    if (!transcriber) {
      toast('Add a Gemini, Groq or OpenAI key in Settings to transcribe files.', 'error');
      return;
    }
    try {
      setProgress({ done: 0, total: 1, label: 'Decoding audio…' });
      const pcm = await decodeFile(file);
      const pieceLen = PIECE_SEC * PCM_RATE;
      const total = Math.ceil(pcm.length / pieceLen);
      const segments: Segment[] = [];
      let previous = '';
      for (let i = 0; i < total; i++) {
        setProgress({ done: i, total, label: `Transcribing part ${i + 1} of ${total}…` });
        const wav = encodeWav(pcm.subarray(i * pieceLen, (i + 1) * pieceLen), PCM_RATE);
        const text = await transcribe(settings, wav, { previous: previous.slice(-200) });
        if (text) {
          previous = text;
          // Break each piece into ~paragraph segments with approximate timestamps.
          const sentences = text.match(/[^.!?。！？]+[.!?。！？]*\s*/g) ?? [text];
          let para = '';
          let k = 0;
          const flush = () => {
            if (!para.trim()) return;
            segments.push({ id: uid(), speaker: 'Speaker', text: para.trim(), t: (i * PIECE_SEC + (k / sentences.length) * PIECE_SEC) * 1000 });
            para = '';
          };
          sentences.forEach((s, j) => {
            if (!para) k = j;
            para += s;
            if (para.length > 350) flush();
          });
          flush();
        }
      }
      const m: Meeting = {
        id: uid(),
        title: file.name.replace(/\.[^.]+$/, ''),
        type,
        mode: 'inperson',
        source: 'upload',
        createdAt: file.lastModified || Date.now(),
        durationMs: (pcm.length / PCM_RATE) * 1000,
        goal: '',
        context: '',
        segments,
        suggestions: [],
        bookmarks: [],
        chat: [],
      };
      await meetingsDb.put(m);
      navigate(`/m/${m.id}/new`);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="page narrow">
      <h1>Upload a recording</h1>
      <p className="muted">
        Audio or video files (MP3, M4A, WAV, WebM, MP4…) are decoded in your browser, transcribed with your AI key, and
        turned into notes you can search and chat with.
      </p>
      <div className="card">
        <label className="field">
          Meeting type
          <select value={type} onChange={(e) => setType(e.target.value as MeetingType)}>
            {(Object.keys(MEETING_TYPES) as MeetingType[]).map((t) => (
              <option key={t} value={t}>
                {MEETING_TYPES[t].emoji} {MEETING_TYPES[t].label}
              </option>
            ))}
          </select>
        </label>
        {progress ? (
          <div>
            <p>{progress.label}</p>
            <progress value={progress.done} max={progress.total} />
          </div>
        ) : (
          <label
            className="drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) run(f);
            }}
          >
            <input type="file" accept="audio/*,video/*" onChange={(e) => e.target.files?.[0] && run(e.target.files[0])} hidden />
            <b>Drop a file here</b> or click to choose
            <span className="muted small">Transcriber: {transcriber ?? 'none configured'}</span>
          </label>
        )}
      </div>
    </div>
  );
}
