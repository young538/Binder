import { expect, test } from '@playwright/test';
import { ensureUserExists, loginAs } from './_helpers';

for (const width of [1280, 390]) {
  test(`daily plans and actuals share editable weekly records (${width}px)`, async ({ page }) => {
    test.setTimeout(90000);
    const username = `e2e-daily-time-${width}`;
    await ensureUserExists(username, 'pwTest123*');
    await page.setViewportSize({ width, height: 900 });
    await loginAs(page, username, 'pwTest123*');
    const range = '/api/time-blocks?startDate=2026-09-07&endDate=2026-09-08';
    for (const block of await (await page.request.get(range)).json()) {
      expect((await page.request.delete(`/api/time-blocks/${block.id}`)).ok()).toBeTruthy();
    }
    const categories = await (await page.request.get('/api/categories')).json();
    const goalResponse = await page.request.post('/api/goals', { data: { title: '일일 업무 목표', level: 'oneThing', order: 0 } });
    expect(goalResponse.ok()).toBeTruthy();
    const goal = await goalResponse.json();
    const todoResponse = await page.request.post('/api/todos', { data: { title: '연결된 업무', scope: 'day', scopeKey: '2026-09-07', status: 'pending', order: 0 } });
    expect(todoResponse.ok()).toBeTruthy();
    const todo = await todoResponse.json();
    const seeded = await page.request.post('/api/time-blocks', { data: { date: '2026-09-07', startMin: 480, endMin: 540, kind: 'plan', text: '기존 계획', categoryId: categories[0].id, goalId: goal.id, todoId: todo.id } });
    expect(seeded.ok()).toBeTruthy();
    const planId = (await seeded.json()).id;

    await page.goto('/daily/2026-09-07');
    await page.getByRole('button', { name: '목록', exact: true }).click();
    const plans = page.getByRole('region', { name: '하루 계획', exact: true });
    const actuals = page.getByRole('region', { name: '실제 진행', exact: true });
    await plans.getByRole('button', { name: '기존 계획 편집', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('내용').fill('수정한 계획');
    await dialog.locator('input[type=time]').nth(0).fill('09:00');
    await dialog.locator('input[type=time]').nth(1).fill('10:00');
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await expect(plans.getByRole('button', { name: '수정한 계획 편집', exact: true })).toBeVisible();
    const updatedPlan = (await (await page.request.get(range)).json()).find((block: { id: string }) => block.id === planId);
    expect(updatedPlan).toMatchObject({ startMin: 540, endMin: 600, goalId: goal.id, todoId: todo.id });

    await page.getByRole('button', { name: '계획 추가', exact: true }).click();
    await dialog.getByPlaceholder('내용').fill('새 계획');
    await dialog.locator('input[type=time]').nth(0).fill('11:00');
    await dialog.locator('input[type=time]').nth(1).fill('12:00');
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await expect(plans.getByRole('button', { name: '새 계획 편집', exact: true })).toBeVisible();

    await page.getByRole('button', { name: '실제 기록 추가', exact: true }).click();
    await expect(dialog.getByRole('button', { name: '실제', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await dialog.getByPlaceholder('내용').fill('실제로 진행한 업무');
    await dialog.locator('input[type=time]').nth(0).fill('23:00');
    await dialog.locator('input[type=time]').nth(1).fill('00:00');
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await expect(actuals.getByRole('button', { name: '실제로 진행한 업무 편집', exact: true })).toBeVisible();
    const actual = (await (await page.request.get(range)).json()).find((block: { text: string }) => block.text === '실제로 진행한 업무');
    expect(actual).toMatchObject({ kind: 'actual', startMin: 1380, endMin: 1440 });
    await page.screenshot({ path: `test-results/daily-time-${width}.png` });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/week/2026-W37');
    const weekPlan = page.locator(`[data-block-id="${planId}"][data-block]`);
    await weekPlan.click();
    await page.getByTestId('week-selection-edit').click();
    await dialog.getByPlaceholder('내용').fill('주간에서 수정한 계획');
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/daily/2026-09-08');
    await expect(page.getByRole('heading', { name: '하루 계획과 실제', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '주간에서 수정한 계획 편집', exact: true })).toHaveCount(0);
    await page.goto('/daily/2026-09-07');
    await page.getByRole('button', { name: '목록', exact: true }).click();
    await expect(plans.getByRole('button', { name: '주간에서 수정한 계획 편집', exact: true })).toBeVisible();
    await actuals.getByRole('button', { name: '실제로 진행한 업무 편집', exact: true }).click();
    await expect(dialog.locator('input[type=time]').nth(1)).toHaveValue('00:00');
    page.once('dialog', prompt => prompt.accept());
    await dialog.getByRole('button', { name: '삭제', exact: true }).click();
    await expect(actuals.getByRole('button', { name: '실제로 진행한 업무 편집', exact: true })).toHaveCount(0);
    expect((await (await page.request.get(range)).json()).some((block: { id: string }) => block.id === actual.id)).toBe(false);
  });
}
