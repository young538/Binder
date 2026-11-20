import { expect, test } from '@playwright/test';
import { ensureUserExists, loginAs } from './_helpers';

test('weekly views share range queries with habits above weekly todos and visible statistics', async ({ page }) => {
  await ensureUserExists('e2e-week-efficiency', 'pwTest123*');
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginAs(page, 'e2e-week-efficiency', 'pwTest123*');
  await expect(page.getByRole('heading', { name: '오늘 할 일', exact: true })).toBeVisible();
  // Use representative content to check alignment and lower-page clearance.
  const habits = await (await page.request.get('/api/habits')).json();
  if (!habits.length) {
    for (const [order, name] of ['아침 스트레칭', '독서 20분', '하루 돌아보기'].entries()) {
      expect((await page.request.post('/api/habits', { data: { name, order, color: '#d9ead3', schedule: { kind: 'daily' } } })).ok()).toBeTruthy();
    }
  }
  const categories = await (await page.request.get('/api/categories')).json();
  const blocks = await (await page.request.get('/api/time-blocks?startDate=2026-09-07&endDate=2026-09-13')).json();
  if (!blocks.length) {
    expect((await page.request.post('/api/time-blocks', { data: { date: '2026-09-09', startMin: 540, endMin: 630, kind: 'actual', text: '집중 작업', categoryId: categories[0].id } })).ok()).toBeTruthy();
  }
  const queries: URL[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (request.method() === 'GET' && ['/api/todos', '/api/time-blocks'].includes(url.pathname)) queries.push(url);
  });
  await page.goto('/week/2026-W37');
  await expect(page.getByTestId('time-slot').first()).toBeVisible();
  const rangeQueries = (path: string) => queries.filter(url => url.pathname === path && url.searchParams.get('startDate') === '2026-09-07');
  await expect.poll(() => rangeQueries('/api/todos').length).toBe(1);
  await expect.poll(() => rangeQueries('/api/time-blocks').length).toBe(1);
  expect(queries.filter(url => url.searchParams.get('scope') === 'day')).toHaveLength(0);

  const calendar = page.getByRole('region', { name: '주간 습관 체크' });
  await expect(calendar).toHaveCount(1);
  await expect(calendar.getByText('아침 스트레칭', { exact: true })).toBeVisible();
  const todoBox = await page.getByRole('heading', { name: '이번 주 TODO', exact: true }).boundingBox();
  const calendarBox = await calendar.boundingBox();
  expect(calendarBox!.y + calendarBox!.height).toBeLessThan(todoBox!.y);
  await expect(page.getByRole('heading', { name: '주간 실제 기록 통계' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '🎯 목표별' })).toBeVisible();
  await expect(page.getByRole('button', { name: /펼치기.*통계/ })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/weekly-efficient-desktop.png' });
  await calendar.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/weekly-review-desktop.png' });
  const beforeResize = queries.length;
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('time-slot')).toHaveCount(0);
  await expect(calendar.getByText('아침 스트레칭', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /목표 진행 요약/ })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '주간 실제 기록 통계' })).toBeVisible();
  await calendar.scrollIntoViewIfNeeded();
  const statsBox = await page.getByTestId('weekly-statistics').boundingBox();
  const dayTodoBox = await page.getByRole('button', { name: /오늘 할 일/ }).boundingBox();
  expect(statsBox!.y + statsBox!.height).toBeLessThanOrEqual(dayTodoBox!.y);
  const reviewPadding = await page.getByTestId('weekly-review').evaluate(element => parseFloat(getComputedStyle(element).paddingBottom));
  expect(reviewPadding).toBeLessThan(100);
  await page.screenshot({ path: 'test-results/weekly-efficient-mobile.png' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByTestId('time-slot').first()).toBeVisible();
  // Desktop remount may fetch its weekly TODO, but range data stays in the provider.
  expect(queries.slice(beforeResize).filter(url => url.searchParams.has('startDate'))).toHaveLength(0);
});
