import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'lib/**/*.spec.ts',
      'lib/**/*.spec.tsx',
      'components/**/*.spec.tsx',
      'hooks/**/*.spec.tsx',
      'app/**/*.spec.tsx',
    ],
    css: false,
    restoreMocks: true,
  },
});
