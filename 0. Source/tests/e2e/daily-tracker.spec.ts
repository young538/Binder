import { test, expect } from '@playwright/test';
import { ensureUserExists, loginAs, resetDb } from './_helpers';

test.beforeAll(async () => {
  await ensureUserExists('e2e-daily-tracker', 'pwTest123*');
});

test('daily page loads, seeds preset habits, and keeps per-date checks', async ({ page }) => {
  await resetDb(page);
  await loginAs(page, 'e2e-daily-tracker', 'pwTest123*');

  await page.goto('/daily');
  await expect(page).toHaveURL(/\/daily\/\d{4}-\d{2}-\d{2}/);

  // Clear habits left over from prior runs so the empty state is visible.
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

  await expect(page.getByText('고정 루틴을 준비해 볼까요?')).toBeVisible();

  await page.getByRole('button', { name: '9월 트래커 루틴 추가' }).click();
  await expect(page.getByText('오늘의 고정 루틴')).toBeVisible();

  const progressRegion = page
    .locator('section')
    .filter({ hasText: '오늘의 고정 루틴' })
    .first();
  await expect(progressRegion.getByText('/ 7')).toBeVisible();

  const readingRow = page.getByRole('button', { name: /독서 완료/ });
  await readingRow.click();

  await expect(progressRegion.getByText('/ 7')).toBeVisible();
  await expect(page.getByRole('button', { name: /독서 완료 취소/ })).toHaveCount(1);

  await page.reload();
  await expect(page.getByRole('button', { name: /독서 완료 취소/ })).toBeVisible();

  await page.getByLabel('다음 날').click();
  // 클라이언트 전환 커밋을 확실히 기다린다(오늘 돌아가기 링크는 오늘이 아닐 때만 노출).
  await expect(page.getByRole('link', { name: '오늘로 돌아가기' })).toBeVisible();
  await expect(page.getByRole('button', { name: /독서 완료/ })).toBeVisible();

  await page.getByLabel('이전 날').click();
  await expect(page.getByRole('link', { name: '오늘로 돌아가기' })).toBeHidden();
  await expect(page.getByRole('button', { name: /독서 완료 취소/ })).toBeVisible();

  // 루틴 시트에서 순서 변경 → 일일 목록과 새로고침 이후까지 유지되는지 확인
  await page.getByRole('button', { name: '루틴 관리' }).click();
  await expect(page.locator('input[type="color"]').first()).toBeVisible();
  // 드래그 앤 드롭: 두 번째(명상) 항목을 첫 번째로 이동
  const handles = page.locator('[data-drag-handle]');
  const firstBox = await handles.nth(0).boundingBox();
  const secondBox = await handles.nth(1).boundingBox();
  if (!firstBox || !secondBox) throw new Error('드래그 손잡이를 찾을 수 없습니다');
  await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.getByLabel('닫기').click();
  await expect
    .poll(async () => {
      const labels = await page.evaluate(() =>
        [...document.querySelectorAll('button[aria-label]')]
          .map((b) => b.getAttribute('aria-label') ?? '')
          .filter((l) => l.includes('완료')),
      );
      return labels[0];
    }, { timeout: 10_000 })
    .toContain('명상/묵상');

  await page.reload();
  await expect(page.getByRole('button', { name: '루틴 관리' })).toBeVisible();
  const afterReload = await page.evaluate(() =>
    [...document.querySelectorAll('button[aria-label]')]
      .map((b) => b.getAttribute('aria-label') ?? '')
      .filter((l) => l.includes('완료')),
  );
  expect(afterReload[0]).toContain('명상/묵상');

  await page.goto('/daily/not-a-date');
  await expect(page).toHaveURL(/\/daily\/\d{4}-\d{2}-\d{2}/);
});

test('routine category can be cleared to none and persists', async ({ page }) => {
  await resetDb(page);
  await loginAs(page, 'e2e-daily-tracker', 'pwTest123*');

  await page.goto('/daily');
  await expect(page).toHaveURL(/\/daily\/\d{4}-\d{2}-\d{2}/);

  // 루틴 시트 열기 (기존 루틴이 없으면 프리셋으로 준비)
  await page.getByRole('button', { name: '루틴 관리' }).click();
  await expect(page.locator('input[type="color"]').first()).toBeVisible({ timeout: 10000 });
  const habitRows = page.locator('section').filter({ hasText: '습관' }).locator('li');
  if ((await habitRows.count()) === 0) {
    await page.getByRole('button', { name: '추가' }).first().click();
    await expect(page.locator('input[type="color"]').first()).toBeVisible({ timeout: 10000 });
  }

  // 첫 루틴에 카테고리 지정 → API 반영 확인
  const categorySelect = page.locator('select[title="카테고리"]').first();
  await expect(categorySelect.locator('option').nth(1)).toBeAttached({ timeout: 10000 });
  const categoryId = (await categorySelect.locator('option').nth(1).getAttribute('value'))!;
  await categorySelect.selectOption(categoryId);
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const res = await fetch('/api/habits');
          const rows = (await res.json()) as Array<{ categoryId: string | null }>;
          return rows[0]?.categoryId ?? null;
        }),
      { timeout: 10000 },
    )
    .toBe(categoryId);

  // "카테고리 없음"으로 해제 → API에서 null 확인
  await categorySelect.selectOption('');
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const res = await fetch('/api/habits');
          const rows = (await res.json()) as Array<{ categoryId: string | null }>;
          return rows.length ? rows[0]?.categoryId : 'empty';
        }),
      { timeout: 10000 },
    )
    .toBeNull();

  // 시트 닫고 새로고침해도 해제 유지
  await page.getByLabel('닫기').click();
  await page.reload();
  const afterReload = await page.evaluate(async () => {
    const res = await fetch('/api/habits');
    const rows = (await res.json()) as Array<{ categoryId: string | null }>;
    return rows[0]?.categoryId ?? null;
  });
  expect(afterReload).toBeNull();
});

