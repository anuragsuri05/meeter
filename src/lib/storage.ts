import type { Meeting, Settings } from './types';

export const SETTINGS_KEY = 'meeter.settings.v1';
const DB_NAME = 'meeter';
const STORE = 'meetings';

export const DEFAULT_SETTINGS: Settings = {
  provider: 'builtin',
  keys: { gemini: '', openai: '', anthropic: '', compatible: '' },
  chatModel: {
    gemini: 'gemini-2.5-flash',
    openai: 'gpt-4o-mini',
    anthropic: 'claude-haiku-5-5',
    compatible: 'llama-3.3-70b-versatile',
  },
  transcriber: 'auto',
  transcribeModel: {
    gemini: 'gemini-2.5-flash',
    openai: 'whisper-1',
    compatible: 'whisper-large-v3-turbo',
  },
  compatibleBaseUrl: 'https://api.groq.com/openai/v1',
  micEngine: 'browser',
  language: 'en-US',
  userName: 'Me',
  autoSuggest: true,
  autoSuggestGapSec: 20,
  glanceFontPx: 22,
  assistant: 'chatgpt',
  onboarded: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    const s = JSON.parse(raw) as Partial<Settings>;
    return {
      ...DEFAULT_SETTINGS,
      ...s,
      keys: { ...DEFAULT_SETTINGS.keys, ...s.keys },
      chatModel: { ...DEFAULT_SETTINGS.chatModel, ...s.chatModel },
      transcribeModel: { ...DEFAULT_SETTINGS.transcribeModel, ...s.transcribeModel },
    };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage blocked: settings live for this session only */
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(d.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const meetingsDb = {
  all: async (): Promise<Meeting[]> => {
    const list = await tx<Meeting[]>('readonly', (s) => s.getAll() as IDBRequest<Meeting[]>);
    return list.sort((a, b) => b.createdAt - a.createdAt);
  },
  get: (id: string) => tx<Meeting | undefined>('readonly', (s) => s.get(id) as IDBRequest<Meeting | undefined>),
  put: (m: Meeting) => tx('readwrite', (s) => s.put(m)),
  remove: (id: string) => tx('readwrite', (s) => s.delete(id)),
};

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
