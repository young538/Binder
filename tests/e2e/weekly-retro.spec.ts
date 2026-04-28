import { test, expect } from '@playwright/test';
import { ensureUserExists, loginAs, resetDb } from './_helpers';

// Use a per-spec user so other tests' data doesn't accidentally interfere.
test.beforeAll(async () => {
  await ensureUserExists('e2e-weekly-retro', 'pwTest123*');
});

test('weekly summary aggregates time blocks', async ({ page }) => {
  await resetDb(page);
  await loginAs(page, 'e2e-weekly-retro', 'pwTest123*');
  await page.waitForURL(/\/week\/(.+)/);
  await expect(page.getByText('로딩 중…')).toHaveCount(0, { timeout: 60000 });
  const url = page.url();
  const match = url.match(/\/week\/(\d{4}-W\d{2})/);
  expect(match).not.toBeNull();
  const isoweek = match![1];

  // Create a block (similar to week-input)
  const firstCell = page.locator('[data-testid="time-slot"]').first();
  await firstCell.click();
  await page.getByPlaceholder('내용').fill('주간합산');
  await page.getByRole('button', { name: '저장' }).click();

  // Go to weekly retro
  await page.goto(`/retrospective/week/${isoweek}`);
  await expect(page.getByText('로딩 중…')).toHaveCount(0, { timeout: 60000 });
  await expect(page.getByText('총 기록 시간')).toBeVisible();
  // Should show at least "0.5h" or similar (30 min block)
  await expect(page.locator('text=/[0-9.]+h/').first()).toBeVisible();
});
