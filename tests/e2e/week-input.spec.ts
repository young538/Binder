import { test, expect, type Locator, type Page } from '@playwright/test';
import { ensureUserExists, loginAs, resetDb } from './_helpers';
import { toIsoWeek } from '@/lib/utils/date';

// Each spec uses its own user so test data on the server-side SQLite DB
// does not leak between tests in the same suite (each user's todos and
// time blocks are scoped to that user_id).
test.beforeAll(async () => {
  await ensureUserExists('e2e-week-input', 'pwTest123*');
});

const dragLocatorCenter = async (
  page: Page,
  source: Locator,
  target: Locator,
) => {
  const sourceBox = (await source.boundingBox())!;
  const targetBox = (await target.boundingBox())!;
  // 슬롯이 뷰포트 밖에 있으면 mouse.down()이 페이지 스크롤을 유발해
  // pointerdown 타깃이 어긋난다. 미리 스크롤해 좌표를 고정한다.
  await source.scrollIntoViewIfNeeded();
  const freshSourceBox = (await source.boundingBox())!;
  const freshTargetBox = (await target.boundingBox())!;
  await page.mouse.move(freshSourceBox.x + freshSourceBox.width / 2, freshSourceBox.y + freshSourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(freshTargetBox.x + freshTargetBox.width / 2, freshTargetBox.y + freshTargetBox.height / 2, { steps: 10 });
  await page.mouse.up();
  void sourceBox;
  void targetBox;
};

const listBlocks = async (page: Page, startDate: string, endDate: string) =>
  page.evaluate(
    async ({ startDate, endDate }) => {
      const res = await fetch(`/api/time-blocks?startDate=${startDate}&endDate=${endDate}`);
      return res.json() as Promise<
        Array<{ id: string; text: string; date: string; startMin: number; endMin: number; kind: string }>
      >;
    },
    { startDate, endDate },
  );

const currentWeekRange = async (page: Page) => {
  const startDate = (
    await page
      .locator('[data-testid="time-slot"][data-day-index="0"][data-kind="plan"][data-row="0"]')
      .first()
      .getAttribute('data-date')
  )!;
  const endDate = (
    await page
      .locator('[data-testid="time-slot"][data-day-index="6"][data-kind="actual"][data-row="0"]')
      .first()
      .getAttribute('data-date')
  )!;
  return { startDate, endDate };
};

const clearCurrentWeekBlocks = async (page: Page) => {
  const { startDate, endDate } = await currentWeekRange(page);
  const rows = await listBlocks(page, startDate, endDate);
  await page.evaluate(
    async (ids) => {
      await Promise.all(ids.map((id) => fetch(`/api/time-blocks/${id}`, { method: 'DELETE' })));
    },
    rows.map((row) => row.id),
  );
  await page.reload();
  await expect(page.getByText('로딩 중…')).toHaveCount(0, { timeout: 60000 });
};

// 선택-편집 분리 플로우 헬퍼: 빈 슬롯 선택 → 선택 바에서 편집 진입 → 저장.
const createBlockViaSelection = async (page: Page, slot: Locator, title: string) => {
  await slot.click();
  await expect(slot).toHaveAttribute('data-selected', 'true');
  // 단일 클릭만으로는 편집기가 열리면 안 된다.
  await expect(page.getByRole('heading', { name: /블록 추가/ })).toHaveCount(0);
  await page.getByTestId('week-selection-edit').click();
  await expect(page.getByRole('heading', { name: /블록 추가/ })).toBeVisible();
  await page.getByPlaceholder('내용').fill(title);
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText(title).first()).toBeVisible();
};

// 기존 블록 편집 헬퍼: 블록 선택 → 선택 바에서 편집 진입 → 저장.
const editBlockViaSelection = async (page: Page, title: string, nextTitle: string) => {
  const block = page.locator('[data-testid="time-block"]').filter({ hasText: title }).first();
  await block.click();
  await expect(block).toHaveAttribute('data-selected', 'true');
  await expect(page.getByRole('heading', { name: /블록 편집/ })).toHaveCount(0);
  await page.getByTestId('week-selection-edit').click();
  await expect(page.getByRole('heading', { name: /블록 편집/ })).toBeVisible();
  await page.getByPlaceholder('내용').fill(nextTitle);
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText(nextTitle).first()).toBeVisible();
};

