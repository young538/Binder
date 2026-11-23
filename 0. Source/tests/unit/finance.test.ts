// @vitest-environment node
import path from 'node:path';
import ExcelJS from 'exceljs';
import iconv from 'iconv-lite';
import officeCrypto from 'officecrypto-tool';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  formatFinanceAmount,
  formatFinanceTransactionAmount,
  getFinanceTransactionKindLabel,
  nextMonthKey,
  prevMonthKey,
  resolveEffectiveBudgets,
  summarizeMonthFinance,
} from '@/lib/finance';
import { validateFields } from '@/lib/validation/mutations';
import { buildRetroCoachSummary } from '@/lib/retroCoach';
import { DatabaseConnection } from '@/lib/server/db/connection';
import {
  FinanceImportError,
  parseFinanceUploadFile,
} from '@/lib/server/finance/parser';
import { UserRepositories } from '@/lib/server/repos';
import { SearchRepository } from '@/lib/server/search/repository';

let connection: DatabaseConnection;
const fixedNow = new Date('2026-11-23T09:00:00.000Z');

async function buildBankSaladWorkbookBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('재무현황').addRow(['요약', '값']);
  const sheet = wb.addWorksheet('가계부 내역');
  sheet.addRow(['날짜', '시간', '타입', '대분류', '소분류', '내용', '금액', '화폐', '결제수단', '메모']);
  sheet.addRow([new Date('2026-11-20T00:00:00Z'), '12:15', '지출', '식비', '외식', '김밥천국', -9500, 'KRW', '현대카드', '점심']);
  sheet.addRow(['2026-11-20', '13:05', '지출', '카페/간식', '커피', '스타벅스', -4500, 'KRW', '현대카드', '']);
  // Identical repeated purchase on same day/amount/merchant without time must preserve distinct hashes
  sheet.addRow(['2026-11-20', '13:05', '지출', '카페/간식', '커피', '스타벅스', -4500, 'KRW', '현대카드', '']);
  // BankSalad refund/cancellation uses positive amount under '지출'
  sheet.addRow(['2026-11-20', '13:05', '지출', '카페/간식', '커피', '스타벅스', 4500, 'KRW', '현대카드', '결제 취소']);
  sheet.addRow(['2026-11-21', '09:00', '수입', '급여', '', '11월 급여', 3500000, 'KRW', '신한은행', '']);
  sheet.addRow(['2026-11-22', '', '이체', '내계좌이체', '', '적금 자동이체', -500000, 'KRW', '토스뱅크', '']);
  sheet.addRow(['2026-11-22', '10:00', '이체', '용돈', '', '용돈 입금', 200000, 'KRW', '토스뱅크', '']);
  sheet.addRow(['합계', '', '', '', '', '', '', '', '', '']);
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

beforeEach(() => {
  connection = new DatabaseConnection({
    filename: () => ':memory:',
    migrationsFolder: path.resolve('drizzle'),
  });
});

afterEach(() => {
  connection.close();
});

