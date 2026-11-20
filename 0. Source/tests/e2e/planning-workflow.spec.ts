import { test, expect, type Page } from '@playwright/test';
import { ensureUserExists, loginAs } from './_helpers';

async function setup(page: Page, width: number, suffix: string) {
  const username = `plan-${width}-${suffix}-${Date.now()}`;
  await ensureUserExists(username, 'pwTest123*');
  await page.setViewportSize({ width, height: 900 });
  await loginAs(page, username, 'pwTest123*');
  const response = await page.request.get('/api/categories');
  return (await response.json())[0].id as string;
}

async function screenshot(page: Page, name: string, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const dialog = page.getByRole('dialog');
  if (await dialog.count()) expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: `tmp-test/planning-${name}-${width}.png`, fullPage: true });
}

for (const width of [1280, 390]) {
  test(`capture, recurrence and reflection links at ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    await setup(page, width, 'todo');
    await page.getByRole('button', { name: '빠른 메모', exact: true }).click();
    await page.getByRole('textbox', { name: '새 할 일' }).fill('매주 책상 정리');
    await page.getByRole('button', { name: '수집함에 저장' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.goto('/inbox');
    await page.getByRole('button', { name: '매주 책상 정리 상세 설정' }).click();
    await page.getByLabel('실행 날짜', { exact: true }).fill('2026-12-31');
    await page.getByLabel('할 일 메모').fill('서랍까지 정리');
    await page.getByLabel('반복 할 일', { exact: true }).check();
    await screenshot(page, 'repeat', width);
    await page.getByRole('button', { name: '설정 저장' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '매주 책상 정리 상세 설정' })).toHaveCount(0);
    await page.goto('/daily/2026-12-31');
    const row = page.locator('li').filter({ has: page.getByRole('button', { name: '매주 책상 정리 상세 설정' }) });
    await row.scrollIntoViewIfNeeded();
    // Let the programmatic scroll finish before opening a menu that closes on scroll.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await row.getByTitle('대기', { exact: true }).click();
    await page.getByRole('button', { name: /완료$/ }).click({ timeout: 10000 });
    await expect.poll(async () => (await (await page.request.get('/api/todos?scope=day&scopeKey=2027-01-07')).json()).length).toBe(1);
    await page.reload();
    await expect(page.getByText('↻ 1주마다')).toBeVisible();

    await page.goto('/daily/2027-12-31');
    await page.getByRole('textbox', { name: /내일\/다음주 1가지/ }).fill('새해 목표를 구체적으로 적기');
    await page.getByRole('button', { name: '할 일로 추가', exact: true }).click();
    await expect(page.getByLabel('회고 할 일 기간')).toHaveValue('2028-01-01');
    await page.getByRole('button', { name: '할 일 등록', exact: true }).click();
    await expect(page.getByRole('link', { name: '등록한 목록 보기' })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: '할 일로 추가', exact: true }).click();
    await page.getByRole('button', { name: '할 일 등록', exact: true }).click();
    await expect(page.getByRole('link', { name: '등록한 목록 보기' })).toBeVisible();
    const todos = await (await page.request.get('/api/todos?scope=day&scopeKey=2028-01-01')).json();
    expect(todos).toHaveLength(1);
    await page.getByRole('link', { name: '등록한 목록 보기' }).click();
    await page.getByRole('button', { name: '새해 목표를 구체적으로 적기 상세 설정' }).click();
    await expect(page.getByRole('link', { name: /원래 회고 보기/ })).toHaveAttribute('href', '/daily/2027-12-31#daily-record');
    await screenshot(page, 'retro-source', width);
    await page.getByRole('button', { name: '닫기', exact: true }).click();

    await page.goto('/retrospective/week/2026-W53');
    await page.getByRole('textbox', { name: /내일\/다음주 1가지/ }).fill('다음 주 시간 확보');
    await page.getByRole('button', { name: '할 일로 추가', exact: true }).click();
    await expect(page.getByLabel('회고 할 일 기간')).toHaveValue('2027-W01');
    await page.getByRole('button', { name: '할 일 등록', exact: true }).click();
    await expect(page.getByRole('link', { name: '등록한 목록 보기' })).toHaveAttribute('href', '/week/2027-W01');
    expect((await (await page.request.get('/api/todos?scope=week&scopeKey=2027-W01')).json())[0].sourceRetro.type).toBe('weekly');
  });

  test(`weekly template preview, replay and time comparison at ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    const categoryId = await setup(page, width, 'week');
    for (const [kind, endMin] of [['plan', 720], ['actual', 660]] as const) {
      const response = await page.request.post('/api/time-blocks', { data: { date: '2026-12-28', startMin: 600, endMin, text: '공부 집중', kind, categoryId } });
      expect(response.status()).toBe(201);
    }
    await page.goto('/week/2026-W53');
    await expect(page.getByRole('region', { name: '계획 대비 실제 시간' })).toContainText('계획 2.0h · 실제 1.0h');
    await page.getByText('주간 계획 템플릿', { exact: true }).click();
    await page.getByLabel('템플릿 이름').fill('집중하는 주');
    await page.getByRole('button', { name: '이 주를 템플릿으로 저장' }).click();
    await expect(page.getByLabel('템플릿 미리보기')).toContainText('월 10:00–12:00');
    await page.getByLabel('템플릿 적용할 주').fill('2027-W01');
    await page.getByRole('button', { name: '이 주에 적용', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: '1개 추가' })).toBeVisible();
    await page.getByRole('button', { name: '이 주에 적용', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: '0개 추가, 기존 1개 유지' })).toBeVisible();
    await screenshot(page, 'template', width);
    const blocks = await (await page.request.get('/api/time-blocks?startDate=2027-01-04&endDate=2027-01-10')).json();
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ date: '2027-01-04', kind: 'plan', todoId: null });
    await page.reload();
    await page.getByText('주간 계획 템플릿', { exact: true }).click();
    await expect(page.getByLabel('저장한 템플릿').locator('option')).toHaveCount(2);
    await page.goto('/retrospective/week/2026-W53');
    await expect(page.getByRole('region', { name: '계획 대비 실제 시간' })).toContainText('계획 2.0h · 실제 1.0h · 차이 -1.0h');
    await screenshot(page, 'comparison', width);
  });

  test(`reading history and descendant goal review at ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    const categoryId = await setup(page, width, 'insight');
    const book = await (await page.request.post('/api/books', { data: { title: '기록을 연결하는 책', year: '2026', order: 0 } })).json();
    const root = await (await page.request.post('/api/goals', { data: { title: '꾸준히 성장', level: 'oneThing', order: 0 } })).json();
    const child = await (await page.request.post('/api/goals', { data: { title: '독서 실행', level: 'mandalartCore', parentId: root.id, order: 0 } })).json();
    await page.request.post('/api/goals', { data: { title: '쉬고 있는 목표', level: 'mandalartCore', parentId: root.id, order: 1 } });
    await page.request.post('/api/time-blocks', { data: { date: '2026-12-31', startMin: 600, endMin: 660, text: '독서', kind: 'actual', categoryId, goalId: child.id } });
    for (const [date, pages] of [['2026-12-31', 20], ['2027-01-01', 30]] as const) {
      const response = await page.request.put('/api/retrospectives', { data: { type: 'daily', dateOrWeek: date, template: { reading: JSON.stringify({ bookId: book.id, bookTitle: book.title, pages, memo: `${date}에서 남긴 독서 노트` }) } } });
      expect(response.ok()).toBe(true);
    }
    await page.goto('/reading?year=2026');
    await page.getByRole('button', { name: '기록을 연결하는 책 독서 기록 보기' }).click();
    await expect(page.getByRole('dialog')).toContainText('누적 50쪽 · 독서한 날 2일');
    await expect(page.getByRole('link', { name: '2027-01-01', exact: true })).toBeVisible();
    await screenshot(page, 'reading', width);
    await page.getByRole('link', { name: '2027-01-01', exact: true }).click();
    await expect(page.getByLabel('책', { exact: true })).toHaveValue(book.id);
    await page.getByLabel('읽은 쪽수').fill('40');
    await expect.poll(async () => (await (await page.request.get(`/api/books/${book.id}/history`)).json()).totalPages).toBe(60);
    await page.goto('/goal-review');
    await page.getByLabel('목표 점검 기준 날짜').fill('2026-12-31');
    const rootCard = page.locator('section').filter({ has: page.getByRole('heading', { name: '꾸준히 성장', exact: true }) });
    await expect(rootCard).toContainText('1.0h');
    await expect(rootCard).toContainText('하위 목표 2개 포함');
    await screenshot(page, 'goals', width);
    await page.getByLabel('실행 기록 없는 목표만').check();
    await expect(page.getByRole('heading', { name: '꾸준히 성장', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '쉬고 있는 목표', exact: true })).toBeVisible();
  });
}

test('planning endpoints reject anonymous access', async ({ request }) => {
  for (const path of ['/api/weekly-templates', '/api/goal-review?date=2026-12-31', '/api/books/unknown/history']) {
    expect((await request.get(path)).status()).toBe(401);
  }
  expect((await request.post('/api/weekly-templates', { data: { name: 'x', sourceWeek: '2026-W53' } })).status()).toBe(401);
  expect((await request.post('/api/weekly-templates/unknown/apply', { data: { week: '2027-W01' } })).status()).toBe(401);
});
