// Content script on chatgpt.com, claude.ai and gemini.google.com.
// If the user just clicked "Continue in …" in Meeter, type the meeting into the message box.
// It never submits and never reads the page's conversation. Must stay import-free (classic script).

const KEY = 'meeter.handoff';
const MAX_AGE_MS = 2 * 60 * 1000;

const SELECTORS = [
  '#prompt-textarea', // ChatGPT
  'div.ProseMirror[contenteditable="true"]', // Claude
  'rich-textarea div[contenteditable="true"]', // Gemini
  'div[contenteditable="true"][role="textbox"]',
  'textarea',
];

function findBox(): HTMLElement | null {
  for (const sel of SELECTORS) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el && el.offsetParent !== null) return el;
  }
  return null;
}

function insert(box: HTMLElement, text: string) {
  box.focus();
  if (box instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(box, text);
    box.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  // Rich editors (ProseMirror / Quill) react to a synthetic paste far better than to innerText.
  const dt = new DataTransfer();
  dt.setData('text/plain', text);
  const pasted = box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  if (pasted && !box.textContent?.trim()) document.execCommand('insertText', false, text);
}

function banner(msg: string) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText =
    'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#7c5cff;color:#fff;' +
    'padding:10px 16px;border-radius:10px;font:600 14px system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.3)';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

chrome.storage.local.get(KEY).then((res) => {
  const job = res[KEY] as { text: string; at: number } | undefined;
  if (!job || Date.now() - job.at > MAX_AGE_MS) return;
  chrome.storage.local.remove(KEY);
  let tries = 0;
  const timer = setInterval(() => {
    const box = findBox();
    if (box) {
      clearInterval(timer);
      insert(box, job.text);
      banner('◉ Meeter added your meeting. Review it, then press Enter.');
    } else if (++tries > 60) {
      clearInterval(timer);
      banner('◉ Meeter copied your meeting. Paste it here with Ctrl/⌘+V. (Sign in first if needed.)');
    }
  }, 500);
});
