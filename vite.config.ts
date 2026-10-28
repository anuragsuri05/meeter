import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// One build = the Chrome extension (dist/ is loadable unpacked) and a static web version (app.html).
// base './' keeps every asset path relative so it works from chrome-extension:// and any static host.
const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        app: resolve(root, 'app.html'),
        sidepanel: resolve(root, 'sidepanel.html'),
        onboarding: resolve(root, 'onboarding.html'),
        index: resolve(root, 'index.html'),
        background: resolve(root, 'src/extension/background.ts'),
        'handoff-content': resolve(root, 'src/extension/handoff-content.ts'),
      },
      output: {
        // The manifest references these two by fixed name.
        entryFileNames: (c) => (c.name === 'background' || c.name === 'handoff-content' ? '[name].js' : 'assets/[name]-[hash].js'),
      },
    },
  },
});
