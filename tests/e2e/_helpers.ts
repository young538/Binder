import { Page } from '@playwright/test';

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
