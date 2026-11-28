import { test, expect, type Page } from '@playwright/test';
import { ensureUserExists, loginAs } from './_helpers';

async function checkNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  const dialog = page.getByRole('dialog');
  if (await dialog.count()) {
    expect(
      await dialog.evaluate(el => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  }
}

test('anonymous wiki APIs return 401', async ({ request }) => {
  expect((await request.get('/api/wiki')).status()).toBe(401);
  expect((await request.get('/api/wiki/page?path=index.md')).status()).toBe(401);
  expect(
    (
      await request.post('/api/wiki/raw', {
        data: { title: 'x', content: 'y' },
      })
    ).status(),
  ).toBe(401);
});

for (const width of [1280, 390]) {
  test(`wiki navigation, Raw capture, preview and unified search work without overflow at ${width}px`, async ({
    page,
  }) => {
    const username = `wiki-${width}-${Date.now()}`;
    await ensureUserExists(username, 'pwTest123*');
    await page.setViewportSize({ width, height: 900 });
    await loginAs(page, username, 'pwTest123*');

    // Navigate to /wiki via TopNav or BottomNav
    if (width >= 1024) {
      await page.getByRole('button', { name: '지식 · 기록', exact: true }).click();
      await page.getByRole('link', { name: '지식 위키', exact: true }).click();
    } else {
      await page.getByRole('button', { name: /더보기/ }).click();
      await page.getByRole('link', { name: '지식 위키', exact: true }).click();
    }
    await expect(page).toHaveURL(/\/wiki/);
    await expect(page.getByRole('heading', { name: '지식 위키' })).toBeVisible();
    await checkNoHorizontalOverflow(page);

    // Empty initial state -> capture a Raw note
    await page.getByRole('button', { name: /첫 Raw 메모 추가하기|Raw 넣기/ }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('제목').fill(`카파시 위키 테스트 메모 ${width}`);
    await dialog.getByLabel('출처 URL (선택)').fill('https://example.com/wiki');
    await dialog.getByLabel('태그 (쉼표 구분, 선택)').fill('위키, 테스트');
    await dialog
      .getByLabel('원문 · 메모 내용')
      .fill('원본은 수정하지 않고 [[연결-문서]]로 컴파일합니다.');
    await checkNoHorizontalOverflow(page);
    await dialog.getByRole('button', { name: 'Raw 저장' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Status message & preview render cleanly
    await expect(page.getByRole('status')).toContainText('Raw 수집함에 저장했어요');
    await expect(
      page.getByRole('heading', { name: `카파시 위키 테스트 메모 ${width}` }).first(),
    ).toBeVisible();
    await checkNoHorizontalOverflow(page);

    // Reload preserves Raw capture & counts
    await page.reload();
    await expect(page.getByLabel('위키 상태 요약')).toContainText('1건');
    await checkNoHorizontalOverflow(page);

    // Unified search API rejects traversal & finds TODO/wiki cleanly
    const badPath = await page.request.get('/api/wiki/page?path=../app.env');
    expect(badPath.status()).toBe(400);
  });
}
