import { test, expect } from '@playwright/test';
import { ensureUserExists, loginAs, resetDb } from './_helpers';

// Use a per-spec user so saved retro text from earlier tests doesn't leak in.
test.beforeAll(async () => {
  await ensureUserExists('e2e-daily-retro', 'pwTest123*');
});

test('daily retro save and persist', async ({ page }) => {
  await resetDb(page);
  await loginAs(page, 'e2e-daily-retro', 'pwTest123*');
  await page.waitForURL(/\/week\//);
  await expect(page.getByText('로딩 중…')).toHaveCount(0, { timeout: 60000 });

  // Click the first day header button (buttons with 📝 icon and day text)
  const dayHeader = page.locator('button').filter({ hasText: '📝' }).first();
  await dayHeader.click();

  // First textarea = "좋았던 것"
  const goodTextarea = page.locator('textarea').first();
  await goodTextarea.fill('좋았던 것 E2E');

  // Wait for 1s debounce + some slack (extra under load when other specs ran first)
  await page.waitForTimeout(2500);

  // Reload & reopen
  await page.reload();
  await expect(page.getByText('로딩 중…')).toHaveCount(0, { timeout: 60000 });
  await page.locator('button').filter({ hasText: '📝' }).first().click();
  await expect(page.locator('textarea').first()).toHaveValue('좋았던 것 E2E');
});
