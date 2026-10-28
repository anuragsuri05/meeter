import { useEffect, useState } from 'react';
import { hasKey, PROVIDERS } from '../lib/ai';
import { builtinStatus } from '../lib/builtin';
import { ASSISTANTS, buildHandoffPrompt, handoff, HANDOFF_TASKS } from '../lib/handoff';
import { useStore } from '../lib/store';
import type { AssistantId, Meeting } from '../lib/types';

/** "Continue in ChatGPT / Claude / Gemini" using the user's own logged-in account. */
export function HandoffButtons({ m, compact = false }: { m: Meeting; compact?: boolean }) {
  const { settings, update, toast } = useStore();
  const [task, setTask] = useState<string>(HANDOFF_TASKS[0].id);
  const order = [settings.assistant, ...(['chatgpt', 'claude', 'gemini'] as AssistantId[]).filter((a) => a !== settings.assistant)];

  async function go(a: AssistantId) {
    if (!m.segments.length) {
      toast('This meeting has no transcript yet.', 'error');
      return;
    }
    const t = HANDOFF_TASKS.find((x) => x.id === task)!;
    const how = await handoff(a, buildHandoffPrompt(m, t.prompt));
    if (a !== settings.assistant) update({ assistant: a });
    toast(
      how === 'prefilled'
        ? `Opening ${ASSISTANTS[a].name}. Your meeting will be typed in; just press Enter.`
        : `Copied. Paste it into ${ASSISTANTS[a].name} with Ctrl/⌘+V.`,
    );
  }

  return (
    <div className={`handoff ${compact ? 'compact' : ''}`}>
      <div className="row wrap">
        <b className="small">Go deeper with your own account:</b>
        <select value={task} onChange={(e) => setTask(e.target.value)} aria-label="What to ask">
          {HANDOFF_TASKS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="row wrap">
        {order.map((a) => (
          <button key={a} className={`btn ${a === settings.assistant ? 'primary' : ''}`} onClick={() => go(a)}>
            {ASSISTANTS[a].icon} Continue in {ASSISTANTS[a].name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Live readiness of the selected AI brain. */
export function useAiStatus() {
  const { settings } = useStore();
  const [status, setStatus] = useState<{ ready: boolean; label: string }>({ ready: false, label: 'Checking AI…' });
  useEffect(() => {
    let alive = true;
    (async () => {
      if (settings.provider !== 'builtin') {
        const ok = hasKey(settings);
        if (alive) setStatus({ ready: ok, label: ok ? `${PROVIDERS[settings.provider].name}` : 'AI key missing' });
        return;
      }
      const s = await builtinStatus();
      if (!alive) return;
      setStatus(
        s === 'available'
          ? { ready: true, label: 'On-device AI ready' }
          : s === 'downloadable' || s === 'downloading'
            ? { ready: false, label: 'On-device AI not downloaded yet' }
            : { ready: false, label: 'On-device AI unavailable on this device' },
      );
    })();
    return () => {
      alive = false;
    };
  }, [settings]);
  return status;
}
