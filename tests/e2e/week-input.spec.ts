import { test, expect } from '@playwright/test';
import { resetDb } from './_helpers';

test('create, edit, delete time block', async ({ page }) => {
  await resetDb(page);
  await page.goto('/');
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
