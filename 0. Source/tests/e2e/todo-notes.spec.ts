import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { ensureUserExists, loginAs } from './_helpers';

const scenarios = [
  { view: 'daily', width: 1280, path: '/daily/2027-01-04' },
  { view: 'daily', width: 390, path: '/daily/2027-01-04' },
  { view: 'week', width: 1024, path: '/week/2027-W01' },
  { view: 'week', width: 390, path: '/week/2027-W01' },
  { view: 'month', width: 1280, path: '/monthly/2027-01' },
  { view: 'month', width: 390, path: '/monthly/2027-01' },
];

for (const scenario of scenarios) {
  test(`${scenario.view} ${scenario.width}px: readable titles and persistent expandable notes`, async ({ page }) => {
    test.setTimeout(90000);
    const username = `e2e-notes-${scenario.view}-${scenario.width}`;
    await ensureUserExists(username, 'pwTest123*');
    await page.setViewportSize({ width: scenario.width, height: 950 });
    await loginAs(page, username, 'pwTest123*');
    const title = `자료를 확인하고 다음 회의에서 이야기할 내용을 미리 정리하는 긴 할 일 ${Date.now()}`;
    const response = await page.request.post('/api/todos', { data: {
      title, scope: 'day', scopeKey: '2027-01-04', status: 'pending', order: 0,
    } });
    expect(response.status()).toBe(201);
    const todo = await response.json();
    const openView = async () => {
      await page.goto(scenario.path);
      if (scenario.view === 'month') await page.getByRole('button', { name: '2027-01-04 할 일', exact: true }).click();
    };
    await openView();
    const titleField = page.locator(`[data-testid="todo-title"][data-todo-id="${todo.id}"]`);
    await expect(titleField).toHaveValue(title);
    const geometry = await titleField.evaluate(element => ({
      font: Number.parseFloat(getComputedStyle(element).fontSize),
      height: element.clientHeight, scrollHeight: element.scrollHeight,
      width: element.clientWidth, scrollWidth: element.scrollWidth,
    }));
    expect(geometry.font).toBeGreaterThanOrEqual(14);
    expect(geometry.height).toBeGreaterThan(24);
    expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.height + 1);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);

    await page.getByRole('button', { name: `${title} 메모 추가`, exact: true }).click();
    const note = `회의 전에 확인할 자료\n참고 링크: https://example.com/${'reference'.repeat(12)}`;
    await page.getByRole('textbox', { name: `${title} 메모`, exact: true }).fill(note);
    await page.getByRole('button', { name: '메모 저장', exact: true }).click();
    await expect(page.getByText(note, { exact: true })).toBeVisible();
    if (scenario.view === 'week' && scenario.width < 768) {
      const list = titleField.locator('xpath=ancestor::ul');
      expect(await list.evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
    }
    await expect(page.getByRole('button', { name: `${title} 메모 접기`, exact: true })).toBeVisible();
    await page.getByRole('button', { name: `${title} 메모 접기`, exact: true }).click();
    await expect(page.getByText(note, { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: `${title} 메모 보기`, exact: true }).click();
    await expect(page.getByText(note, { exact: true })).toBeVisible();

    // Capture the expanded note at the actual responsive viewport after testing the toggle.
    await page.getByText(note, { exact: true }).scrollIntoViewIfNeeded();
    const screenshot = await page.screenshot();

    await openView();
    await page.getByRole('button', { name: `${title} 메모 보기`, exact: true }).click();
    await expect(page.getByText(note, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '메모 편집', exact: true }).click();
    await page.getByRole('textbox', { name: `${title} 메모`, exact: true }).fill('');
    await page.getByRole('button', { name: '메모 저장', exact: true }).click();
    await expect(page.getByRole('button', { name: `${title} 메모 추가`, exact: true })).toBeVisible();
    const saved = (await (await page.request.get('/api/todos?scope=day&scopeKey=2027-01-04')).json()).find((item: { id: string }) => item.id === todo.id);
    expect(saved.note).toBeNull();
    expect(saved.title).toBe(title);
    expect(saved.status).toBe('pending');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await writeFile(`test-results/todo-notes-${scenario.view}-${scenario.width}.png`, screenshot);
  });
}
