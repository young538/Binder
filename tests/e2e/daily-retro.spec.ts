import { test, expect } from '@playwright/test';
import { resetDb } from './_helpers';

test('daily retro save and persist', async ({ page }) => {
  await resetDb(page);
  await page.goto('/');
  await page.waitForURL(/\/week\//);
  await expect(page.getByText('로딩 중…')).toHaveCount(0, { timeout: 60000 });

  // Click the first day header button (buttons with 📝 icon and day text)
  const dayHeader = page.locator('button').filter({ hasText: '📝' }).first();
  await dayHeader.click();

  // First textarea = "좋았던 것"
  const goodTextarea = page.locator('textarea').first();
  await goodTextarea.fill('좋았던 것 E2E');

  // Wait for 1s debounce + some slack
  await page.waitForTimeout(1500);

  // Reload & reopen
  await page.reload();
  await expect(page.getByText('로딩 중…')).toHaveCount(0, { timeout: 60000 });
  await page.locator('button').filter({ hasText: '📝' }).first().click();
  await expect(page.locator('textarea').first()).toHaveValue('좋았던 것 E2E');
});
