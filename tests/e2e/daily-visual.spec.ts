import { test, expect } from '@playwright/test';
import { ensureUserExists, loginAs, resetDb } from './_helpers';

test.beforeAll(async () => {
  await ensureUserExists('e2e-daily-visual', 'pwTest123*');
});

test('visual snapshot of the daily tracker', async ({ page }) => {
  await resetDb(page);
  await loginAs(page, 'e2e-daily-visual', 'pwTest123*');
  await page.goto('/daily');

  // Prior runs may have already created habits in the SQLite test DB.
  // Clear them so the empty state (with the preset button) is visible.
  const existing = await page.evaluate(async () => {
    const res = await fetch('/api/habits');
    return res.ok ? await res.json() : [];
  });
  for (const habit of existing) {
    await page.evaluate(async (id) => {
      await fetch(`/api/habits/${id}`, { method: 'DELETE' });
    }, habit.id);
  }
  if (existing.length > 0) await page.reload();

  const presetButton = page.getByRole('button', { name: '9월 트래커 루틴 추가' });
  await presetButton.click({ timeout: 15_000 });
  await expect(presetButton).toBeHidden({ timeout: 15_000 });
  // Wait until the newly created habits actually render.
  await expect(page.getByRole('button', { name: '오늘 일정 정리 완료' })).toBeVisible({ timeout: 15_000 });

  await page.setViewportSize({ width: 1280, height: 960 });
  await page.screenshot({ path: 'test-results/daily-desktop.png', fullPage: true });

  // 루틴 관리 시트(페이지 내 모달) 검수
  await page.getByRole('button', { name: '루틴 관리' }).click();
  await expect(page.getByText('매일 반복할 일 관리')).toBeVisible();
  // HabitEditor가 자체 fetch를 마치고 습관 목록을 그릴 때까지 대기
  // HabitEditor 의 습관 행(색상 선택 input)이 렌더될 때까지 대기
  await expect(page.locator('input[type="color"]').first()).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: 'test-results/daily-routine-sheet.png', fullPage: false });
  await page.getByLabel('닫기').click();
  await expect(page.getByText('매일 반복할 일 관리')).toBeHidden();

  await page.setViewportSize({ width: 390, height: 1200 });
  await page.screenshot({ path: 'test-results/daily-mobile.png', fullPage: true });
});
