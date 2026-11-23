import { test, expect, type Page } from '@playwright/test';
import { parseISO } from 'date-fns';
import { ensureUserExists, loginAs } from './_helpers';
import { toIsoWeek } from '@/lib/utils/date';

async function setup(page: Page, width: number, suffix: string) {
  const username = `lifeos-${width}-${suffix}-${Date.now()}`;
  await ensureUserExists(username, 'pwTest123*');
  await page.setViewportSize({ width, height: 900 });
  await loginAs(page, username, 'pwTest123*');
  const res = await page.request.get('/api/categories');
  return (await res.json())[0].id as string;
}

async function checkNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const dialog = page.getByRole('dialog');
  if (await dialog.count()) {
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
}

for (const width of [1280, 390]) {
  test(`life OS daily checkin, actual confirm, shutdown, retro principle, metrics, life hub and Ctrl+K at ${width}px`, async ({ page }) => {
    test.setTimeout(150000);
    const categoryId = await setup(page, width, 'full');

    await page.goto('/daily');
    await expect(page).toHaveURL(/\/daily\/\d{4}-\d{2}-\d{2}$/);
    const today = page.url().match(/\/daily\/(\d{4}-\d{2}-\d{2})$/)![1];

    // Seed a plan block and a pending TODO for today.
    await page.request.post('/api/time-blocks', {
      data: {
        date: today,
        startMin: 540,
        endMin: 600,
        text: 'OS 핵심 집중',
        kind: 'plan',
        categoryId,
      },
    });
    await page.request.post('/api/todos', {
      data: {
        title: '이월할 일일 작업',
        scope: 'day',
        scopeKey: today,
        status: 'pending',
        order: 0,
      },
    });

    await page.reload();
    await checkNoHorizontalOverflow(page);

    // 1) 10-second condition check-in
    const sleepInput = page.getByLabel('수면 시간', { exact: true });
    await sleepInput.fill('7.5');
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/daily-checkins') && r.request().method() === 'PUT' && r.status() === 200),
      sleepInput.blur(),
    ]);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/daily-checkins') && r.request().method() === 'PUT' && r.status() === 200),
      page.getByRole('button', { name: '에너지 4', exact: true }).click(),
    ]);
    const moodInput = page.getByLabel('컨디션 메모', { exact: true });
    await moodInput.fill('몰입 좋음');
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/daily-checkins') && r.request().method() === 'PUT' && r.status() === 200),
      moodInput.blur(),
    ]);

    // 2) Confirm plan -> actual
    await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/api/time-blocks/confirm-actuals') && r.status() === 200),
      page.getByRole('button', { name: /계획 → 실제 확정/ }).click(),
    ]);
    await expect(page.getByText('계획 1시간 · 실제 1시간')).toBeVisible();

    // 3) Evening shutdown
    const shutdownBanner = page.getByRole('region', { name: '이브닝 셧다운 배너' });
    await shutdownBanner.getByRole('button', { name: '저녁 마감 시작' }).click();
    const shutdownDialog = page.getByRole('dialog');
    await expect(shutdownDialog).toBeVisible();
    await checkNoHorizontalOverflow(page);
    await shutdownDialog.getByRole('button', { name: '내일로', exact: true }).click();
    await expect(shutdownDialog.getByRole('tab', { name: /2\. 남은 할 일 \(0\)/ })).toBeVisible();
    await shutdownDialog.getByRole('button', { name: '다음 단계 →' }).click();
    await shutdownDialog.getByRole('button', { name: '하루 마감 완료' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(shutdownBanner).toContainText('하루 마감 완료');

    await page.reload();
    await expect(page.getByLabel('수면 시간', { exact: true })).toHaveValue('7.5');
    await expect(page.getByRole('button', { name: '에너지 4', exact: true })).toHaveAttribute('aria-pressed', 'true');

    // 4) Retro navigation + monthly/yearly + promote to principle
    await page.goto('/retrospective/week/2026-W47');
    await expect(page.getByRole('link', { name: '이전 주간 회고' })).toHaveAttribute('href', '/retrospective/week/2026-W46');
    await page.getByRole('navigation', { name: '회고 기간 단위' }).getByRole('link', { name: '월간', exact: true }).click();
    await expect(page).toHaveURL(/\/retrospective\/month\/\d{4}-\d{2}$/);
    await checkNoHorizontalOverflow(page);

    await page.getByRole('textbox', { name: /좋았던 것/ }).fill('하루 90분 딥워크 유지하기');
    await page.getByRole('button', { name: '내 원칙으로 남기기' }).click();
    await page.getByLabel('원칙 제목').fill('아침 90분 딥워크 원칙');
    await page.getByRole('button', { name: '노트 저장' }).click();
    await expect(page.getByRole('link', { name: '노트에서 보기' })).toBeVisible();
    await page.getByRole('link', { name: '노트에서 보기' }).click();
    await expect(page).toHaveURL(/\/notes\?note=/);
    await expect(page.getByRole('heading', { name: '아침 90분 딥워크 원칙' })).toBeVisible();
    await checkNoHorizontalOverflow(page);

    await page.goto('/retrospective/year/2026');
    await expect(page.getByRole('heading', { name: /2026년/ })).toBeVisible();

    // 5) Metrics tracker
    await page.goto('/metrics');
    await checkNoHorizontalOverflow(page);
    await page.getByRole('button', { name: '새 지표' }).click();
    await page.getByLabel('지표 이름').fill('체중트래킹');
    await page.getByLabel('지표 단위').fill('kg');
    await page.getByLabel('목표 수치').fill('70');
    await page.getByRole('dialog').getByRole('button', { name: '지표 만들기' }).click();
    await expect(page.getByRole('heading', { name: '체중트래킹' })).toBeVisible();
    await page.getByLabel('체중트래킹 수치').fill('74.5');
    await page.getByRole('button', { name: '기록', exact: true }).click();
    await expect(page.getByText('74.5 kg')).toBeVisible();
    await expect(page.getByRole('img', { name: '체중트래킹 추세 그래프' })).toBeVisible();

    // 6) Life hub (.ics import + personal CRM)
    await page.goto('/life');
    await checkNoHorizontalOverflow(page);
    await page.getByRole('button', { name: '.ics 가져오기' }).click();
    await page.getByLabel('ICS 텍스트').fill(
      ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:e2e-ics-1', 'SUMMARY:정기 건강검진', 'DTSTART;VALUE=DATE:20261205', 'END:VEVENT', 'END:VCALENDAR'].join('\n'),
    );
    await page.getByRole('button', { name: '일정 가져오기' }).click();
    await expect(page.getByRole('heading', { name: '정기 건강검진' })).toBeVisible();

    await page.getByRole('button', { name: '새 일정 · D-Day' }).click();
    await page.getByLabel('일정 제목').fill('구글연동미팅');
    await page.getByLabel('일정 날짜').fill(today);
    await page.getByLabel('종일 일정').uncheck();
    await page.getByLabel('일정 시작 시각').fill('10:00');
    await page.getByLabel('일정 종료 시각').fill('11:00');
    await page.getByRole('dialog').getByRole('button', { name: '일정 추가' }).click();
    await expect(page.getByRole('heading', { name: '구글연동미팅' })).toBeVisible();

    await page.getByRole('tab', { name: /소중한 사람/ }).click();
    await page.getByRole('button', { name: '사람 추가' }).click();
    await page.getByLabel('이름', { exact: true }).fill('어머니');
    await page.getByLabel('안부 주기').fill('7');
    await page.getByRole('dialog').getByRole('button', { name: '추가', exact: true }).click();
    await expect(page.getByRole('heading', { name: '어머니' })).toBeVisible();
    await page.getByRole('button', { name: '오늘 안부 완료' }).click();
    await expect(page.getByRole('status')).toContainText('어머니님 안부 연락을');

    // 7) Ctrl+K Command Palette quick capture + search jump
    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog');
    await expect(palette).toBeVisible();
    await checkNoHorizontalOverflow(page);
    await palette.getByLabel('커맨드 또는 검색어 입력').fill('팔레트 수집 작업');
    await palette.getByRole('option', { name: /수집함에 할 일 추가/ }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.goto('/inbox');
    await expect(page.getByTestId('todo-title').filter({ hasText: '팔레트 수집 작업' })).toBeVisible();

    await page.keyboard.press('Control+k');
    await page.getByLabel('커맨드 또는 검색어 입력').fill('체중트래킹');
    await page.getByRole('option', { name: /^체중트래킹/ }).click();
    await expect(page).toHaveURL(/\/metrics$/);

    await page.goto('/subscriptions');
    await page.getByRole('button', { name: '새 구독' }).click();
    await page.getByLabel('서비스명').fill('ChatGPT Plus');
    await page.getByLabel('결제 금액').fill('29000');
    await page.getByLabel('결제 통화').selectOption('KRW');
    await page.getByLabel('결제 주기').selectOption('monthly');
    await page.getByLabel('다음 결제일').fill('2026-12-01');
    await page.getByLabel('결제일 (매월 일자)').fill('1');
    await page.getByRole('button', { name: '구독 등록', exact: true }).click();
    await expect(page.getByText('ChatGPT Plus')).toBeVisible();

    await page.getByRole('button', { name: '새 구독' }).click();
    await page.getByLabel('서비스명').fill('Notion 연간');
    await page.getByLabel('결제 금액').fill('120000');
    await page.getByLabel('결제 통화').selectOption('KRW');
    await page.getByLabel('결제 주기').selectOption('yearly');
    await page.getByRole('button', { name: '구독 등록', exact: true }).click();
    await expect(page.getByText('Notion 연간')).toBeVisible();

    const kpi = page.getByLabel('구독 요약 지표');
    await expect(kpi.getByText('₩39,000')).toBeVisible();
    await expect(kpi.getByText('₩468,000')).toBeVisible();

    await page.getByRole('button', { name: '다음 결제일로 갱신' }).first().click();
    await expect(page.getByRole('status')).toContainText('2027-01-01');
    await expect(page.getByText('다음 결제 2027-01-01')).toBeVisible();

    await page.reload();
    await expect(page.getByText('다음 결제 2027-01-01')).toBeVisible();
    await expect(kpi.getByText('₩39,000')).toBeVisible();
    await expect(kpi.getByText('₩468,000')).toBeVisible();
    await checkNoHorizontalOverflow(page);

    // 8) Calendar overlay in /daily time grid -> 1-click import to plan block + /settings Google panel
    await page.goto(`/daily/${today}`);
    const eventOverlay = page.getByTestId('calendar-event-overlay').filter({ hasText: '구글연동미팅' });
    await expect(eventOverlay).toBeVisible();
    await eventOverlay.click();
    const blockDialog = page.getByRole('dialog');
    await expect(blockDialog.getByPlaceholder('내용')).toHaveValue('구글연동미팅');
    await blockDialog.getByRole('button', { name: '저장' }).click();
    await expect(page.getByTestId('time-block').filter({ hasText: '구글연동미팅' })).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('time-block').filter({ hasText: '구글연동미팅' })).toBeVisible();
    await checkNoHorizontalOverflow(page);

    // 9) Life OS Dashboard (/dashboard) at both 1280px & 390px
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: '인생 OS 대시보드' })).toBeVisible();
    await expect(page.getByLabel('대시보드 핵심 지표')).toContainText('₩39,000');
    await expect(page.getByText('구글연동미팅').first()).toBeVisible();
    await expect(page.getByRole('img', { name: '체중트래킹 추세 그래프' })).toBeVisible();
    await checkNoHorizontalOverflow(page);

    // 10) AI Weekly Retro Coach (/retrospective/week/[isoweek])
    const currentWeek = toIsoWeek(parseISO(today));
    await page.goto(`/retrospective/week/${currentWeek}`);
    const coach = page.getByRole('region', { name: 'AI 회고 코치' });
    await coach.getByRole('button', { name: '회고 초안 생성' }).click();
    await expect(coach.getByText('데이터 패턴 분석')).toBeVisible();
    await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/retrospectives') && !r.url().includes('/coach') && r.request().method() === 'PUT' && r.status() === 200,
      ),
      coach.getByRole('button', { name: '회고에 초안 채우기' }).click(),
    ]);
    await expect(coach.getByText('초안을 회고 입력란에 반영했어요.')).toBeVisible();
    await expect(page.getByRole('textbox', { name: /좋았던 것/ })).not.toHaveValue('');
    await page.reload();
    await expect(page.getByRole('textbox', { name: /좋았던 것/ })).not.toHaveValue('');
    await checkNoHorizontalOverflow(page);

    // 11) /settings Google panel + password change UI & relogin
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Google 캘린더 양방향 연동' })).toBeVisible();
    await expect(page.getByRole('button', { name: '복사' })).toBeVisible();

    const meRes = await page.request.get('/api/auth/me');
    const currentUsername = (await meRes.json()).username as string;
    const accountSection = page.locator('section').filter({ has: page.getByRole('heading', { name: '계정' }) });

    await accountSection.getByRole('button', { name: '비밀번호 변경' }).click();
    await accountSection.getByLabel('현재 비밀번호').fill('wrong-pw-check');
    await accountSection.getByLabel('새 비밀번호', { exact: true }).fill('newPwTest456*');
    await accountSection.getByLabel('새 비밀번호 확인').fill('newPwTest456*');
    await accountSection.getByRole('button', { name: '비밀번호 저장' }).click();
    await expect(accountSection.getByRole('alert')).toContainText('현재 비밀번호가 올바르지 않아요.');
    await expect(page).toHaveURL(/\/settings/);

    await accountSection.getByLabel('현재 비밀번호').fill('pwTest123*');
    await accountSection.getByRole('button', { name: '비밀번호 저장' }).click();
    await expect(accountSection.getByRole('status')).toContainText('비밀번호를 변경했어요.');
    await checkNoHorizontalOverflow(page);

    await accountSection.getByRole('button', { name: '로그아웃' }).click();
    await expect(page).toHaveURL(/\/login/);
    await loginAs(page, currentUsername, 'newPwTest456*');
    await expect(page).not.toHaveURL(/\/login/);
  });
}

