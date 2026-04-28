import { test, expect } from '@playwright/test';
import { ensureUserExists, loginAs, resetDb } from './_helpers';

// Use a per-spec user so other tests' data doesn't accidentally interfere.
test.beforeAll(async () => {
  await ensureUserExists('e2e-cascade', 'pwTest123*');
});

test('cascade pages render without error', async ({ page }) => {
  await resetDb(page);
  await loginAs(page, 'e2e-cascade', 'pwTest123*');
  await page.waitForURL(/\/week\/(.+)/, { timeout: 60000 });
  await expect(page.getByText('로딩 중…')).toHaveCount(0, { timeout: 60000 });

  // Annual page
  await page.goto('/annual/2026');
  await expect(page.getByText('로딩 중…')).toHaveCount(0, { timeout: 60000 });
  await expect(page.getByRole('heading', { name: /2026 연간 계획/ })).toBeVisible();

  // Monthly page (calendar)
  await page.goto('/monthly/2026-04');
  await expect(page.getByText('로딩 중…')).toHaveCount(0, { timeout: 60000 });
  await expect(page.getByText('이번 달 한 문장')).toBeVisible();

  // Weekly retro with TODO completion card
  await page.goto('/retrospective/week/2026-W16');
  await expect(page.getByText('로딩 중…')).toHaveCount(0, { timeout: 60000 });
  await expect(page.getByText('TODO 완료율')).toBeVisible();
});
