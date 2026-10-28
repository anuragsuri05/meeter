/** 'builtin' = Chrome's on-device Gemini Nano: free, no key, no login. */
export type ProviderId = 'builtin' | 'gemini' | 'openai' | 'anthropic' | 'compatible';
export type KeyedProvider = Exclude<ProviderId, 'builtin'>;
export type TranscriberId = 'builtin' | 'gemini' | 'openai' | 'compatible';
/** The user's own logged-in chat assistant, used for one-click "continue in…" hand-offs. */
export type AssistantId = 'chatgpt' | 'claude' | 'gemini';

export type MeetingType =
  | 'general'
  | 'sales'
  | 'interview'
  | 'negotiation'
  | 'team'
  | 'lecture'
  | 'support';

export type CaptureMode = 'online' | 'inperson';

export interface Segment {
  id: string;
  speaker: string;
  text: string;
  /** ms since meeting start */
  t: number;
}

export interface Suggestion {
  id: string;
  kind: string;
  label: string;
  text: string;
  t: number;
  error?: boolean;
}

export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export interface Meeting {
  id: string;
  title: string;
  type: MeetingType;
  mode: CaptureMode;
  source: 'live' | 'upload';
  createdAt: number;
  durationMs: number;
  goal: string;
  context: string;
  segments: Segment[];
  suggestions: Suggestion[];
  bookmarks: number[];
  notes?: string;
  chat: ChatMsg[];
}

export interface Settings {
  provider: ProviderId;
  keys: Record<KeyedProvider, string>;
  chatModel: Record<KeyedProvider, string>;
  transcriber: 'auto' | TranscriberId;
  transcribeModel: Record<Exclude<TranscriberId, 'builtin'>, string>;
  compatibleBaseUrl: string;
  /** How your own mic is transcribed: free browser speech recognition, or the AI transcriber. */
  micEngine: 'browser' | 'ai';
  language: string;
  userName: string;
  autoSuggest: boolean;
  autoSuggestGapSec: number;
  glanceFontPx: number;
  assistant: AssistantId;
  onboarded: boolean;
}
