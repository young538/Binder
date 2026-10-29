import { test, expect } from '@playwright/test';
import { ensureUserExists, loginAs } from './_helpers';

const cases = [
  { name: 'daily desktop', path: '/daily/2026-10-29', width: 1280 },
  { name: 'daily mobile', path: '/daily/2026-10-29', width: 390 },
  { name: 'weekly', path: '/week/2026-W44', width: 1280 },
  { name: 'monthly drawer', path: '/monthly/2026-10', width: 1280 },
];

for (const scenario of cases) {
  test(`${scenario.name}: Korean TODO submits once across Enter and blur`, async ({ page }) => {
    test.setTimeout(90000);
    const username = `e2e-create-${scenario.width}-${scenario.name.split(' ')[0]}`;
    await ensureUserExists(username, 'pwTest123*');
    await loginAs(page, username, 'pwTest123*');
    await page.setViewportSize({ width: scenario.width, height: 900 });
    await page.goto(scenario.path);
    if (scenario.path.startsWith('/monthly')) {
      await page.getByRole('button', { name: '2026-10-29 할 일', exact: true }).click();
      await page.getByRole('button', { name: 'TODO 추가', exact: true }).click();
    } else if (scenario.path.startsWith('/daily')) {
      await page.locator('section').filter({ has: page.getByRole('heading', { name: '오늘 할 일', exact: true }) })
        .getByRole('button', { name: '추가', exact: true }).click();
    } else {
      await page.getByRole('button', { name: '추가', exact: true }).first().click();
    }
    const input = page.getByRole('textbox', { name: '새 할 일', exact: true });
    const title = `중복 방지 ${Date.now()}`;
    await input.fill(title);
    let requests = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/todos', async route => {
      if (route.request().method() === 'POST') { requests++; await gate; }
      await route.continue();
    });
    await input.dispatchEvent('compositionstart');
    await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true, keyCode: 229 });
    await input.dispatchEvent('compositionend');
    expect(requests).toBe(0);
    try {
      await input.press('Enter');
      await input.evaluate(element => element.blur());
      await input.press('Enter');
      await expect.poll(() => requests).toBe(1);
    } finally { release(); }
    await expect(input).toHaveCount(0);
    const response = await page.request.get('/api/todos');
    expect(response.ok()).toBeTruthy();
    expect((await response.json()).filter((todo: { title: string }) => todo.title === title)).toHaveLength(1);
    expect(requests).toBe(1);
  });
}
