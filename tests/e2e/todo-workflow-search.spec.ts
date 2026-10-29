import { test, expect } from '@playwright/test';
import { ensureUserExists, loginAs } from './_helpers';

for (const width of [1280, 390]) {
  test(`TODO undo, rollover and global search at ${width}px`, async ({ page }) => {
    test.setTimeout(90000);
    const username = `e2e-workflow-${width}`;
    await ensureUserExists(username, 'pwTest123*');
    await loginAs(page, username, 'pwTest123*');
    await page.setViewportSize({ width, height: 900 });
    const title = `실행 취소 이월 검색 ${Date.now()}`;
    const date = '2027-12-31';
    const requestKey = crypto.randomUUID();
    const payload = { title, scope: 'day', scopeKey: date, status: 'pending', order: 0 };
    const responses = await Promise.all([1, 2].map(() => page.request.post('/api/todos', { data: payload, headers: { 'Idempotency-Key': requestKey } })));
    for (const response of responses) expect(response.status()).toBe(201);
    const created = await responses[0].json();
    expect((await responses[1].json()).id).toBe(created.id);
    await page.goto(`/daily/${date}`);
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: `${title} 삭제`, exact: true }).click();
    await expect(page.getByRole('button', { name: '실행 취소', exact: true })).toBeVisible();
    const restored = page.waitForResponse(response => response.url().endsWith(`/api/todos/${created.id}/restore`) && response.request().method() === 'POST');
    await page.getByRole('button', { name: '실행 취소', exact: true }).click();
    expect((await restored).status()).toBe(200);
    await expect(page.getByRole('button', { name: '실행 취소', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: `${title} 삭제`, exact: true })).toBeVisible();
    const rolled = page.waitForResponse(response => response.url().endsWith('/api/todos/rollover') && response.request().method() === 'POST');
    await page.getByRole('button', { name: /미완료 .*개 다음 날로/ }).click();
    expect((await rolled).status()).toBe(200);
    await expect(page.getByRole('button', { name: `${title} 삭제`, exact: true })).toHaveCount(0);
    const after = await page.request.get('/api/todos?scope=day&scopeKey=2028-01-01');
    expect((await after.json()).filter((row: { id: string }) => row.id === created.id)).toHaveLength(1);
    if (width < 1024) await page.getByRole('button', { name: '더보기', exact: true }).click();
    await page.getByRole('link', { name: '전체 검색', exact: true }).click();
    await page.getByRole('textbox', { name: '검색어', exact: true }).fill(title);
    await page.getByRole('button', { name: '검색', exact: true }).click();
    const result = page.getByRole('link', { name: title, exact: true });
    await expect(result).toHaveAttribute('href', '/daily/2028-01-01');
    await page.screenshot({ path: `tmp-test/search-${width}.png`, fullPage: true });
    await result.click();
    await expect(page).toHaveURL(/\/daily\/2028-01-01$/);
    await expect(page.getByRole('button', { name: `${title} 삭제`, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('search and TODO mutations reject anonymous requests', async ({ request }) => {
  expect((await request.get('/api/search?q=test')).status()).toBe(401);
  expect((await request.post('/api/todos/rollover', { data: { date: '2026-10-29', ids: ['unknown'] } })).status()).toBe(401);
  expect((await request.post('/api/todos/unknown/restore')).status()).toBe(401);
});
