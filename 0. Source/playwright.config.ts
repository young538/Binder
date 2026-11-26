import { defineConfig } from '@playwright/test';

import { randomUUID } from 'node:crypto';
import path from 'node:path';

const runId = process.env.BINDER_E2E_RUN_ID ??= randomUUID();
if (!/^[a-f0-9-]{36}$/i.test(runId)) throw new Error('Invalid E2E run ID');
const database = path.resolve('test-results', runId, 'e2e.sqlite');
process.env.BINDER_E2E_DATABASE = database;

export default defineConfig({
  workers: 2,
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run build && node scripts/start-e2e.mjs',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
    timeout: 180000,
    env: {
      // Keep the standalone test server on loopback, apart from production.
      HOSTNAME: '127.0.0.1',
      PORT: '3100',
      // Isolated DB so tests can't pollute production data.
      DB_PATH: database,
      // Default admin used by ensureAdminUser() in lib/server/db/client.ts.
      // Hash is for "admin-test-password" — not a real secret, e2e only.
      APP_USERNAME: 'admin',
      APP_PASSWORD_HASH:
        '$argon2id$v=19$m=19456,t=2,p=1$ELJM/O1oWAJSXPLxq1u5Iw$tY7ll9XvXaPDF4NFzgfRdGN8SCXMlDd2Z2Uc/g2h/5A',
      // 64 chars (≥32 byte) iron-session secret — fixed for reproducibility.
      SESSION_SECRET:
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
