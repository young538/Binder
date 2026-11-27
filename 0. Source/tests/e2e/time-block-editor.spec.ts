import { expect, test } from '@playwright/test';
import { ensureUserExists, loginAs } from './_helpers';

for (const width of [1280, 390]) {
  test(`preserves original times, linked TODOs and confirmed actuals at ${width}px`, async ({ page }) => {
    const user = `e2e-block-editor-${width}`;
    const date = '2026-09-07';
    await ensureUserExists(user, 'pwTest123*');
    await page.setViewportSize({ width, height: 900 });
    await loginAs(page, user, 'pwTest123*');
    const api = page.request;
    const post = async (path: string, data: object) => {
      const response = await api.post(path, { data });
      expect(response.status()).toBe(201);
      return response.json();
    };
    const [category] = await (await api.get('/api/categories')).json();
    const todo = await post('/api/todos', {
      title: '어제의 연결 TODO', scope: 'day', scopeKey: '2026-09-06', status: 'pending', order: 0,
    });
    const plan = { date, text: '기존 계획', kind: 'plan', startMin: 570, endMin: 630, categoryId: category.id, todoId: todo.id };
    const saved = await post('/api/time-blocks', { ...plan, date: '2026-09-06' });
    expect((await api.patch(`/api/time-blocks/${saved.id}`, { data: { date } })).ok()).toBe(true);
    const early = await post('/api/time-blocks', { ...plan, text: '이른 기록', startMin: 300, endMin: 360 });
    const clipped = await post('/api/time-blocks', { ...plan, text: '겹친 기록', startMin: 330, endMin: 390 });
    expect((await api.patch('/api/settings', { data: { dayStartHour: 6, dayEndHour: 23, gridMinutes: 60 } })).ok()).toBe(true);

    await page.goto(`/daily/${date}`);
    const column = page.locator(`[data-time-column][data-date="${date}"][data-kind="plan"]`);
    const block = column.locator(`[data-block-id="${saved.id}"]`);
    await expect(block).toBeVisible();
    await expect(column.locator(`[data-block-id="${early.id}"]`)).toHaveCount(0);
    const clippedBox = await column.locator(`[data-block-id="${clipped.id}"]`).boundingBox();
    expect(clippedBox!.y - (await column.boundingBox())!.y).toBe(1);
    expect(clippedBox!.height).toBe(14);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: '목록', exact: true }).click();
    const list = page.getByRole('region', { name: date + ' 계획과 실제' });
    await expect(list.getByRole('button', { name: '이른 기록 편집' })).toBeVisible();
    const open = () => list.getByRole('button', { name: '기존 계획 편집' }).click();
    const dialog = page.getByRole('dialog');
    const content = dialog.getByPlaceholder('내용');
    const selector = dialog.getByLabel('연결 TODO');
    await open();
    await expect(selector.locator('option:checked')).toHaveText(todo.title);
    await content.fill('취소할 수정');
    await dialog.getByRole('button', { name: '취소' }).press('Enter');
    await expect(dialog).toHaveCount(0);
    await open();
    await expect(content).toHaveValue('기존 계획');
    await content.fill('저장할 수정');
    // Simulate a second tab confirming this plan while the draft is open.
    const actual = await post('/api/time-blocks', { ...plan, kind: 'actual', sourcePlanId: saved.id });
    await dialog.getByRole('button', { name: '실제로 기록' }).click();
    await expect(dialog.getByRole('alert')).toContainText('이미 확정');
    await expect(content).toHaveValue('저장할 수정');
    await content.press('Enter');
    await expect(dialog).toHaveCount(0);

    await page.reload();
    await page.getByRole('button', { name: '목록', exact: true }).click();
    await list.getByRole('button', { name: '저장할 수정 편집' }).click();
    await expect(dialog.getByRole('button', { name: '이미 실제로 기록됨' })).toBeDisabled();
    await expect(selector.locator('option:checked')).toHaveText(todo.title);
    await expect(dialog.getByLabel('시작')).toHaveValue('09:30');
    await expect(dialog.getByLabel('종료 (00:00은 자정)')).toHaveValue('10:30');
    await selector.selectOption('');
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const rows = await (await api.get(`/api/time-blocks?startDate=${date}&endDate=${date}`)).json();
    expect(rows).toHaveLength(4);
    expect(rows).toContainEqual(expect.objectContaining({ id: actual.id, text: plan.text, todoId: todo.id, startMin: 570, endMin: 630 }));
    expect(rows).toContainEqual(expect.objectContaining({ id: saved.id, text: '저장할 수정', todoId: null, startMin: 570, endMin: 630 }));
  });
}
