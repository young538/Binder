import { test, expect } from '@playwright/test';
import { ensureUserExists, loginAs } from './_helpers';

test('backup import refreshes categories and settings without reloading the page', async ({ page }) => {
  await ensureUserExists('e2e-import-refresh', 'pwTest123*');
  await loginAs(page, 'e2e-import-refresh', 'pwTest123*');
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: '데이터 가져오기', exact: true })).toBeVisible();
  const category = `가져온 분류 ${Date.now()}`;
  const current = await (await page.request.get('/api/settings')).json();
  const gridMinutes = current.gridMinutes === 30 ? 60 : 30;
  await page.locator('input[type=file]').setInputFiles({
    name: 'test-backup.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      categories: [{ id: `import-${Date.now()}`, name: category, color: '#123456', order: 100 }],
      settings: { ...current, gridMinutes },
    })),
  });
  await page.getByRole('button', { name: '병합 실행', exact: true }).click();
  await expect(page.getByText('가져오기 완료 (merge)', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox').filter({ visible: true }).last()).toHaveValue(category);
  await expect(page.getByRole('combobox', { name: /그리드 단위/ })).toHaveValue(String(gridMinutes));
});
