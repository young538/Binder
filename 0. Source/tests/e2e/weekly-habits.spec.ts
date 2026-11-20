import { test, expect } from '@playwright/test';
import { ensureUserExists, loginAs } from './_helpers';

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`weekly habits appear once and persist across views (${viewport.width}px)`, async ({ page }) => {
    test.setTimeout(90000);
    const username = `e2e-weekly-habits-${viewport.width}`;
    await ensureUserExists(username, 'pwTest123*');
    await page.setViewportSize(viewport);
    await loginAs(page, username, 'pwTest123*');
    const existing = await page.request.get('/api/habits');
    expect(existing.ok()).toBeTruthy();
    for (const habit of await existing.json()) {
      expect((await page.request.delete(`/api/habits/${habit.id}`)).ok()).toBeTruthy();
    }
    const routines = [
      { name: '매일 스트레칭', schedule: { kind: 'daily' } },
      { name: '월수금 운동', schedule: { kind: 'weekdays', days: [1, 3, 5] } },
      { name: '주 3회 산책', schedule: { kind: 'perWeek', count: 3 } },
    ];
    for (const [order, routine] of routines.entries()) {
      const response = await page.request.post('/api/habits', {
        data: { ...routine, order, color: '#d9ead3' },
      });
      expect(response.ok()).toBeTruthy();
    }
    await page.goto('/week/2026-W37');
    const calendar = page.getByRole('region', { name: '주간 습관 체크' });
    await expect(calendar).toHaveCount(1);
    await expect(calendar.getByRole('table')).toHaveCount(1);
    for (const routine of routines) {
      await expect(page.getByText(routine.name, { exact: true })).toHaveCount(1);
    }
    await expect(page.getByText('오늘의 습관', { exact: true })).toHaveCount(0);
    const monday = calendar.getByRole('button', { name: '매일 스트레칭 2026-09-07', exact: true });
    await monday.click();
    await expect(monday).toHaveAttribute('aria-pressed', 'true');
    await expect(calendar.getByRole('button', { name: '월수금 운동 2026-09-08', exact: true })).toBeDisabled();
    const flexible = calendar.getByRole('button', { name: '주 3회 산책 2026-09-08', exact: true });
    await flexible.click();
    await expect(flexible).toHaveAttribute('aria-pressed', 'true');
    await expect(flexible).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(monday).toHaveAttribute('aria-pressed', 'true');
    const table = calendar.getByRole('table');
    expect(await table.evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    const compactHeight = (await calendar.boundingBox())!.height;
    expect(compactHeight).toBeLessThan(165);
    await page.screenshot({ path: `test-results/weekly-habits-${viewport.width}.png` });
    await page.goto('/daily/2026-09-07');
    await expect(page.getByRole('button', { name: '매일 스트레칭 완료 취소', exact: true })).toBeVisible();
    await page.goto('/week/2026-W38');
    await expect(calendar.getByRole('button', { name: '매일 스트레칭 2026-09-14', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await page.goto('/week/2026-W37');
    await monday.click();
    await expect(monday).toHaveAttribute('aria-pressed', 'false');
  });
}