test('single click selects a slot without opening the editor', async ({ page }) => {
  await resetDb(page);
  await loginAs(page, 'e2e-week-input', 'pwTest123*');
  await page.goto(`/week/${toIsoWeek(new Date())}`);
  await page.waitForURL(/\/week\//);

  // Wait for store to be ready (loading screen to disappear)
  await expect(page.getByText('로딩 중…')).toHaveCount(0, { timeout: 60000 });
  await clearCurrentWeekBlocks(page);

  const firstCell = page.locator('[data-testid="time-slot"]').first();
  await firstCell.click();

  await expect(firstCell).toHaveAttribute('data-selected', 'true');
  await expect(page.getByTestId('week-selection-bar')).toBeVisible();
  await expect(page.getByRole('heading', { name: /블록 추가/ })).toHaveCount(0);
});

test('double click a slot opens BlockEditor on the exact slot', async ({ page }) => {
  await resetDb(page);
  await loginAs(page, 'e2e-week-input', 'pwTest123*');
  await page.goto(`/week/${toIsoWeek(new Date())}`);
  await page.waitForURL(/\/week\//);
  await expect(page.getByText('로딩 중…')).toHaveCount(0, { timeout: 60000 });
  await clearCurrentWeekBlocks(page);

  // Playwright 마우스 합성 클릭은 실제 버튼 좌표와 어긋나
  // React dblclick까지 도달하지 못한다. 대신 버튼에 직접 dblclick을
  // dispatch해 실제 사용자 더블클릭과 동일한 핸들러 경로를 검증한다.
  // (단일 클릭은 이미 위 테스트에서 선택만 됨을 확인)
  // 검증 포인트: 열린 편집기가 누른 셀과 같은 날짜/시간대여야 한다.
  const slot = page
    .locator('[data-testid="time-slot"][data-day-index="2"][data-kind="actual"][data-row="3"]')
    .first();
  const expectedDate = (await slot.getAttribute('data-date'))!;
  await slot.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    el.dispatchEvent(
      new MouseEvent('dblclick', {
        bubbles: true,
        cancelable: true,
        clientX: rect.x + rect.width / 2,
        clientY: rect.y + rect.height / 2,
        detail: 2,
      }),
    );
  });
  await expect(page.getByRole('heading', { name: /블록 추가/ })).toBeVisible();
  // 누른 셀이 편집 중에도 하이라이트로 남아 있어야 한다.
  await expect(slot).toHaveAttribute('data-selected', 'true');
  // 편집기 헤더에 같은 날짜/계획-실제/시간이 표시되어야 한다.
  const dialogText = (await page.locator('div.fixed.inset-0.z-50').last().innerText()) ?? '';
  expect(dialogText).toContain(expectedDate);
});

test('Enter on a selected slot opens BlockEditor', async ({ page }) => {
  await resetDb(page);
  await loginAs(page, 'e2e-week-input', 'pwTest123*');
  await page.goto(`/week/${toIsoWeek(new Date())}`);
  await page.waitForURL(/\/week\//);
  await expect(page.getByText('로딩 중…')).toHaveCount(0, { timeout: 60000 });
  await clearCurrentWeekBlocks(page);

  const slot = page.locator('[data-testid="time-slot"][data-row]').first();
  await slot.click();
  await expect(slot).toHaveAttribute('data-selected', 'true');
  // 슬롯 자체에 포커스를 두고 Enter: 슬롯 onKeyDown에서 직접 편집 진입.
  await slot.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /블록 추가/ })).toBeVisible();
});

