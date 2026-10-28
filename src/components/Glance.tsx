// Always-on-top floating window (Document Picture-in-Picture in Chrome/Edge, popup elsewhere).
// Park it right under your webcam so you can read suggestions without looking away.
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

declare global {
  interface Window {
    documentPictureInPicture?: { requestWindow(o: { width: number; height: number }): Promise<Window> };
  }
}

function copyStyles(target: Window) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const style = target.document.createElement('style');
      style.textContent = Array.from(sheet.cssRules)
        .map((r) => r.cssText)
        .join('\n');
      target.document.head.appendChild(style);
    } catch {
      if (sheet.href) {
        const link = target.document.createElement('link');
        link.rel = 'stylesheet';
        link.href = sheet.href;
        target.document.head.appendChild(link);
      }
    }
  }
  target.document.documentElement.dataset.theme = document.documentElement.dataset.theme ?? '';
}

export async function openGlanceWindow(): Promise<Window> {
  let w: Window | null = null;
  if (window.documentPictureInPicture) {
    w = await window.documentPictureInPicture.requestWindow({ width: 440, height: 300 });
  } else {
    w = window.open('', 'meeter-glance', 'width=440,height=320,popup=yes');
    if (!w) throw new Error('Popup blocked — allow popups for this site to use the floating window.');
    w.document.body.innerHTML = '';
  }
  w.document.title = 'Meeter · Glance';
  copyStyles(w);
  w.document.body.className = 'glance-body';
  return w;
}

export function GlancePortal({ win, children, onClose }: { win: Window; children: ReactNode; onClose: () => void }) {
  const [el] = useState(() => win.document.createElement('div'));
  useEffect(() => {
    win.document.body.appendChild(el);
    const close = () => onClose();
    win.addEventListener('pagehide', close);
    win.addEventListener('beforeunload', close);
    return () => {
      win.removeEventListener('pagehide', close);
      win.removeEventListener('beforeunload', close);
      el.remove();
    };
  }, [win, el, onClose]);
  return createPortal(children, el);
}
