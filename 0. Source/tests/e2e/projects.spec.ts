import { test, expect, type Page } from '@playwright/test';
import { ensureUserExists, loginAs } from './_helpers';

async function setup(page: Page, width: number, suffix: string) {
  const username = `proj-${width}-${suffix}-${Date.now()}`;
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
  test(`project creation, next-action warning, goal inheritance and daily sync at ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    await setup(page, width, 'flow');

    const goal = await (
      await page.request.post('/api/goals', {
        data: { title: '서비스 런칭 목표', level: 'oneThing', order: 0 },
      })
    ).json();
    await page.reload();

    if (width >= 1024) {
      await page.getByRole('link', { name: '프로젝트', exact: true }).click();
    } else {
      await page.getByRole('button', { name: '더보기' }).click();
      await page.getByRole('link', { name: '프로젝트', exact: true }).click();
    }
    await expect(page).toHaveURL(/\/projects$/);
    await checkNoHorizontalOverflow(page);

    await page.getByRole('button', { name: '새 프로젝트' }).click();
    await checkNoHorizontalOverflow(page);
    await page.getByLabel('프로젝트 제목').fill('인생 OS 1단계 출시');
    await page.getByLabel('프로젝트 상위 목표').selectOption(goal.id);
    await page.getByLabel('완료 기준').fill('프로젝트 보드와 일일 할 일 연동');
    await page.getByLabel('프로젝트 메모').fill('핵심 실행 루프 검증');
    await page.getByRole('button', { name: '프로젝트 만들기', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const card = page.locator('article').filter({ has: page.getByRole('heading', { name: '인생 OS 1단계 출시' }) });
    await expect(card).toContainText('다음 행동 필요');
    await expect(card).toContainText('🎯 서비스 런칭 목표');
    await checkNoHorizontalOverflow(page);

    await card.getByRole('button', { name: '오늘 할 일 추가' }).click();
    await card.getByRole('textbox', { name: '새 할 일' }).fill('E2E 시나리오 통과 확인');
    await card.getByRole('textbox', { name: '새 할 일' }).press('Enter');

    await expect(card).not.toContainText('다음 행동 필요');
    await expect(card).toContainText('할 일 0/1 완료');

    await card.getByRole('link', { name: '오늘', exact: true }).click();
    await expect(page).toHaveURL(/\/daily\/\d{4}-\d{2}-\d{2}$/);
    await expect(page.getByText('📁 인생 OS 1단계 출시')).toBeVisible();
    await expect(page.getByText('🎯 서비스 런칭 목표')).toBeVisible();
    await checkNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'E2E 시나리오 통과 확인 상세 설정' }).click();
    await expect(page.getByLabel('연결 프로젝트')).not.toHaveValue('');
    await expect(page.getByLabel('연결 목표')).toHaveValue(goal.id);
    await page.getByLabel('연결 목표').selectOption('');
    await page.getByRole('button', { name: '설정 저장' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('📁 인생 OS 1단계 출시')).toBeVisible();
    await expect(page.getByText('🎯 서비스 런칭 목표')).toHaveCount(0);
  });
}

test('project endpoints reject anonymous access', async ({ request }) => {
  for (const path of ['/api/projects', '/api/projects/overview']) {
    expect((await request.get(path)).status()).toBe(401);
  }
  expect((await request.post('/api/projects', { data: { title: 'x', status: 'active', order: 0 } })).status()).toBe(401);
  expect((await request.patch('/api/projects/unknown', { data: { title: 'y' } })).status()).toBe(401);
  expect((await request.delete('/api/projects/unknown')).status()).toBe(401);
});