test('create, edit, delete time block via selection', async ({ page }) => {
  await resetDb(page);
  await loginAs(page, 'e2e-week-input', 'pwTest123*');
  await page.goto(`/week/${toIsoWeek(new Date())}`);
  await page.waitForURL(/\/week\//);

  // Wait for store to be ready (loading screen to disappear)
  await expect(page.getByText('로딩 중…')).toHaveCount(0, { timeout: 60000 });
  await clearCurrentWeekBlocks(page);

  // Create through the select → edit flow.
  const firstCell = page.locator('[data-testid="time-slot"]').first();
  await createBlockViaSelection(page, firstCell, 'E2E 블록');

  // Edit through the select → edit flow.
  await editBlockViaSelection(page, 'E2E 블록', '수정됨');

  // Delete (confirm dialog auto-accept) — open the editor from selection first.
  page.on('dialog', (d) => d.accept());
  const block = page.locator('[data-testid="time-block"]').filter({ hasText: '수정됨' }).first();
  await block.click();
  await page.getByTestId('week-selection-edit').click();
  await page.getByRole('button', { name: '삭제' }).click();
  await expect(page.getByText('수정됨')).toHaveCount(0);
});

test('drag across multiple slots opens BlockEditor with that range', async ({ page }) => {
  await resetDb(page);
  await loginAs(page, 'e2e-week-input', 'pwTest123*');
  await page.goto(`/week/${toIsoWeek(new Date())}`);
  await page.waitForURL(/\/week\//);
  await expect(page.getByText('로딩 중…')).toHaveCount(0, { timeout: 60000 });
  await clearCurrentWeekBlocks(page);

  const slots = page.locator('[data-testid="time-slot"][data-row]');
  await expect(slots.first()).toBeVisible();

  // The three slots share a column; the entire gesture must stay in view.
  const start = slots.nth(0);
  const end = slots.nth(2);

  // The asynchronously loaded note above the grid changes its vertical position.
  // Wait for it, then center the range: scrolling only the first row into view
  // can leave row 2 below the viewport, sending pointerup to the document.
  await expect(page.getByPlaceholder('예: 릴스 제작 루틴 실행')).toBeVisible();
  await start.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(start).toBeInViewport({ ratio: 1 });
  await expect(end).toBeInViewport({ ratio: 1 });
  const startBox = (await start.boundingBox())!;
  const endBox = (await end.boundingBox())!;

  // Real mouse events down, across the visible slots, then up.
  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 10 });
  await page.mouse.up();

  // BlockEditor opens
  await expect(page.getByRole('heading', { name: /블록 추가/ })).toBeVisible();

  // Verify time inputs span > 1 slot.
  const timeInputs = page.locator('input[type=time]');
  const startVal = await timeInputs.nth(0).inputValue();
  const endVal = await timeInputs.nth(1).inputValue();
  expect(startVal).not.toEqual(endVal);

  // Parse HH:MM and assert the dragged range is at least 60 minutes
  // (3 rows × 30min = 90; allow ≥ 60 to keep the test resilient if the
  // default gridMinutes ever changes to 20).
  const toMin = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  };
  expect(toMin(endVal) - toMin(startVal)).toBeGreaterThanOrEqual(60);
});

