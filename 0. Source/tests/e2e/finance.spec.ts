import { test, expect, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import officeCrypto from 'officecrypto-tool';
import { ensureUserExists, loginAs } from './_helpers';

async function setup(page: Page, width: number, suffix: string) {
  const username = `fin-${width}-${suffix}-${Date.now()}`;
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

async function createSampleBankSaladXlsx(
  monthPrefix: string,
  includeSignedVariants = false,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('가계부 내역');
  sheet.addRow(['날짜', '시간', '타입', '대분류', '소분류', '내용', '금액', '화폐', '결제수단', '메모']);
  sheet.addRow([`${monthPrefix}-05`, '12:10', '지출', '식비', '외식', '을밀대 평양냉면', -15000, 'KRW', '현대카드', '']);
  if (includeSignedVariants) {
    sheet.addRow([`${monthPrefix}-05`, '12:20', '지출', '식비', '외식', '을밀대 부분취소', 5000, 'KRW', '현대카드', '']);
    sheet.addRow([`${monthPrefix}-06`, '10:00', '이체', '용돈', '', '용돈 입금', 200000, 'KRW', '토스뱅크', '']);
  }
  sheet.addRow([`${monthPrefix}-06`, '09:30', '이체', '내계좌이체', '', '비상금 이동', -100000, 'KRW', '토스뱅크', '']);
  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr as ArrayBuffer);
}

for (const width of [1280, 390]) {
  test(`finance ledger, quick expense, BankSalad Excel import, budgets, nav & dashboard integration at ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    await setup(page, width, 'flow');
    const now = new Date();
    const yyyymm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    await checkNoHorizontalOverflow(page);

    // 1) QuickCapture -> '빠른 지출' tab
    await page.getByRole('button', { name: '빠른 메모', exact: true }).click();
    const quickDialog = page.getByRole('dialog');
    await quickDialog.getByRole('tab', { name: '빠른 지출' }).click();
    await quickDialog.getByLabel('지출 금액').fill('12500');
    await quickDialog.getByLabel('지출 내용').fill('테스트 커피');
    await quickDialog.getByLabel('지출 분류').selectOption('카페/간식');
    await quickDialog.getByRole('button', { name: '지출 저장' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // 2) Navigate to /finance via redesigned TopNav / BottomNav
    if (width >= 1024) {
      await page.getByRole('button', { name: '재무', exact: true }).click();
      await page.getByRole('link', { name: '가계부', exact: true }).click();
    } else {
      await page.locator('nav:visible').getByRole('link', { name: '가계부', exact: true }).click();
    }
    await expect(page).toHaveURL(/\/finance$/);
    await checkNoHorizontalOverflow(page);

    const kpi = page.getByLabel('이번 달 재무 요약');
    await expect(kpi).toContainText('₩12,500');
    await expect(page.getByText('테스트 커피')).toBeVisible();

    // 3) Toggle excluded on transaction -> totals update live
    const toggleExcludedBtn = page.getByRole('button', { name: '테스트 커피 합계 제외 전환' });
    await toggleExcludedBtn.click();
    await expect(toggleExcludedBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(kpi).toContainText('합계 제외 1건');
    await expect(kpi).toContainText('총 지출₩0');

    await toggleExcludedBtn.click();
    await expect(toggleExcludedBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(kpi).toContainText('합계 제외 0건');
    await expect(kpi).toContainText('총 지출₩12,500');

    // 4) Add manual income
    await page.getByRole('button', { name: '거래 추가' }).click();
    const txDialog = page.getByRole('dialog');
    await txDialog.getByRole('button', { name: '수입', exact: true }).click();
    await txDialog.getByLabel('거래 금액').fill('3000000');
    await txDialog.getByLabel('거래 내용').fill('11월 급여');
    await txDialog.getByRole('button', { name: '거래 저장' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(kpi).toContainText('₩3,000,000');

    // 5) Two-step BankSalad .xlsx upload (with refund & +/- transfers) + deduplication check
    const xlsxBuffer = await createSampleBankSaladXlsx(yyyymm, true);
    await page.getByRole('button', { name: '뱅크샐러드 엑셀 가져오기' }).click();
    const importDialog = page.getByRole('dialog');
    const fileInput = importDialog.getByLabel('가계부 엑셀, ZIP 또는 CSV 파일');
    await expect(fileInput).toHaveAttribute('accept', /\.zip/);
    await fileInput.setInputFiles({
      name: 'banksalad_test.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: xlsxBuffer,
    });
    await importDialog.getByRole('button', { name: '파일 미리보기' }).click();
    await expect(importDialog.getByText('을밀대 평양냉면')).toBeVisible();
    await expect(importDialog.getByText('을밀대 부분취소')).toBeVisible();
    await importDialog.getByRole('button', { name: /신규 4건 가져오기 확정/ }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await expect(page.getByText('을밀대 평양냉면')).toBeVisible();
    await expect(page.getByText('을밀대 부분취소')).toBeVisible();
    await expect(page.getByText('취소/환불').first()).toBeVisible();
    await expect(page.getByText('+₩5,000', { exact: true })).toBeVisible();
    await expect(page.getByText('이체 입금').first()).toBeVisible();
    await expect(page.getByText('+₩200,000', { exact: true })).toBeVisible();
    await expect(page.getByText('이체 출금').first()).toBeVisible();
    await expect(page.getByText('-₩100,000', { exact: true })).toBeVisible();
    // 12,500 + 15,000 - 5,000 = 22,500 (transfers excluded from expense total)
    await expect(kpi).toContainText('₩22,500');
    await expect(kpi).toContainText('이체 입금 +₩200,000 · 출금 -₩100,000 (제외)');

    // Re-upload same Excel -> detects 4 duplicates, 0 new rows
    await page.getByRole('button', { name: '뱅크샐러드 엑셀 가져오기' }).click();
    const reimportDialog = page.getByRole('dialog');
    await reimportDialog.getByLabel('가계부 엑셀, ZIP 또는 CSV 파일').setInputFiles({
      name: 'banksalad_test.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: xlsxBuffer,
    });
    await reimportDialog.getByRole('button', { name: '파일 미리보기' }).click();
    await expect(reimportDialog.getByRole('button', { name: /신규 거래 없음/ })).toBeDisabled();
    await reimportDialog.getByRole('button', { name: '닫기', exact: true }).click();

    // 6) Budget tab
    await page.getByRole('tab', { name: /예산 · 분석/ }).click();
    await page.getByLabel('월 총 예산').fill('1500000');
    await page.getByRole('button', { name: '총 예산 저장' }).click();
    await expect(kpi).toContainText('2%');
    await page.reload();
    await expect(kpi).toContainText('₩22,500');
    await checkNoHorizontalOverflow(page);

    // 7) Verify Dashboard & Monthly Retrospective finance summaries
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: new RegExp(`이번 달 가계부 \\(${yyyymm}\\)`) })).toBeVisible();
    await expect(page.getByText('₩22,500').first()).toBeVisible();
    await checkNoHorizontalOverflow(page);

    await page.goto(`/retrospective/month/${yyyymm}`);
    await expect(page.getByText('월간 가계부')).toBeVisible();
    await expect(page.getByText(/지출 ₩22,500/)).toBeVisible();
    await checkNoHorizontalOverflow(page);
  });
}

test('redesigned 1024px TopNav fits without overflow and finance APIs reject anonymous requests', async ({ page, request }) => {
  await setup(page, 1024, 'nav1024');
  await page.goto('/dashboard');
  await checkNoHorizontalOverflow(page);
  await page.goto('/finance');
  await checkNoHorizontalOverflow(page);

  for (const url of ['/api/finance/transactions', '/api/finance/budgets']) {
    expect((await request.get(url)).status()).toBe(401);
  }
  expect((await request.post('/api/finance/transactions', { data: { date: '2026-11-23', kind: 'expense', amount: 1000, currency: 'KRW', category: '식비', merchant: 'x', excluded: false, source: 'manual' } })).status()).toBe(401);
  expect((await request.patch('/api/finance/transactions/unknown', { data: { excluded: true } })).status()).toBe(401);
  expect((await request.delete('/api/finance/transactions/unknown')).status()).toBe(401);
  expect((await request.put('/api/finance/budgets', { data: { yyyymm: 'default', category: '__total__', amount: 1000 } })).status()).toBe(401);
  expect((await request.delete('/api/finance/budgets?id=unknown')).status()).toBe(401);
  expect((await request.post('/api/finance/import')).status()).toBe(401);
  expect((await request.post('/api/finance/sync-subscriptions', { data: {} })).status()).toBe(401);
  expect((await request.get('/api/finance/automation')).status()).toBe(401);
  expect((await request.post('/api/finance/automation', { data: { action: 'issue_token' } })).status()).toBe(401);
  expect((await request.patch('/api/finance/automation', { data: { enabled: true } })).status()).toBe(401);
  expect((await request.post('/api/finance/import/automation', { data: {} })).status()).toBe(401);
});

for (const width of [1280, 390]) {
  test(`finance Gmail agent automation token, encrypted Excel upload & telemetry at ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    await setup(page, width, 'auto');
    const now = new Date();
    const yyyymm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    await page.goto('/finance');
    await checkNoHorizontalOverflow(page);

    // 1) Open Gmail automation dialog, issue token, and verify agent-only UI + zero overflow
    await page.getByRole('button', { name: /Gmail 자동 연동/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).not.toContainText('Apps Script');
    await expect(dialog).not.toContainText('Code.gs');
    await checkNoHorizontalOverflow(page);

    await dialog.getByRole('button', { name: '토큰 발급' }).click();
    const tokenEl = dialog.locator('div.font-mono.break-all');
    await expect(tokenEl).toContainText(/^bfi_[0-9a-f]{48}$/);
    const issuedToken = (await tokenEl.textContent())?.trim() ?? '';
    expect(issuedToken).toMatch(/^bfi_[0-9a-f]{48}$/);

    // 2) Save fixed Excel password
    await dialog.getByLabel('고정 엑셀 비밀번호').fill('bank-secret-123');
    await dialog.getByRole('button', { name: '비밀번호 저장' }).click();
    await expect(dialog.getByText('저장됨', { exact: true })).toBeVisible();
    await checkNoHorizontalOverflow(page);

    await dialog.getByRole('button', { name: '닫기', exact: true }).last().click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // 3) Send encrypted BankSalad .xlsx via external Bearer endpoint (simulating local agent upload)
    const plainBuffer = await createSampleBankSaladXlsx(yyyymm);
    const encryptedBuffer = officeCrypto.encrypt(plainBuffer, { password: 'bank-secret-123' });

    const invalidAuth = await page.request.post('/api/finance/import/automation', {
      headers: { Authorization: 'Bearer bfi_wrongtoken0000000000000000000000' },
      data: { fileName: '뱅크샐러드_자동.xlsx', fileBase64: encryptedBuffer.toString('base64') },
    });
    expect(invalidAuth.status()).toBe(401);

    const firstPush = await page.request.post('/api/finance/import/automation', {
      headers: { Authorization: `Bearer ${issuedToken}` },
      data: {
        fileName: '뱅크샐러드_자동.xlsx',
        fileBase64: encryptedBuffer.toString('base64'),
        mode: 'commit',
      },
    });
    expect(firstPush.status()).toBe(200);
    expect(await firstPush.json()).toMatchObject({
      ok: true,
      mode: 'commit',
      inserted: 2,
      duplicates: 0,
    });

    // Re-send same file -> deduplicates cleanly
    const secondPush = await page.request.post('/api/finance/import/automation', {
      headers: { Authorization: `Bearer ${issuedToken}` },
      data: {
        fileName: '뱅크샐러드_자동.xlsx',
        fileBase64: encryptedBuffer.toString('base64'),
        mode: 'commit',
      },
    });
    expect(secondPush.status()).toBe(200);
    expect(await secondPush.json()).toMatchObject({
      ok: true,
      mode: 'commit',
      inserted: 0,
      duplicates: 2,
    });

    // 4) Reload /finance -> transactions appear and dialog displays last automation telemetry
    await page.reload();
    await expect(page.getByText('을밀대 평양냉면')).toBeVisible();
    await page.getByRole('button', { name: /Gmail 자동 연동/ }).click();
    const refreshedDialog = page.getByRole('dialog');
    await expect(refreshedDialog).toContainText('뱅크샐러드_자동.xlsx');
    await expect(refreshedDialog).toContainText('성공');
    await expect(refreshedDialog).toContainText('중복 2건 건너뜀');
    await checkNoHorizontalOverflow(page);
  });

  test(`finance payday cycle start day filters cross-month dates and persists at ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    await setup(page, width, 'payday');
    const now = new Date();
    const calMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const cycleMonth =
      now.getDate() >= 25
        ? now.getMonth() === 11
          ? `${now.getFullYear() + 1}-01`
          : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}`
        : calMonth;
    const [cy, cm] = cycleMonth.split('-').map(Number);
    const prevCycleMonth =
      cm === 1 ? `${cy - 1}-12` : `${cy}-${String(cm - 1).padStart(2, '0')}`;

    const addTx = async (date: string, merchant: string, amount: number) => {
      const res = await page.request.post('/api/finance/transactions', {
        data: {
          date,
          kind: 'expense',
          amount,
          currency: 'KRW',
          category: '식비',
          merchant,
          excluded: false,
          source: 'manual',
        },
      });
      expect(res.status()).toBe(201);
    };

    await addTx(`${prevCycleMonth}-25`, '월급날 당일 식사', 15000);
    await addTx(`${prevCycleMonth}-24`, '전달 마지막날 커피', 7000);

    await page.goto('/finance');
    await page.getByLabel('가계부 기준일').selectOption('25');
    await expect(page.getByRole('status')).toContainText('가계부 기준일을 매월 25일로 변경했어요.');
    const shortRange = `${Number(prevCycleMonth.slice(5))}.25 ~ ${Number(cycleMonth.slice(5))}.24`;
    await expect(page.getByText(shortRange).first()).toBeVisible();
    await expect(page.getByText('월급날 당일 식사')).toBeVisible();
    await expect(page.getByText('전달 마지막날 커피')).toHaveCount(0);
    await expect(page.getByRole('region', { name: '이번 달 재무 요약' })).toContainText('₩15,000');

    await page.reload();
    await expect(page.getByLabel('가계부 기준일')).toHaveValue('25');
    await expect(page.getByText('월급날 당일 식사')).toBeVisible();
    await expect(page.getByText('전달 마지막날 커피')).toHaveCount(0);
    await checkNoHorizontalOverflow(page);

    // Calendar tab view across cross-month payday cycle + add transaction for clicked date
    await page.getByRole('tab', { name: '캘린더' }).click();
    const calendarGrid = page.getByLabel('가계부 캘린더');
    await expect(calendarGrid).toBeVisible();
    await checkNoHorizontalOverflow(page);

    const paydayBtn = calendarGrid.getByRole('button', { name: new RegExp(`${prevCycleMonth}-25`) });
    await paydayBtn.click();
    await expect(paydayBtn).toHaveAttribute('aria-pressed', 'true');
    const detailPanel = page.getByLabel('선택한 날짜 거래 내역');
    await expect(detailPanel).toContainText(`${prevCycleMonth}-25`);
    await expect(detailPanel).toContainText('월급날 당일 식사');

    const firstOfMonthBtn = calendarGrid.getByRole('button', { name: new RegExp(`${cycleMonth}-01`) });
    await firstOfMonthBtn.click();
    await detailPanel.getByRole('button', { name: '이 날짜에 거래 추가' }).click();
    const txDialog = page.getByRole('dialog');
    await expect(txDialog.getByLabel('거래 날짜')).toHaveValue(`${cycleMonth}-01`);
    await txDialog.getByLabel('거래 금액').fill('4800');
    await txDialog.getByLabel('거래 내용').fill('캘린더 추가 간식');
    await txDialog.getByRole('button', { name: '거래 저장' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(detailPanel).toContainText('캘린더 추가 간식');
    await expect(page.getByRole('region', { name: '이번 달 재무 요약' })).toContainText('₩19,800');
    await checkNoHorizontalOverflow(page);
  });
}
