import { Page, expect } from '@playwright/test';
import { execSync } from 'node:child_process';

export const resetDb = async (page: Page) => {
  // Runs before the app bundle loads on each navigation.
  // Use a sessionStorage flag so we only wipe BinderDb once per test session
  // (the first navigation), not on page.reload() which would discard saved state.
  await page.addInitScript(() => {
    try {
      if (!sessionStorage.getItem('__e2e_db_reset__')) {
        indexedDB.deleteDatabase('BinderDb');
        sessionStorage.setItem('__e2e_db_reset__', '1');
      }
    } catch {
      indexedDB.deleteDatabase('BinderDb');
    }
  });
};

/**
 * Forces the dev server to open the DB and apply migrations. POSTing to
 * /api/auth/login (a PUBLIC_PATH) with bogus creds calls verifyCredentials()
 * which calls getDb() — running `migrate()` + `ensureAdminUser()`. Without
 * this, scripts/users.mjs would race the dev server and see "no such table:
 * users" because it opens the DB before migrations have ever been applied.
 *
 * We retry until we get a definitive "wrong creds" response (401) — that
 * proves migrations ran AND the admin user is seeded so the DB is ready.
 */
const ensureMigrationsApplied = async () => {
  const baseURL = 'http://localhost:3100';
  const start = Date.now();
  while (Date.now() - start < 90_000) {
    try {
      const res = await fetch(`${baseURL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: '__nonexistent__', password: 'x' }),
      });
      // 401 = verifyCredentials ran (DB is up, migrations done, admin row not us).
      // 400 = bad input (still touched the route handler but not DB — keep waiting).
      // 500 = SESSION_SECRET missing (config error) — fail loudly.
      if (res.status === 401) return;
      if (res.status === 500) {
        const body = await res.text();
        throw new Error(`dev server 500 on /api/auth/login: ${body}`);
      }
    } catch (e) {
      // network error → server still booting
      const msg = (e as Error).message ?? '';
      if (msg.startsWith('dev server 500')) throw e;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('e2e dev server never accepted /api/auth/login within 90s');
};

/**
 * Idempotent user-create against the same DB the e2e webServer is running on.
 * scripts/users.mjs (Task 8) returns exit code 2 if the user already exists,
 * which we swallow so test runs can be re-run without manual cleanup.
 *
 * The DB_PATH MUST match playwright.config.ts webServer.env.DB_PATH so the
 * CLI writes to the same SQLite file the dev server reads from.
 *
 * IMPORTANT: caller must `await ensureMigrationsReady()` once before the
 * first call so the schema exists. We bake that into this helper for safety.
 */
let _migrationsReady: Promise<void> | null = null;
export const ensureUserExists = async (username: string, password: string) => {
  if (!_migrationsReady) _migrationsReady = ensureMigrationsApplied();
  await _migrationsReady;

  try {
    execSync(
      `node scripts/users.mjs add ${username} ${password}`,
      {
        env: { ...process.env, DB_PATH: './tmp-test/e2e.sqlite' },
        stdio: 'pipe',
      }
    );
  } catch (e) {
    const err = e as { status?: number };
    if (err.status !== 2) throw e;
  }
};

/**
 * Logs in via the /login page form. The login form (app/login/page.tsx) uses
 * autocomplete=username/current-password rather than name= attributes, so we
 * select on autocomplete.
 */
export const loginAs = async (page: Page, username: string, password: string) => {
  await page.goto('/login');
  await page.fill('input[autocomplete="username"]', username);
  await page.fill('input[autocomplete="current-password"]', password);
  await page.click('button[type=submit]');
  await expect(page).not.toHaveURL(/\/login/);
};
