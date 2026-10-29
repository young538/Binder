import { expect, test, type Locator, type Page } from '@playwright/test';
import { ensureUserExists, loginAs, resetDb } from './_helpers';

const USERNAME = 'e2e-daily-drag';
const PASSWORD = 'pwTest123*';
const DATE = '2026-09-07';

type Block = {
  id: string;
  date: string;
  startMin: number;
  endMin: number;
  kind: 'plan' | 'actual';
  text: string;
};

test.beforeAll(async () => {
  await ensureUserExists(USERNAME, PASSWORD);
});

const listBlocks = async (page: Page): Promise<Block[]> => {
  const response = await page.request.get(`/api/time-blocks?startDate=${DATE}&endDate=${DATE}`);
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Block[];
};

const prepareDailyPage = async (page: Page) => {
  await resetDb(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginAs(page, USERNAME, PASSWORD);

  const settingsResponse = await page.request.patch('/api/settings', {
    data: {
      firstDayOfWeek: 'mon',
      gridMinutes: 30,
      dayStartHour: 6,
      dayEndHour: 24,
      theme: 'light',
    },
  });
  expect(settingsResponse.ok()).toBeTruthy();
  expect(await settingsResponse.json()).toMatchObject({
    gridMinutes: 30,
    dayStartHour: 6,
    dayEndHour: 24,
  });

  for (const block of await listBlocks(page)) {
    const response = await page.request.delete(`/api/time-blocks/${block.id}`);
    expect(response.ok()).toBeTruthy();
  }

  const settingsCheck = await page.request.get('/api/settings');
  expect(settingsCheck.ok()).toBeTruthy();
  expect(await settingsCheck.json()).toMatchObject({
    gridMinutes: 30,
    dayStartHour: 6,
    dayEndHour: 24,
  });

  await page.goto(`/daily/${DATE}`);
  await expect(page.locator('[data-time-column][data-kind="plan"]')).toBeVisible();
  await expect(page.locator('[data-time-column][data-kind="actual"]')).toBeVisible();
};

const row = (page: Page, kind: 'plan' | 'actual', minute: number) =>
  page.locator(`[data-time-column][data-kind="${kind}"] [data-row="${(minute - 360) / 30}"]`);

const dragCenters = async (page: Page, source: Locator, target: Locator) => {
  // The timeline owns the vertical scroll. Centering the target keeps both
  // endpoints in the same viewport even when the target is after 13:00.
  await target.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(source).toBeInViewport({ ratio: 1 });
  await expect(target).toBeInViewport({ ratio: 1 });
  const sourceBox = (await source.boundingBox())!;
  const targetBox = (await target.boundingBox())!;
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 });
  await page.mouse.up();
};

const dialogTimes = async (page: Page) => {
  const dialog = page.getByRole('dialog');
  const inputs = dialog.locator('input[type="time"]');
  return {
    dialog,
    start: await inputs.nth(0).inputValue(),
    end: await inputs.nth(1).inputValue(),
  };
};