test('removed daily memo stays in storage and free memo remains editable', async ({ page }) => {
  await loginAs(page, 'e2e-daily-tracker', 'pwTest123*');
  const date = '2026-09-06';
  const legacyText = `보존할 이전 메모 ${Date.now()}`;
  const response = await page.request.put('/api/focus-notes', { data: { scope: 'day', scopeKey: date, text: legacyText } });
  expect(response.ok()).toBeTruthy();
  await page.goto(`/daily/${date}`);
  await expect(page.getByLabel('일일 메모')).toHaveCount(0);
  const freeMemo = page.getByRole('region', { name: '하루 기록', exact: true }).getByRole('textbox', { name: '✍️ 자유 메모', exact: true });
  const text = `하루 기록에서 작성한 메모 ${Date.now()}`;
  await freeMemo.fill(text);
  await expect.poll(async () => (await (await page.request.get(`/api/retrospectives?type=daily&dateOrWeek=${date}`)).json())?.freeText).toBe(text);
  await page.reload();
  await expect(freeMemo).toHaveValue(text);
  expect((await (await page.request.get(`/api/focus-notes?scope=day&scopeKey=${date}`)).json()).text).toBe(legacyText);
});

test('daily reading saves book, pages, memo per date', async ({ page }) => {
  await resetDb(page);
  await loginAs(page, 'e2e-daily-tracker', 'pwTest123*');

  await page.goto('/daily');
  await expect(page).toHaveURL(/\/daily\/\d{4}-\d{2}-\d{2}/);
  const today = page.url().match(/\/daily\/(\d{4}-\d{2}-\d{2})/)![1];
  const stamp = Date.now();
  const pages = 10 + (stamp % 5);

  // 독서 리스트에 책 한 권 준비 (연동 select 검증용)
  const bookTitle = `읽는 책 ${stamp}`;
  const createdBookId = await page.evaluate(async (title) => {
    const year = new Date().getFullYear().toString();
    const res = await fetch('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, order: 1, title }),
    });
    const row = (await res.json()) as { id: string };
    return row.id;
  }, bookTitle);

  // 새로고침으로 올해 책 목록을 다시 읽은 뒤, 기본으로 펼쳐진 폼에 입력
  await page.reload();
  const bookSelect = page.locator(`#daily-reading-book-${today}`);
  await bookSelect.selectOption(createdBookId);
  await page.locator(`#daily-reading-pages-${today}`).fill(String(pages));
  await page.locator(`#daily-reading-memo-${today}`).fill(`p.${pages} 인상 깊었음 ${stamp}`);
  await page.waitForTimeout(2500);

  // API(retrospectives daily template.reading)에 날짜별로 저장됐는지 확인
  const saved = await page.evaluate(async (date) => {
    const res = await fetch(`/api/retrospectives?type=daily&dateOrWeek=${date}`);
    const row = (await res.json()) as { template?: { reading?: string } } | null;
    return row?.template?.reading ? (JSON.parse(row.template.reading) as Record<string, unknown>) : null;
  }, today);
  expect(saved?.bookId).toBe(createdBookId);
  expect(saved?.bookTitle).toBe(bookTitle);
  expect(saved?.pages).toBe(pages);
  expect(String(saved?.memo)).toContain('인상 깊었음');

  // 새로고침 후에도 유지 + 펼쳐진 상태의 요약과 입력값 표시
  await page.reload();
  await expect(page.getByRole('button', { name: '독서 기록 접기' })).toBeVisible();
  await expect(page.getByText(new RegExp(`${bookTitle}.*${pages}쪽`))).toBeVisible();
  await expect(page.locator(`#daily-reading-pages-${today}`)).toHaveValue(String(pages));
  await expect(page.locator(`#daily-reading-memo-${today}`)).toHaveValue(/인상 깊었음/);

  // 다른 날짜에는 비어 있음 (날짜별 격리)
  await page.getByLabel('다음 날').click();
  await expect(page.getByRole('link', { name: '오늘로 돌아가기' })).toBeVisible();
  const nextDate = page.url().match(/\/daily\/(\d{4}-\d{2}-\d{2})/)![1];
  await expect(page.locator(`#daily-reading-memo-${nextDate}`)).toHaveValue('');
});
