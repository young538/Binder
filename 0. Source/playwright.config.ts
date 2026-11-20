import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      // Production container occupies host:3000; route the test dev server to 3100.
      PORT: '3100',
      // Isolated DB so tests can't pollute production data.
      DB_PATH: './tmp-test/e2e.sqlite',
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
