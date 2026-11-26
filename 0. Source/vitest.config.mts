import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    maxWorkers: 4,
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    passWithNoTests: true,
    testTimeout: 15000,
    hookTimeout: 15000,
    exclude: ['node_modules', '.next', '.codex-spreadsheet-audit', 'tests/e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      'server-only': path.resolve(import.meta.dirname, 'tests/stubs/server-only.ts'),
    },
  },
});
