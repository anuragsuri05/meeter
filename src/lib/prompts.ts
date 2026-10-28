import type { Meeting, MeetingType, Segment } from './types';

export const MEETING_TYPES: Record<MeetingType, { label: string; emoji: string; guide: string; notes: string }> = {
  general: {
    label: 'General meeting',
    emoji: '💬',
    guide: 'Help the user communicate clearly, stay on point and move toward their goal.',
    notes: '',
  },
  sales: {
    label: 'Sales / client call',
    emoji: '💼',
    guide:
      'Track pain points, budget, decision-makers, timeline and objections (MEDDICC/BANT). Handle objections with empathy + evidence, and always steer toward a concrete next step.',
    notes:
      '## Deal insights\nPain points, budget, decision process & people, timeline, competitors mentioned, objections raised (and how they were handled), buying signals, risks.\n\n## Next step\nThe agreed next step, or the one to propose.',
  },
  interview: {
    label: 'Interview',
    emoji: '🎯',
    guide:
      'Help the user answer with structure (STAR: Situation, Task, Action, Result), using ONLY real experience from their background. Keep answers authentic, specific and quantified where the background allows.',
    notes:
      '## Questions & answers\nEach question asked, with a one-line summary of the answer given.\n\n## How it went\nStrengths, weak spots, and how to improve each weak answer.',
  },
  negotiation: {
    label: 'Negotiation',
    emoji: '🤝',
    guide:
      'Think like an expert negotiator: anchor well, ask calibrated questions, trade concessions (never give one away free), protect the BATNA, and spot the other side\'s interests behind positions.',
    notes:
      '## Positions & interests\nWhat each side asked for, and the interests behind it.\n\n## Concessions\nWhat was offered or traded by each side.\n\n## Leverage & next move',
  },
  team: {
    label: 'Team meeting / stand-up',
    emoji: '👥',
    guide: 'Help keep it focused: surface blockers, owners and deadlines, and spot unresolved decisions.',
    notes: '## Updates by person\n\n## Blockers',
  },
  lecture: {
    label: 'Lecture / learning',
    emoji: '📚',
    guide: 'Act as a tutor: explain concepts simply with examples, define jargon, and suggest good questions to ask.',
    notes: '## Concepts explained\nEach key concept with a simple explanation and example.\n\n## Study questions\n5 questions to test understanding, with answers.',
  },
  support: {
    label: 'Customer support',
    emoji: '🛟',
    guide: 'Diagnose the customer\'s issue, propose clear troubleshooting steps, show empathy, and confirm resolution.',
    notes: '## Issue & resolution\nProblem, root cause (if found), steps taken, status.\n\n## Customer sentiment',
  },
};

export interface CopilotAction {
  id: string;
  label: string;
  hint: string;
  key: string;
  prompt: string;
}

export const ACTIONS: CopilotAction[] = [
  {
    id: 'reply',
    label: 'What do I say?',
    hint: 'A ready-to-speak line for right now',
    key: '1',
    prompt:
      'Tell me what to say next, right now. Format exactly:\n**Say:** "<1–2 natural sentences I can speak out loud>"\n- <supporting point>\n- <supporting point (optional)>',
  },
  {
    id: 'answer',
    label: 'Answer it',
    hint: 'Best answer to the last question asked',
    key: '2',
    prompt:
      'Find the most recent question directed at me and give me the best answer to speak. Format:\n**Q:** <the question, ≤10 words>\n**Say:** "<answer, 2–3 sentences, first person>"\n- <key fact or example to mention>',
  },
  {
    id: 'explain',
    label: 'Explain',
    hint: 'Define jargon, names, concepts just mentioned',
    key: '3',
    prompt:
      'Explain the terms, acronyms, names, numbers or concepts mentioned in the last few minutes that I might not know. Max 4 items: **Term** — one-line plain explanation.',
  },
  {
    id: 'factcheck',
    label: 'Fact-check',
    hint: 'Flag doubtful claims',
    key: '4',
    prompt:
      'Fact-check the claims made in the last few minutes using your knowledge. List only doubtful ones: ⚠️ **Claim** — correction (one line). If nothing is doubtful, reply exactly: ✅ Nothing to flag.',
  },
  {
    id: 'question',
    label: 'Smart question',
    hint: 'Questions that move toward your goal',
    key: '5',
    prompt: 'Give me 2 sharp, specific questions I could ask right now to move toward my goal. One line each, ready to speak.',
  },
  {
    id: 'recap',
    label: 'Recap',
    hint: 'Catch up on what happened so far',
    key: '6',
    prompt: 'Recap the meeting so far: 3 short bullets, then any action items or decisions so far.',
  },
  {
    id: 'coach',
    label: 'Coach me',
    hint: 'How am I doing vs. my goal?',
    key: '7',
    prompt:
      'Coach me in 2–3 bullets: how am I doing against my goal (tone, clarity, talk ratio, missed opportunities), and the single most important thing to do next.',
  },
];

