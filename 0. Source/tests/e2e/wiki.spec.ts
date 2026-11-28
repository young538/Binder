import fs from 'node:fs';
import path from 'node:path';
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
  test(`wiki navigation, Raw capture, global & local graph view work without overflow at ${width}px`, async ({
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

    // Seed two compiled linked wiki pages into this user's isolated E2E wiki dir
    const meRes = await page.request.get('/api/auth/me');
    const me = (await meRes.json()) as { userId: string };
    const e2eDbDir = path.dirname(
      process.env.BINDER_E2E_DATABASE ??
        path.resolve('test-results', process.env.BINDER_E2E_RUN_ID ?? '', 'e2e.sqlite'),
    );
    const userWikiDir = path.join(e2eDbDir, 'wiki', '.users', me.userId);
    fs.mkdirSync(path.join(userWikiDir, 'wiki', 'life'), { recursive: true });
    fs.mkdirSync(path.join(userWikiDir, 'wiki', 'topics'), { recursive: true });
    fs.writeFileSync(
      path.join(userWikiDir, 'wiki', 'life', '목표-노트.md'),
      '---\ntitle: 목표 노트\ncategory: life\nupdated: 2026-11-28\nsummary: 핵심 목표 요약\n---\n\n[[개념-노트]] 와 [[미작성-항목]] 연결\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(userWikiDir, 'wiki', 'topics', '개념-노트.md'),
      '---\ntitle: 개념 노트\ncategory: topics\nupdated: 2026-11-28\nsummary: 주제 개념 정리\n---\n\n[[목표-노트]] 에서 참조됨\n',
      'utf8',
    );

    await page.goto('/wiki');
    await expect(page.getByLabel('위키 상태 요약')).toContainText('2개');
    await expect(page.getByRole('img', { name: '현재 문서 로컬 그래프' })).toBeVisible();
    await checkNoHorizontalOverflow(page);

    // Switch to Global Graph view and navigate to node via preview card
    await page.getByRole('tab', { name: '그래프 보기' }).click();
    const globalSvg = page.getByRole('img', { name: '위키 연결 그래프' });
    await expect(globalSvg).toBeVisible();
    await checkNoHorizontalOverflow(page);

    // Toggle unresolved links ON -> 미작성-항목 appears
    const unresolvedBtn = page.getByRole('button', { name: '미작성 링크', exact: true });
    await unresolvedBtn.click();
    await expect(unresolvedBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(
      globalSvg.getByRole('button', { name: /미작성-항목/ }),
    ).toBeVisible();

    // Select '개념 노트' node -> preview card -> '문서 열기'
    await globalSvg.getByRole('button', { name: /개념 노트/ }).click();
    const previewCard = page.getByLabel('선택한 그래프 노드 정보');
    await expect(previewCard).toContainText('주제 개념 정리');
    await previewCard.getByRole('button', { name: '문서 열기' }).click();

    await expect(page.getByRole('heading', { name: '개념 노트' })).toBeVisible();
    await expect(page.getByRole('img', { name: '현재 문서 로컬 그래프' })).toBeVisible();
    await checkNoHorizontalOverflow(page);

    // Bad path rejected cleanly
    const badPath = await page.request.get('/api/wiki/page?path=../app.env');
    expect(badPath.status()).toBe(400);
  });
}