test('desktop empty timeline drag supports down/up ranges and Escape cancellation', async ({ page }) => {
  await prepareDailyPage(page);

  await expect(page.getByRole('button', { name: '목록', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '시간표', exact: true })).toBeVisible();

  const singleSlot = row(page, 'actual', 480);
  await singleSlot.click();
  await expect(singleSlot).toHaveAttribute('data-selected', 'true');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await singleSlot.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await singleSlot.dblclick();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');

  // Escape during an active gesture cancels the gesture before pointer-up;
  // no editor or persisted block should be created.
  const activeStart = row(page, 'plan', 540);
  const activeEnd = row(page, 'plan', 600);
  await activeEnd.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(activeStart).toBeInViewport({ ratio: 1 });
  await expect(activeEnd).toBeInViewport({ ratio: 1 });
  const activeStartBox = (await activeStart.boundingBox())!;
  const activeEndBox = (await activeEnd.boundingBox())!;
  await page.mouse.move(activeStartBox.x + activeStartBox.width / 2, activeStartBox.y + activeStartBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(activeEndBox.x + activeEndBox.width / 2, activeEndBox.y + activeEndBox.height / 2, { steps: 8 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await listBlocks(page)).toHaveLength(0);

  await dragCenters(page, row(page, 'plan', 540), row(page, 'plan', 600));
  let times = await dialogTimes(page);
  expect(times.start).toBe('09:00');
  expect(times.end).toBe('10:30');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await listBlocks(page)).toHaveLength(0);

  // Reverse the same gesture to cover range normalization when dragging up.
  await dragCenters(page, row(page, 'plan', 600), row(page, 'plan', 540));
  times = await dialogTimes(page);
  expect(times.start).toBe('09:00');
  expect(times.end).toBe('10:30');
  await times.dialog.getByPlaceholder('내용').fill('아래위 범위');
  await times.dialog.getByRole('button', { name: '저장', exact: true }).click();

  await expect
    .poll(async () => (await listBlocks(page)).find(block => block.text === '아래위 범위'))
    .toMatchObject({ date: DATE, startMin: 540, endMin: 630, kind: 'plan' });
});

test('desktop timeline block click edits, moves, and Alt-copies across columns', async ({ page }) => {
  await prepareDailyPage(page);

  const categoriesResponse = await page.request.get('/api/categories');
  expect(categoriesResponse.ok()).toBeTruthy();
  const categories = (await categoriesResponse.json()) as Array<{ id: string }>;
  expect(categories.length).toBeGreaterThan(0);

  const seededResponse = await page.request.post('/api/time-blocks', {
    data: {
      date: DATE,
      startMin: 540,
      endMin: 630,
      kind: 'plan',
      text: '이동할 타임라인 블록',
      categoryId: categories[0].id,
      goalId: null,
      todoId: null,
    },
  });
  expect(seededResponse.ok()).toBeTruthy();
  const seeded = (await seededResponse.json()) as Block;

  await page.reload();
  const source = page.locator(`[data-block-id="${seeded.id}"]`);
  await expect(source).toBeVisible();

  // The list remains available behind the explicit view switch.
  await page.getByRole('button', { name: '목록', exact: true }).click();
  await expect(page.locator(`[data-block-id="${seeded.id}"]`)).toHaveCount(0);
  await page.getByRole('button', { name: '시간표', exact: true }).click();
  await expect(source).toBeVisible();

  await source.click();
  await expect(source).toHaveAttribute('data-selected', 'true');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByTestId('week-selection-edit').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByPlaceholder('내용')).toHaveValue('이동할 타임라인 블록');
  await expect(dialog.locator('input[type="time"]').nth(0)).toHaveValue('09:00');
  await expect(dialog.locator('input[type="time"]').nth(1)).toHaveValue('10:30');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await dragCenters(page, source, row(page, 'plan', 720));
  await expect
    .poll(async () => (await listBlocks(page)).find(block => block.id === seeded.id))
    .toMatchObject({ startMin: 720, endMin: 810, kind: 'plan' });

  const moved = page.locator(`[data-block-id="${seeded.id}"]`);
  await expect(moved).toBeVisible();
  await page.keyboard.down('Alt');
  try {
    await dragCenters(page, moved, row(page, 'actual', 840));
  } finally {
    await page.keyboard.up('Alt');
  }

  await expect
    .poll(async () => (await listBlocks(page)).filter(block => block.text === '이동할 타임라인 블록'))
    .toHaveLength(2);
  const persisted = await listBlocks(page);
  expect(persisted.find(block => block.id === seeded.id)).toMatchObject({
    date: DATE,
    startMin: 720,
    endMin: 810,
    kind: 'plan',
  });
  expect(persisted.find(block => block.id !== seeded.id && block.text === seeded.text)).toMatchObject({
    date: DATE,
    startMin: 840,
    endMin: 930,
    kind: 'actual',
  });

  const blockStyle = () => page.locator(`[data-block-id="${seeded.id}"]`).evaluate(element => {
    const style = getComputedStyle(element);
    return { border: style.borderRightStyle, color: style.borderColor, background: style.backgroundColor, height: style.height, fontSize: style.fontSize };
  });
  const dailyStyle = await blockStyle();
  expect(dailyStyle.border).toBe('dashed');
  const copy = persisted.find(block => block.id !== seeded.id && block.text === seeded.text)!;
  expect(await page.locator(`[data-block-id="${copy.id}"]`).evaluate(element => getComputedStyle(element).borderRightStyle)).toBe('solid');
  await page.goto('/week/2026-W37');
  await expect(page.locator(`[data-block-id="${seeded.id}"][data-block]`)).toBeVisible();
  expect(await blockStyle()).toEqual(dailyStyle);
  await page.goto(`/daily/${DATE}`);
  await expect(page.locator('[data-time-column]')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/daily-drag-desktop.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 1000 });
  await page.reload();
  await expect(page.locator('[data-time-column][data-kind="plan"]')).toBeVisible();
  await expect(page.locator('[data-time-column][data-kind="actual"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/daily-drag-mobile.png', fullPage: true });
});

test('mobile touch drag opens the timeline range editor', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 1000 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  try {
    await prepareDailyPage(page);
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.goto(`/daily/${DATE}`);
    const source = row(page, 'actual', 540);
    const target = row(page, 'actual', 600);
    await target.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await expect(source).toBeInViewport({ ratio: 1 });
    await expect(target).toBeInViewport({ ratio: 1 });
    const sourceBox = (await source.boundingBox())!;
    const targetBox = (await target.boundingBox())!;
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: 1, x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ id: 1, x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 }],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const times = await dialogTimes(page);
    expect(times.start).toBe('09:00');
    expect(times.end).toBe('10:30');
    await page.keyboard.press('Escape');
  } finally {
    await context.close();
  }
});
