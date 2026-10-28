// "Continue in ChatGPT / Claude / Gemini": opens the user's own logged-in assistant with the meeting
// already typed into the message box (see src/extension/handoff-content.ts). The user reviews it and
// presses Enter themselves; nothing is sent or read back automatically.
import { MEETING_TYPES, transcriptText } from './prompts';
import type { AssistantId, Meeting } from './types';

export const ASSISTANTS: Record<AssistantId, { name: string; url: string; icon: string }> = {
  chatgpt: { name: 'ChatGPT', url: 'https://chatgpt.com/', icon: '🟢' },
  claude: { name: 'Claude', url: 'https://claude.ai/new', icon: '🟠' },
  gemini: { name: 'Gemini', url: 'https://gemini.google.com/app', icon: '🔵' },
};

export const HANDOFF_KEY = 'meeter.handoff';

export const isExtension = () => typeof chrome !== 'undefined' && !!chrome.runtime?.id;

/** Open the full platform (app.html) at a route, e.g. "/m/abc/new". */
export function openPlatform(route = '/') {
  if (isExtension()) chrome.tabs.create({ url: chrome.runtime.getURL(`app.html#${route}`) });
  else if (/app\.html$/.test(location.pathname)) location.hash = route;
  else location.href = `app.html#${route}`;
}

export function openOnboarding(step = '') {
  if (isExtension()) chrome.tabs.create({ url: chrome.runtime.getURL(`onboarding.html${step ? '#' + step : ''}`) });
  else window.location.href = `onboarding.html${step ? '#' + step : ''}`;
}

export const HANDOFF_TASKS = [
  { id: 'notes', label: 'Full notes & action items', prompt: 'Write detailed meeting notes: TL;DR, key points, decisions, action items (owner, due), open questions, and a ready-to-send follow-up email.' },
  { id: 'coach', label: 'Coach me on this meeting', prompt: 'Act as an expert coach. Analyse how I did against my goal: what went well, what I missed, how I should have answered the hardest moments, and exactly what to do next.' },
  { id: 'next', label: 'Prepare my next meeting', prompt: 'Help me prepare for the next meeting with these people: likely questions and objections with strong answers, what to bring, and an agenda.' },
  { id: 'chat', label: 'Just open it so I can ask', prompt: 'I will ask you questions about this meeting. First, reply with a 3-bullet summary.' },
] as const;

export function buildHandoffPrompt(m: Meeting, task: string, maxChars = 90000) {
  return [
    task,
    '',
    `Meeting: "${m.title}", ${MEETING_TYPES[m.type].label}, ${new Date(m.createdAt).toLocaleString()}.`,
    m.goal ? `My goal: ${m.goal}` : '',
    m.context ? `My background:\n${m.context.slice(0, 6000)}` : '',
    m.notes ? `Notes so far:\n${m.notes.slice(0, 8000)}` : '',
    '"You" in the transcript is me.',
    '',
    'Transcript:',
    transcriptText(m.segments, maxChars),
  ]
    .filter((x) => x !== '')
    .join('\n');
}

/** Returns how the text got there: typed into the page by the extension, or left on the clipboard. */
export async function handoff(target: AssistantId, text: string): Promise<'prefilled' | 'clipboard'> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* clipboard may be blocked; the extension path still works */
  }
  if (isExtension()) {
    await chrome.storage.local.set({ [HANDOFF_KEY]: { target, text, at: Date.now() } });
    await chrome.tabs.create({ url: ASSISTANTS[target].url });
    return 'prefilled';
  }
  window.open(ASSISTANTS[target].url, '_blank', 'noopener');
  return 'clipboard';
}
