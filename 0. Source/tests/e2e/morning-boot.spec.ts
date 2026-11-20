import { test, expect, type Page } from '@playwright/test';
import { addDays, format, parseISO } from 'date-fns';
import { ensureUserExists, loginAs } from './_helpers';

async function setup(page: Page, width: number) {
  const username = `boot-${width}-${Date.now()}`;
  await ensureUserExists(username, 'pwTest123*');
  await page.setViewportSize({ width, height: 900 });
  await loginAs(page, username, 'pwTest123*');
}

async function checkNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const dialog = page.getByRole('dialog');
  if (await dialog.count()) {
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
}

for (const width of [1280, 390]) {
  test(`morning boot routine catches up overdue, pulls project/inbox tasks, and persists highlight at ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    await setup(page, width);

    await page.goto('/daily');
    await expect(page).toHaveURL(/\/daily\/\d{4}-\d{2}-\d{2}$/);
    const today = page.url().match(/\/daily\/(\d{4}-\d{2}-\d{2})$/)![1];
    const yesterday = format(addDays(parseISO(today), -1), 'yyyy-MM-dd');

    await page.request.post('/api/todos', {
      data: {
        title: '어제 밀린 작업',
        scope: 'day',
        scopeKey: yesterday,
        status: 'pending',
        order: 0,
      },
    });
    await page.request.post('/api/todos', {
      data: {
        title: '수집함에서 당길 작업',
        scope: 'inbox',
        scopeKey: 'inbox',
        status: 'pending',
        order: 0,
      },
    });
    await page.request.post('/api/projects', {
      data: {
        title: '모닝부팅 테스트 프로젝트',
        status: 'active',
        order: 0,
      },
    });

    await page.goto('/daily/2026-09-06');
    await expect(page.getByRole('region', { name: '모닝 부팅 배너' })).toHaveCount(0);

    await page.goto(`/daily/${today}`);
    const banner = page.getByRole('region', { name: '모닝 부팅 배너' });
    await expect(banner).toContainText('밀린 할 일 1개');
    await expect(banner).toContainText('다음 행동 필요 프로젝트 1개');
    await checkNoHorizontalOverflow(page);

    await banner.getByRole('button', { name: '아침 부팅 시작' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await checkNoHorizontalOverflow(page);

    // Step 1: bring yesterday's overdue task to today.
    await dialog.getByRole('button', { name: '오늘로', exact: true }).click();
    await expect(dialog.getByRole('tab', { name: /1\. 밀린 할 일 \(0\)/ })).toBeVisible();

    await dialog.getByRole('button', { name: '다음 단계 →' }).click();
    await checkNoHorizontalOverflow(page);

    // Step 2: add next action to active project and pull inbox TODO.
    await dialog.getByRole('button', { name: '오늘 행동 추가' }).click();
    await dialog.getByRole('textbox', { name: '새 할 일' }).fill('프로젝트 다음 행동');
    await dialog.getByRole('textbox', { name: '새 할 일' }).press('Enter');
    await expect(dialog).toContainText('오늘 1개');

    const inboxRow = dialog.locator('li').filter({ hasText: '수집함에서 당길 작업' });
    await inboxRow.getByRole('button', { name: '오늘로 가져오기' }).click();

    await dialog.getByRole('button', { name: '다음 단계 →' }).click();
    await checkNoHorizontalOverflow(page);

    // Step 3: set today's focus highlight and mark priority.
    await dialog.getByLabel('오늘의 초점 한 문장').fill('핵심 기능 완성하기');
    await dialog.getByRole('button', { name: '어제 밀린 작업 핵심 표시' }).click();
    await expect(dialog.getByRole('button', { name: '어제 밀린 작업 핵심 표시' })).toHaveAttribute('aria-pressed', 'true');

    await dialog.getByRole('button', { name: '부팅 완료' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await expect(banner).toContainText('핵심 기능 완성하기');
    await expect(banner.getByRole('button', { name: '부팅 다시 열기' })).toBeVisible();

    const todayTodosSection = page.locator('section').filter({ has: page.getByRole('heading', { name: '오늘 할 일', exact: true }) });
    await expect(todayTodosSection).toContainText('어제 밀린 작업');
    await expect(todayTodosSection).toContainText('프로젝트 다음 행동');
    await expect(todayTodosSection).toContainText('수집함에서 당길 작업');

    await page.reload();
    await expect(banner).toContainText('핵심 기능 완성하기');
    await expect(banner.getByRole('button', { name: '부팅 다시 열기' })).toBeVisible();
    await checkNoHorizontalOverflow(page);
  });
}

test('morning boot endpoints reject anonymous access', async ({ request }) => {
  expect((await request.get('/api/morning-boot?date=2026-11-20')).status()).toBe(401);
  expect((await request.post('/api/morning-boot', { data: { targetDate: '2026-11-20', moveToTodayIds: ['x'] } })).status()).toBe(401);
});