describe('finance parser, repository, budgets & Life OS integration', () => {
  it('parses BankSalad .xlsx and encrypted .xlsx (password prompt + wrong password rejection) cleanly', async () => {
    const plainBuffer = await buildBankSaladWorkbookBuffer();
    const parsed = await parseFinanceUploadFile({
      fileName: 'banksalad_2026_11.xlsx',
      buffer: plainBuffer,
    });

    expect(parsed.format).toBe('banksalad_xlsx');
    expect(parsed.sheetName).toBe('가계부 내역');
    expect(parsed.rows).toHaveLength(7);
    expect(parsed.skippedRows).toBe(1); // Footer '합계' row skipped safely
    expect(parsed.rows[0]).toMatchObject({
      date: '2026-11-20',
      time: '12:15',
      kind: 'expense',
      amount: 9500,
      category: '식비',
      subCategory: '외식',
      merchant: '김밥천국',
      paymentMethod: '현대카드',
      source: 'banksalad',
    });
    // Two identical coffees produce distinct occurrence hashes; +4500 refund stores -4500 with distinct hash
    expect(parsed.rows[1].externalHash).not.toBe(parsed.rows[2].externalHash);
    expect(parsed.rows[3]).toMatchObject({ kind: 'expense', amount: -4500, merchant: '스타벅스' });
    expect(parsed.rows[3].externalHash).not.toBe(parsed.rows[1].externalHash);
    expect(parsed.rows[4]).toMatchObject({ kind: 'income', amount: 3500000 });
    expect(parsed.rows[5]).toMatchObject({ kind: 'transfer', amount: -500000 });
    expect(parsed.rows[6]).toMatchObject({ kind: 'transfer', amount: 200000 });

    // Encrypt workbook buffer like BankSalad password-protected export
    const encryptedBuffer = officeCrypto.encrypt(plainBuffer, { password: 'secret-pass-123' });

    await expect(
      parseFinanceUploadFile({ fileName: 'locked.xlsx', buffer: encryptedBuffer }),
    ).rejects.toMatchObject({ code: 'PASSWORD_REQUIRED' } satisfies Partial<FinanceImportError>);

    await expect(
      parseFinanceUploadFile({ fileName: 'locked.xlsx', buffer: encryptedBuffer, password: 'wrong' }),
    ).rejects.toMatchObject({ code: 'INVALID_PASSWORD' } satisfies Partial<FinanceImportError>);

    const unlocked = await parseFinanceUploadFile({
      fileName: 'locked.xlsx',
      buffer: encryptedBuffer,
      password: 'secret-pass-123',
    });
    expect(unlocked.rows).toHaveLength(7);
    expect(unlocked.rows.map(r => r.externalHash)).toEqual(parsed.rows.map(r => r.externalHash));
  });

  it('parses UTF-8, EUC-KR, positive-expense card CSVs, formatting helpers & signed validation', async () => {
    const csvContent = [
      '날짜,구분,카테고리,가맹점,금액,결제수단',
      '2026-11-18,지출,교통,카카오택시,"-14,200원",삼성카드',
      '2026-11-19,수입,부수입,외주 정산,250000,카카오뱅크',
    ].join('\n');

    const eucKrBuffer = iconv.encode(csvContent, 'cp949');
    const parsedCp949 = await parseFinanceUploadFile({ fileName: 'card.csv', buffer: eucKrBuffer });
    expect(parsedCp949.format).toBe('csv');
    expect(parsedCp949.rows).toHaveLength(2);
    expect(parsedCp949.rows[0]).toMatchObject({
      date: '2026-11-18',
      kind: 'expense',
      amount: 14200,
      merchant: '카카오택시',
      source: 'csv',
    });
    expect(parsedCp949.rows[1]).toMatchObject({
      kind: 'income',
      amount: 250000,
      merchant: '외주 정산',
    });

    const utf8BomBuffer = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(csvContent, 'utf8')]);
    const parsedUtf8 = await parseFinanceUploadFile({ fileName: 'card_utf8.csv', buffer: utf8BomBuffer });
    expect(parsedUtf8.rows).toHaveLength(2);

    // Card-company positive-charge CSV where negative row is cancellation
    const cardCsv = [
      '날짜,가맹점,이용금액,카테고리',
      '2026-11-18,식당A,15000,식비',
      '2026-11-18,식당B,12000,식비',
      '2026-11-18,식당A,-15000,식비',
    ].join('\n');
    const parsedCard = await parseFinanceUploadFile({
      fileName: 'credit_card.csv',
      buffer: Buffer.from(cardCsv, 'utf8'),
    });
    expect(parsedCard.rows.map(r => r.amount)).toEqual([15000, 12000, -15000]);

    // Formatting & label helpers for all 6 kind/sign pairs
    expect(formatFinanceAmount(-90200)).toBe('-₩90,200');
    expect(formatFinanceTransactionAmount({ kind: 'expense', amount: 9500, currency: 'KRW' })).toBe('-₩9,500');
    expect(formatFinanceTransactionAmount({ kind: 'expense', amount: -90200, currency: 'KRW' })).toBe('+₩90,200');
    expect(formatFinanceTransactionAmount({ kind: 'income', amount: 3500000, currency: 'KRW' })).toBe('+₩3,500,000');
    expect(formatFinanceTransactionAmount({ kind: 'income', amount: -50000, currency: 'KRW' })).toBe('-₩50,000');
    expect(formatFinanceTransactionAmount({ kind: 'transfer', amount: 200000, currency: 'KRW' })).toBe('+₩200,000');
    expect(formatFinanceTransactionAmount({ kind: 'transfer', amount: -500000, currency: 'KRW' })).toBe('-₩500,000');
    expect(getFinanceTransactionKindLabel({ kind: 'transfer', amount: 200000 })).toBe('이체 입금');
    expect(getFinanceTransactionKindLabel({ kind: 'transfer', amount: -500000 })).toBe('이체 출금');

    // Validation permits non-zero negative refunds & outgoing transfers, rejects 0
    expect(
      validateFields('financeTransactions', {
        date: '2026-11-23',
        kind: 'expense',
        amount: -5000,
        currency: 'KRW',
        category: '식비',
        merchant: '결제취소',
        excluded: false,
        source: 'manual',
      }),
    ).toMatchObject({ amount: -5000 });
    expect(() =>
      validateFields('financeTransactions', {
        date: '2026-11-23',
        kind: 'expense',
        amount: 0,
        currency: 'KRW',
        category: '식비',
        merchant: '0원',
        excluded: false,
        source: 'manual',
      }),
    ).toThrow();
  });

  it('deduplicates re-imports, manages budgets, syncs subscriptions idempotently, feeds dashboard/coach, and isolates users', async () => {
    const db = connection.get();
    const reposA = new UserRepositories(db, 'user-a');
    const reposB = new UserRepositories(db, 'user-b');

    const plainBuffer = await buildBankSaladWorkbookBuffer();
    const parsed = await parseFinanceUploadFile({
      fileName: 'banksalad_2026_11.xlsx',
      buffer: plainBuffer,
    });

    const firstImport = reposA.finance.importTransactions(parsed.rows);
    expect(firstImport).toEqual({ inserted: 7, duplicates: 0 });

    const secondImport = reposA.finance.importTransactions(parsed.rows);
    expect(secondImport).toEqual({ inserted: 0, duplicates: 7 });

    // Previous month expense for comparison
    reposA.finance.createTransaction({
      date: '2026-10-15',
      time: null,
      kind: 'expense',
      amount: 50000,
      currency: 'KRW',
      category: '식비',
      subCategory: null,
      merchant: '지난달 회식',
      paymentMethod: '현대카드',
      note: null,
      excluded: false,
      source: 'manual',
      subscriptionId: null,
    });

    // Manual excluded expense (must be ignored by monthly expense sum)
    const dutchPay = reposA.finance.createTransaction({
      date: '2026-11-22',
      time: null,
      kind: 'expense',
      amount: 100000,
      currency: 'KRW',
      category: '식비',
      subCategory: null,
      merchant: '더치페이 총액',
      paymentMethod: null,
      note: '나중에 정산받음',
      excluded: true,
      source: 'manual',
      subscriptionId: null,
    });
    expect(dutchPay.excluded).toBe(true);

    // Subscriptions -> Finance sync (monthly + active only)
    reposA.subscriptions.create({
      name: '넷플릭스',
      amount: 17000,
      currency: 'KRW',
      billingCycle: 'monthly',
      billingDay: 25,
      nextBillingDate: '2026-11-25',
      status: 'active',
      category: '구독/고정비',
      paymentMethod: '신한카드',
      autoRenew: true,
      url: null,
      note: null,
      order: 0,
    });
    reposA.subscriptions.create({
      name: '일시중지 서비스',
      amount: 10000,
      currency: 'KRW',
      billingCycle: 'monthly',
      billingDay: 1,
      nextBillingDate: null,
      status: 'paused',
      category: null,
      paymentMethod: null,
      autoRenew: false,
      url: null,
      note: null,
      order: 1,
    });

    expect(reposA.finance.syncSubscriptionsForMonth('2026-11')).toEqual({ created: 1, skipped: 0 });
    expect(reposA.finance.syncSubscriptionsForMonth('2026-11')).toEqual({ created: 0, skipped: 1 });

    // Budgets: default + per-month override
    reposA.finance.upsertBudget({ yyyymm: 'default', category: '__total__', amount: 1000000 });
    reposA.finance.upsertBudget({ yyyymm: '2026-11', category: '__total__', amount: 800000 });
    reposA.finance.upsertBudget({ yyyymm: 'default', category: '식비', amount: 200000 });

    const budgets = reposA.finance.listBudgets('2026-11');
    const resolved = resolveEffectiveBudgets(budgets, '2026-11');
    expect(resolved.totalBudget).toBe(800000);
    expect(resolved.byCategory['식비']).toBe(200000);

    const novTx = reposA.finance.listTransactions({ month: '2026-11' });
    const octTx = reposA.finance.listTransactions({ month: '2026-10' });
    const summary = summarizeMonthFinance(novTx, budgets, octTx, '2026-11', '2026-11-23');

    // Expenses = 9500 + 4500 + 4500 - 4500 (refund) + 17000 (netflix) = 31000 (excluded 100000 & transfers ignored)
    expect(summary.totalExpense).toBe(31000);
    expect(summary.totalIncome).toBe(3500000);
    expect(summary.transferInTotal).toBe(200000);
    expect(summary.transferOutTotal).toBe(500000);
    expect(summary.transferNetTotal).toBe(-300000);
    expect(summary.transferTotal).toBe(700000);
    expect(summary.byCategory.find(c => c.category === '카페/간식')).toMatchObject({ amount: 4500, count: 3 });
    expect(summary.byDay.find(d => d.date === '2026-11-20')?.amount).toBe(14000);
    expect(summary.excludedCount).toBe(1);
    expect(summary.prevMonthExpense).toBe(50000);
    expect(summary.expenseDiff).toBe(-19000);
    expect(summary.totalBudget).toBe(800000);
    expect(summary.dailyAllowance).toBe(Math.round((800000 - 31000) / 8));

    expect(prevMonthKey('2026-01')).toBe('2025-12');
    expect(nextMonthKey('2026-12')).toBe('2027-01');

    // Dashboard & Monthly Retro Coach integration
    const dash = reposA.dashboard.snapshot('2026-11-23');
    expect(dash.monthFinance.totalExpense).toBe(31000);
    expect(dash.monthFinance.totalIncome).toBe(3500000);

    const coach = buildRetroCoachSummary({
      mode: 'monthly',
      period: '2026-11',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      blocks: [],
      todos: [],
      categories: [],
      completedProjects: [],
      finishedBooks: [],
      checkins: [],
      habitPercent: 0,
      subscriptions: reposA.subscriptions.list(),
      financeSummary: dash.monthFinance,
    });
    expect(coach.insights.some(text => text.includes('재무 요약') && text.includes('₩31,000'))).toBe(true);
    expect(coach.promptText).toContain('가계부: 지출 ₩31,000');

    // Search integration & user isolation
    const searchA = new SearchRepository(db, 'user-a').search('김밥천국');
    expect(searchA.items.some(item => item.kind === 'financeTransactions' && item.href.startsWith('/finance?month=2026-11'))).toBe(true);

    expect(reposB.finance.listTransactions()).toHaveLength(0);
    expect(reposB.finance.listBudgets()).toHaveLength(0);
    expect(new SearchRepository(db, 'user-b').search('김밥천국').items).toHaveLength(0);
    expect(fixedNow.toISOString()).toBe('2026-11-23T09:00:00.000Z');
  });
});
