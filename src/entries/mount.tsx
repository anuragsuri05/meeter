import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { StoreProvider } from '../lib/store';
import '../styles.css';

// No StrictMode: its double-mounted effects would stop the live capture streams in dev.
export function mount(node: ReactNode, bodyClass = '') {
  if (bodyClass) document.body.classList.add(bodyClass);
  createRoot(document.getElementById('root')!).render(<StoreProvider>{node}</StoreProvider>);
}
