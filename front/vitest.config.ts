import { mergeConfig } from 'vite';
import { defineConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Les parcours dans un vrai navigateur (Playwright) se lancent à part : npm run e2e.
    exclude: ['e2e/**', 'node_modules/**'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
}));
