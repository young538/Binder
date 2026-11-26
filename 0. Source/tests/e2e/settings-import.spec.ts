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

for (const width of [390, 1280]) {
  test(`category deletion moves required links and persists on reload at ${width}px`, async ({ page }) => {
    const username = `e2e-move-category-${width}`;
    await ensureUserExists(username, 'pwTest123*');
    await page.setViewportSize({ width, height: 900 });
    await loginAs(page, username, 'pwTest123*');
    const categories = await (await page.request.get('/api/categories')).json();
    const [source, target] = categories;
    const block = await page.request.post('/api/time-blocks', { data: {
      date: '2026-11-26', startMin: 600, endMin: 630, text: '분류 이동', kind: 'plan', categoryId: source.id,
    } });
    expect(block.ok()).toBeTruthy();
    await page.goto('/settings');
    await page.locator('li').filter({ has: page.locator(`input[value="${source.name}"]`) })
      .getByRole('button', { name: '삭제', exact: true }).click();
    await page.getByRole('button', { name: '삭제 확인' }).click();
    await expect(page.getByRole('alert').filter({ hasText: '옮길 카테고리' })).toBeVisible();
    await page.getByLabel('연결된 기록을 옮길 카테고리').selectOption(target.id);
    await page.getByRole('button', { name: '삭제 확인' }).click();
    await expect(page.getByRole('button', { name: '삭제 확인' })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: '카테고리', exact: true })).toBeVisible();
    await expect(page.locator(`input[value="${source.name}"]`)).toHaveCount(0);
    const saved = await (await page.request.get('/api/export')).json();
    expect(saved.timeBlocks[0].categoryId).toBe(target.id);
  });
}