test('dragging an existing block moves it to another slot', async ({ page }) => {
  await resetDb(page);
  await loginAs(page, 'e2e-week-input', 'pwTest123*');
  await page.goto(`/week/${toIsoWeek(new Date())}`);
  await page.waitForURL(/\/week\//);
  await expect(page.getByText('로딩 중…')).toHaveCount(0, { timeout: 60000 });
  await clearCurrentWeekBlocks(page);
  const title = `이동할 블록 ${Date.now()}`;

  const sourceSlot = page
    .locator('[data-testid="time-slot"][data-day-index="0"][data-kind="plan"][data-row="0"]')
    .first();
  const targetSlot = page
    .locator('[data-testid="time-slot"][data-day-index="0"][data-kind="plan"][data-row="2"]')
    .first();
  await createBlockViaSelection(page, sourceSlot, title);

  const startDate = (await sourceSlot.getAttribute('data-date'))!;
  const endDate = (
    await page
      .locator('[data-testid="time-slot"][data-day-index="6"][data-kind="actual"][data-row="0"]')
      .first()
      .getAttribute('data-date')
  )!;
  await expect
    .poll(async () => {
      const rows = await listBlocks(page, startDate, endDate);
      return rows.find((row) => row.text === title)?.startMin;
    })
    .not.toBeUndefined();
  const beforeMove = (await listBlocks(page, startDate, endDate)).find((row) => row.text === title)!;
  const slotMinutes = beforeMove.endMin - beforeMove.startMin;
  const block = page.locator('[data-testid="time-block"]').filter({ hasText: title }).first();
  await dragLocatorCenter(page, block, targetSlot);

  await expect
    .poll(async () => {
      const rows = await listBlocks(page, startDate, endDate);
      return rows.find((row) => row.text === title)?.startMin;
    })
    .toBe(beforeMove.startMin + slotMinutes * 2);

  await expect
    .poll(async () => {
      const rows = await listBlocks(page, startDate, endDate);
      return rows.filter((row) => row.text === title).length;
    })
    .toBe(1);
});

test('ctrl dragging an existing block copies it to the target slot', async ({ page }) => {
  await resetDb(page);
  await loginAs(page, 'e2e-week-input', 'pwTest123*');
  await page.goto(`/week/${toIsoWeek(new Date())}`);
  await page.waitForURL(/\/week\//);
  await expect(page.getByText('로딩 중…')).toHaveCount(0, { timeout: 60000 });
  await clearCurrentWeekBlocks(page);
  const title = `복사할 블록 ${Date.now()}`;

  const sourceSlot = page
    .locator('[data-testid="time-slot"][data-day-index="0"][data-kind="plan"][data-row="0"]')
    .first();
  const targetSlot = page
    .locator('[data-testid="time-slot"][data-day-index="1"][data-kind="plan"][data-row="1"]')
    .first();
  await createBlockViaSelection(page, sourceSlot, title);

  const startDate = (await sourceSlot.getAttribute('data-date'))!;
  const targetDate = (await targetSlot.getAttribute('data-date'))!;
  const endDate = (
    await page
      .locator('[data-testid="time-slot"][data-day-index="6"][data-kind="actual"][data-row="0"]')
      .first()
      .getAttribute('data-date')
  )!;
  await expect
    .poll(async () => {
      const rows = await listBlocks(page, startDate, endDate);
      return rows.find((row) => row.text === title)?.startMin;
    })
    .not.toBeUndefined();
  const beforeCopy = (await listBlocks(page, startDate, endDate)).find((row) => row.text === title)!;
  const slotMinutes = beforeCopy.endMin - beforeCopy.startMin;
  const block = page.locator('[data-testid="time-block"]').filter({ hasText: title }).first();

  await page.keyboard.down('Control');
  await dragLocatorCenter(page, block, targetSlot);
  await page.keyboard.up('Control');

  await expect
    .poll(async () => {
      const rows = await listBlocks(page, startDate, endDate);
      return rows.filter((row) => row.text === title).length;
    })
    .toBe(2);

  await expect
    .poll(async () => {
      const rows = await listBlocks(page, startDate, endDate);
      return rows.some(
        (row) => row.text === title && row.date === startDate && row.startMin === beforeCopy.startMin,
      );
    })
    .toBe(true);

  await expect
    .poll(async () => {
      const rows = await listBlocks(page, startDate, endDate);
      return rows.some(
        (row) =>
          row.text === title && row.date === targetDate && row.startMin === beforeCopy.startMin + slotMinutes,
      );
    })
    .toBe(true);
});

test('todo title needs explicit edit gesture before typing', async ({ page }) => {
  await resetDb(page);
  await loginAs(page, 'e2e-week-input', 'pwTest123*');
  await page.goto(`/week/${toIsoWeek(new Date())}`);
  await page.waitForURL(/\/week\//);
  await expect(page.getByText('로딩 중…')).toHaveCount(0, { timeout: 60000 });

  const runId = Date.now();
  const title = `선택편집할일 ${runId}`;
  const addBtn = page.getByRole('button', { name: '추가' }).first();
  await addBtn.click();
  const draftInput = page.getByPlaceholder('할 일');
  await draftInput.fill(title);
  await draftInput.press('Enter');
  await expect(page.getByPlaceholder('할 일')).toHaveCount(0, { timeout: 10000 });

  const todoInput = page.locator(`[data-testid="todo-title"][data-editing="false"][value="${title}"]`).first();
  await expect(todoInput).toBeVisible({ timeout: 10000 });

  // 단일 클릭은 선택만 하고 읽기 전용을 유지한다.
  await todoInput.click();
  await expect(todoInput).toHaveAttribute('data-editing', 'false');
  await expect(todoInput).toHaveAttribute('readonly', '');

  // DB에 남은 이전 실행분과 구분되도록 해당 행의 todo id를 고정한다.
  const todoId = await todoInput.getAttribute('data-todo-id');
  const rowInput = page.locator(`[data-testid="todo-title"][data-todo-id="${todoId}"]`);
  // Enter로 편집 진입 후 저장한다.
  // (입력 엘리먼트에 포커스된 상태의 키 입력이므로 별도 focus() 불필요)
  const nextTitle = `${title}-수정`;
  await page.keyboard.press('Enter');
  await expect(rowInput).toHaveAttribute('data-editing', 'true');
  await rowInput.fill(nextTitle);
  await page.keyboard.press('Enter');
  await expect(
    page.locator(`[data-testid="todo-title"][value="${nextTitle}"]`).first(),
  ).toBeVisible({ timeout: 10000 });
});