export function fmtTime(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function transcriptText(segments: Segment[], maxChars = Infinity): string {
  const lines = segments.map((s) => `[${fmtTime(s.t)}] ${s.speaker}: ${s.text}`);
  let out = '';
  // Keep the most recent lines when truncating — that's what matters live.
  for (let i = lines.length - 1; i >= 0; i--) {
    if (out.length + lines[i].length + 1 > maxChars) {
      out = '…(earlier transcript omitted)\n' + out;
      break;
    }
    out = lines[i] + '\n' + out;
  }
  return out.trim();
}

function contextBlock(m: Pick<Meeting, 'type' | 'goal' | 'context' | 'title'>, userName: string) {
  const t = MEETING_TYPES[m.type];
  return [
    `Meeting: ${m.title || 'Untitled'} — type: ${t.label}.`,
    `The user ("${userName}", labelled "You" in the transcript) is the person you help.`,
    m.goal ? `User's goal: ${m.goal}` : '',
    m.context ? `User's background / reference material:\n"""\n${m.context.slice(0, 20000)}\n"""` : '',
    `Domain guidance: ${t.guide}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function copilotSystem(m: Pick<Meeting, 'type' | 'goal' | 'context' | 'title'>, userName: string) {
  return `You are Meeter, a real-time meeting copilot quietly helping the user during a LIVE conversation.
${contextBlock(m, userName)}

Rules:
- The user reads you at a glance WHILE talking. Be ultra-concise: no preamble, no restating the question, max ~60 words unless asked.
- Lines to speak must sound natural and human, in first person, in the language of the conversation.
- Never invent facts about the user, their company or their experience. If the background doesn't cover it, give an honest, graceful line instead.
- Transcripts are auto-generated and may contain errors; infer intent sensibly.
- Use **bold** for the single most important words.`;
}

export function copilotUser(segments: Segment[], instruction: string, maxChars = 9000) {
  const t = transcriptText(segments, maxChars);
  return `Live transcript (most recent at the bottom):\n${t || '(nothing said yet)'}\n\n---\n${instruction}`;
}

export function notesSystem(m: Meeting, userName: string) {
  const t = MEETING_TYPES[m.type];
  return `You are an expert meeting note-taker producing notes better than Otter, Fireflies and Granola.
${contextBlock(m, userName)}

Write clean GitHub-flavored Markdown. First line must be exactly: TITLE: <specific title, max 8 words>
Then these sections (omit a section only if truly empty):
## TL;DR
2–3 sentences.
## Key points
Grouped bullets by topic, with [mm:ss] timestamps where useful.
## Decisions
## Action items
- [ ] **Owner** — task — due date (if mentioned)
${t.notes ? t.notes + '\n' : ''}## Open questions
## Follow-up email
A short, ready-to-send follow-up email from the user.

Be specific (names, numbers, dates). Don't pad. Transcripts are auto-generated; fix obvious mis-hearings.`;
}

export function chatSystem(m: Meeting, userName: string) {
  return `You answer questions about one meeting for the user, using the transcript and notes below. Cite timestamps like [12:34] when helpful. If the answer isn't in the meeting, say so, then answer from general knowledge if useful (clearly labelled).
${contextBlock(m, userName)}

Transcript:
${transcriptText(m.segments, 150000)}
${m.notes ? `\nNotes:\n${m.notes}` : ''}`;
}

export function libraryChatSystem(meetings: Meeting[]) {
  const blocks = meetings
    .map((m) => {
      const date = new Date(m.createdAt).toLocaleString();
      const body = m.notes ? m.notes : transcriptText(m.segments, 12000);
      return `### Meeting "${m.title}" (${date}, ${MEETING_TYPES[m.type].label}, id ${m.id})\n${body}`;
    })
    .join('\n\n');
  return `You are the user's meeting memory. Answer using ONLY the meetings below. Mention which meeting (title + date) each fact came from. If the answer isn't there, say so.

${blocks}`;
}

/** Cheap keyword relevance for picking which meetings to send as context. */
export function rankMeetings(meetings: Meeting[], query: string, limit = 6): Meeting[] {
  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2);
  if (!terms.length) return meetings.slice(0, limit);
  const scored = meetings.map((m) => {
    const hay = (m.title + ' ' + (m.notes ?? '') + ' ' + m.segments.map((s) => s.text).join(' ')).toLowerCase();
    let score = 0;
    for (const t of terms) score += hay.split(t).length - 1;
    return { m, score };
  });
  const hits = scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  return (hits.length ? hits.map((x) => x.m) : meetings).slice(0, limit);
}

export function splitTitle(notes: string): { title: string | null; body: string } {
  const m = notes.match(/^\s*TITLE:\s*(.+)\n?/);
  if (!m) return { title: null, body: notes };
  return { title: m[1].trim().replace(/^["#*\s]+|["*\s]+$/g, ''), body: notes.slice(m[0].length).trim() };
}

export function meetingToMarkdown(m: Meeting) {
  return [
    `# ${m.title}`,
    `_${new Date(m.createdAt).toLocaleString()} · ${fmtTime(m.durationMs)} · ${MEETING_TYPES[m.type].label}_`,
    '',
    m.notes ?? '_No notes generated._',
    '',
    '---',
    '## Transcript',
    ...m.segments.map((s) => `**[${fmtTime(s.t)}] ${s.speaker}:** ${s.text}`),
  ].join('\n');
}
