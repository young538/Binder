import { expect, test } from '@playwright/test';
import { ensureUserExists, loginAs } from './_helpers';

for (const width of [390, 1280]) {
  test.describe(`3일 플래너 ${width}px`, () => {
    test.use({ viewport: { width, height: 844 }, hasTouch: width === 390, timezoneId: 'Asia/Seoul' });

    test('shows adjacent dates across New Year and saves to the selected day', async ({ page }) => {
      const username = `e2e-agenda-${width}`;
      await ensureUserExists(username, 'pwTest123*');
      await page.clock.setFixedTime(new Date('2026-12-31T16:30:00Z'));
      await loginAs(page, username, 'pwTest123*');
      const days = ['2026-12-31', '2027-01-01', '2027-01-02'];
      const categories = await (await page.request.get('/api/categories')).json();
      expect((await page.request.post('/api/events', { data: {
        title: '연말연시 휴가', kind: 'event', date: days[0], endDate: days[1], allDay: true,
      } })).ok()).toBeTruthy();
      expect((await page.request.post('/api/time-blocks', { data: {
        text: '오전 운동', kind: 'actual', date: days[0], startMin: 540, endMin: 570, categoryId: categories[0].id,
      } })).ok()).toBeTruthy();
      for (const [i, title] of ['여행 준비', '새해 인사', '주말 장보기', '장보기 목록 작성'].entries()) {
        expect((await page.request.post('/api/todos', { data: {
          title, scope: 'day', scopeKey: days[i % 3], status: 'pending', order: i,
        } })).ok()).toBeTruthy();
      }

      await page.goto('/daily');
      const overview = page.getByRole('region', { name: '3일 플래너' });
      const [yesterday, today, tomorrow] = days.map(date => overview.getByRole('article', { name: date }));
      for (const [i, row] of [yesterday, today, tomorrow].entries()) {
        await expect(row.getByRole('link', { name: new RegExp(['어제', '오늘', '내일'][i]) })).toBeVisible();
      }
      await expect(yesterday).toContainText('09:00 실제');
      await expect(yesterday).toContainText('여행 준비');
      await expect(today).toContainText('연말연시 휴가');
      await expect(today).toContainText('새해 인사');
      await expect(tomorrow).toContainText('주말 장보기');
      await expect(tomorrow).not.toContainText('연말연시 휴가');
      const rows = await overview.getByRole('article').evaluateAll(elements =>
        elements.map(el => ({ x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y })));
      expect(width === 390 ? rows[0].y < rows[1].y && rows[1].y < rows[2].y : rows.every(row => row.y === rows[0].y)).toBe(true);
      expect(new Set(rows.map(row => row.x)).size).toBe(width === 390 ? 1 : 3);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await overview.screenshot({ path: `test-results/daily-agenda-${width}.png` });

      const more = yesterday.getByRole('button', { name: '1개 더 보기' });
      if (width === 390) await more.tap(); else await more.click();
      await expect(yesterday.getByText('장보기 목록 작성')).toBeVisible();
      await yesterday.getByRole('button', { name: '접기' }).click();
      await expect(yesterday.getByText('장보기 목록 작성')).toHaveCount(0);
      await tomorrow.getByRole('link', { name: /내일/ }).click();
      await expect(page).toHaveURL(/\/daily\/2027-01-02$/);
      await expect(tomorrow.getByRole('link', { name: /내일/ })).toHaveAttribute('aria-current', 'page');
      const todoList = page.locator('section').filter({ has: page.getByRole('heading', { name: '이날 할 일' }) });
      await todoList.getByRole('button', { name: '추가', exact: true }).click();
      await todoList.getByLabel('새 할 일').fill('토요일만 할 일');
      await todoList.getByLabel('새 할 일').press('Enter');
      await expect(tomorrow.getByText('토요일만 할 일')).toBeVisible();
      await page.getByRole('link', { name: '오늘로 돌아가기' }).click();
      await expect(page).toHaveURL(/\/daily\/2027-01-01$/);
      await page.reload();
      await expect(tomorrow.getByText('토요일만 할 일')).toBeVisible();
      await expect(today).not.toContainText('토요일만 할 일');
    });
  });
}
