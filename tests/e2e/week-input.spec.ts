import { test, expect } from '@playwright/test';
import { ensureUserExists, loginAs, resetDb } from './_helpers';

// Each spec uses its own user so test data on the server-side SQLite DB
// does not leak between tests in the same suite (each user's todos and
// time blocks are scoped to that user_id).
test.beforeAll(async () => {
  await ensureUserExists('e2e-week-input', 'pwTest123*');
});

test('create, edit, delete time block', async ({ page }) => {
  await resetDb(page);
  await loginAs(page, 'e2e-week-input', 'pwTest123*');
  await page.waitForURL(/\/week\//);

  // Wait for store to be ready (loading screen to disappear)
  await expect(page.getByText('로딩 중…')).toHaveCount(0, { timeout: 60000 });

  // First empty time slot in the grid
  const firstCell = page.locator('[data-testid="time-slot"]').first();
  await firstCell.click();

  const textInput = page.getByPlaceholder('내용');
  await textInput.fill('E2E 블록');
  await page.getByRole('button', { name: '저장' }).click();

  await expect(page.getByText('E2E 블록').first()).toBeVisible();

  // Edit
  await page.getByText('E2E 블록').first().click();
  await textInput.fill('수정됨');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('수정됨').first()).toBeVisible();

  // Delete (confirm dialog auto-accept)
  page.on('dialog', (d) => d.accept());
  await page.getByText('수정됨').first().click();
  await page.getByRole('button', { name: '삭제' }).click();
  await expect(page.getByText('수정됨')).toHaveCount(0);
});
