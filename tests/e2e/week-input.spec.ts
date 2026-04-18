import { test, expect } from '@playwright/test';
import { resetDb } from './_helpers';

test('create, edit, delete time block', async ({ page }) => {
  await resetDb(page);
  await page.goto('/');
  await page.waitForURL(/\/week\//);

  // Wait for store to be ready (loading screen to disappear)
  await expect(page.getByText('로딩 중…')).toHaveCount(0, { timeout: 10000 });

  // First empty cell in the grid (button with empty text, inside the main grid)
  const firstCell = page
    .locator('main button')
    .filter({ hasNotText: /\d+\/\d+|이전주|다음주|📝|📅|🎯|⚙️|설정|주간|목표|회고|만다라트/ })
    .first();
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
