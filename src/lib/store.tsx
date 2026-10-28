import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { loadSettings, saveSettings, SETTINGS_KEY } from './storage';
import type { Settings } from './types';

interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error';
}

interface Store {
  settings: Settings;
  update: (patch: Partial<Settings> | ((s: Settings) => Settings)) => void;
  toast: (text: string, kind?: Toast['kind']) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => saveSettings(settings), [settings]);

  // Keep the side panel, platform and onboarding tabs in sync (they share this origin's storage).
  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (e.key === SETTINGS_KEY) setSettings(loadSettings());
    };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, []);

  const update = useCallback<Store['update']>((patch) => {
    setSettings((s) => (typeof patch === 'function' ? patch(s) : { ...s, ...patch }));
  }, []);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.filter((x) => x.text !== text), { id, text, kind }].slice(-4));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3500);
  }, []);

  return (
    <Ctx.Provider value={{ settings, update, toast }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}

export function navigate(hash: string) {
  window.location.hash = hash;
}

export function useRoute(): string[] {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