test('top nav fits 1024px desktop without horizontal overflow and rejects anonymous life OS APIs', async ({ page, request }) => {
  await setup(page, 1024, 'nav1024');
  await page.goto('/daily');
  await checkNoHorizontalOverflow(page);

  const privacyRes = await request.get('/privacy');
  expect(privacyRes.status()).toBe(200);
  expect(await privacyRes.text()).toContain('개인정보처리방침');

  for (const url of [
    '/api/daily-checkins?date=2026-11-20',
    '/api/evening-shutdown?date=2026-11-20',
    '/api/dashboard?date=2026-11-20',
    '/api/metrics',
    '/api/notes',
    '/api/people',
    '/api/events',
    '/api/subscriptions',
    '/api/integrations/google/status',
  ]) {
    expect((await request.get(url)).status()).toBe(401);
  }
  expect((await request.post('/api/auth/password', { data: { currentPassword: 'a', newPassword: 'newpassword1' } })).status()).toBe(401);
  expect((await request.post('/api/retrospectives/coach', { data: { mode: 'weekly', period: '2026-W47' } })).status()).toBe(401);
  expect((await request.post('/api/time-blocks/confirm-actuals', { data: { date: '2026-11-20' } })).status()).toBe(401);
  expect((await request.post('/api/events/import-ics', { data: { icsText: 'x' } })).status()).toBe(401);
  expect((await request.post('/api/integrations/google/sync', { data: {} })).status()).toBe(401);
  expect((await request.patch('/api/integrations/google/settings', { data: { syncEnabled: false } })).status()).toBe(401);
  expect((await request.delete('/api/integrations/google/disconnect')).status()).toBe(401);
});
