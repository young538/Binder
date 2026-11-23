// @vitest-environment node
import path from 'node:path';
import vm from 'node:vm';
import { eq } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import officeCrypto from 'officecrypto-tool';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildBankSaladAppsScript } from '@/lib/financeAutomation';
import { DatabaseConnection } from '@/lib/server/db/connection';
import { financeAutomationConfigs, users } from '@/lib/server/db/schema';
import { handleFinanceAutomationImport } from '@/lib/server/finance/automationImport';
import { MAX_FINANCE_UPLOAD_BYTES } from '@/lib/server/finance/parser';
import { UserRepositories } from '@/lib/server/repos';
import { resolveFinanceAutomationToken } from '@/lib/server/repos/financeAutomation';

let connection: DatabaseConnection;
let prevSecret: string | undefined;
const TEST_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const ENDPOINT_URL = 'https://young538.synology.me/api/finance/import/automation';

async function buildBankSaladWorkbookBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('가계부 내역');
  sheet.addRow(['날짜', '시간', '타입', '대분류', '소분류', '내용', '금액', '화폐', '결제수단', '메모']);
  sheet.addRow(['2026-11-20', '12:15', '지출', '식비', '외식', '김밥천국', -9500, 'KRW', '현대카드', '점심']);
  sheet.addRow(['2026-11-20', '13:05', '지출', '카페/간식', '커피', '스타벅스', -4500, 'KRW', '현대카드', '']);
  sheet.addRow(['2026-11-20', '13:05', '지출', '카페/간식', '커피', '스타벅스', -4500, 'KRW', '현대카드', '']);
  sheet.addRow(['2026-11-21', '09:00', '수입', '급여', '', '11월 급여', 3500000, 'KRW', '신한은행', '']);
  sheet.addRow(['2026-11-22', '', '이체', '내계좌이체', '', '적금 자동이체', -500000, 'KRW', '토스뱅크', '']);
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

function seedUser(userId: string, username: string) {
  const now = '2026-11-23T00:00:00.000Z';
  connection.get()
    .insert(users)
    .values({
      id: userId,
      username,
      passwordHash: 'hash-not-used',
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

beforeEach(() => {
  prevSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = TEST_SECRET;
  connection = new DatabaseConnection({
    filename: () => ':memory:',
    migrationsFolder: path.resolve('drizzle'),
  });
  seedUser('user-a', 'alice');
  seedUser('user-b', 'bob');
});

afterEach(() => {
  connection.close();
  if (prevSecret === undefined) {
    delete process.env.SESSION_SECRET;
  } else {
    process.env.SESSION_SECRET = prevSecret;
  }
});

describe('finance automation repository, API & Apps Script generator', () => {
  it('issues, rotates, disables, revokes tokens and stores only SHA-256 hashes with user isolation', () => {
    const db = connection.get();
    const reposA = new UserRepositories(db, 'user-a');
    const reposB = new UserRepositories(db, 'user-b');

    expect(reposA.financeAutomation.getStatus(ENDPOINT_URL)).toMatchObject({
      configured: false,
      enabled: false,
      tokenPrefix: null,
      hasExcelPassword: false,
      endpointUrl: ENDPOINT_URL,
    });

    const first = reposA.financeAutomation.issueToken(ENDPOINT_URL);
    expect(first.token).toMatch(/^bfi_[0-9a-f]{48}$/);
    expect(first.status).toMatchObject({
      configured: true,
      enabled: true,
      tokenPrefix: first.token.slice(0, 12),
    });

    // DB stores hash, not raw token
    const rawRow = db
      .select()
      .from(financeAutomationConfigs)
      .where(eq(financeAutomationConfigs.userId, 'user-a'))
      .get();
    expect(rawRow?.tokenHash).toBeTruthy();
    expect(rawRow?.tokenHash).not.toBe(first.token);

    expect(resolveFinanceAutomationToken(db, first.token)?.userId).toBe('user-a');
    expect(reposB.financeAutomation.getStatus(ENDPOINT_URL).configured).toBe(false);

    // Rotation invalidates previous token
    const rotated = reposA.financeAutomation.issueToken(ENDPOINT_URL);
    expect(rotated.token).not.toBe(first.token);
    expect(resolveFinanceAutomationToken(db, first.token)).toBeNull();
    expect(resolveFinanceAutomationToken(db, rotated.token)?.userId).toBe('user-a');

    // Disable keeps token hash but rejects resolution until re-enabled
    const disabled = reposA.financeAutomation.updateSettings({ enabled: false }, ENDPOINT_URL);
    expect(disabled).toMatchObject({ configured: true, enabled: false });
    expect(resolveFinanceAutomationToken(db, rotated.token)).toBeNull();

    const reenabled = reposA.financeAutomation.updateSettings({ enabled: true }, ENDPOINT_URL);
    expect(reenabled).toMatchObject({ configured: true, enabled: true });
    expect(resolveFinanceAutomationToken(db, rotated.token)?.userId).toBe('user-a');

    // Revoke clears hash & disables
    const revoked = reposA.financeAutomation.revokeToken(ENDPOINT_URL);
    expect(revoked).toMatchObject({ configured: false, enabled: false, tokenPrefix: null });
    expect(resolveFinanceAutomationToken(db, rotated.token)).toBeNull();
  });

  it('encrypts fixed Excel password with AES-256-GCM, preserves when omitted, and clears on null', () => {
    const db = connection.get();
    const repos = new UserRepositories(db, 'user-a');
    const saved = repos.financeAutomation.updateSettings(
      { excelPassword: 'my-secret-excel-pw' },
      ENDPOINT_URL,
    );
    expect(saved.hasExcelPassword).toBe(true);

    const row = repos.financeAutomation.getRow();
    expect(row?.excelPasswordEnc).toBeTruthy();
    expect(row?.excelPasswordEnc).not.toContain('my-secret-excel-pw');

    // Issuing token preserves password
    const issued = repos.financeAutomation.issueToken(ENDPOINT_URL);
    expect(issued.status.hasExcelPassword).toBe(true);

    // Toggling enabled preserves password
    const toggled = repos.financeAutomation.updateSettings({ enabled: false }, ENDPOINT_URL);
    expect(toggled.hasExcelPassword).toBe(true);

    // Null clears password
    const cleared = repos.financeAutomation.updateSettings({ excelPassword: null }, ENDPOINT_URL);
    expect(cleared.hasExcelPassword).toBe(false);
    expect(repos.financeAutomation.getRow()?.excelPasswordEnc).toBeNull();
  });

  it('handles Bearer JSON & multipart imports, decryption, deduplication, oversized payloads & telemetry', async () => {
    const db = connection.get();
    const repos = new UserRepositories(db, 'user-a');
    const plainBuffer = await buildBankSaladWorkbookBuffer();
    const encryptedBuffer = officeCrypto.encrypt(plainBuffer, { password: 'bs-fixed-pw' });

    // 1. Missing/invalid Bearer token returns 401
    const unauthRes = await handleFinanceAutomationImport(
      new Request(ENDPOINT_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: 'x.xlsx', fileBase64: plainBuffer.toString('base64') }),
      }),
      db,
    );
    expect(unauthRes.status).toBe(401);

    const invalidBearerRes = await handleFinanceAutomationImport(
      new Request(ENDPOINT_URL, {
        method: 'POST',
        headers: { authorization: 'Bearer bfi_invalidtokenvalue1234567890' },
      }),
      db,
    );
    expect(invalidBearerRes.status).toBe(401);

    const { token } = repos.financeAutomation.issueToken(ENDPOINT_URL);
    repos.financeAutomation.updateSettings({ excelPassword: 'bs-fixed-pw' }, ENDPOINT_URL);

    // 2. Preview mode returns counts without inserting or mutating telemetry
    const previewRes = await handleFinanceAutomationImport(
      new Request(ENDPOINT_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          fileName: '뱅크샐러드_11월.xlsx',
          fileBase64: encryptedBuffer.toString('base64'),
          mode: 'preview',
        }),
      }),
      db,
    );
    expect(previewRes.status).toBe(200);
    const previewBody = (await previewRes.json()) as { mode: string; newRows: number; duplicateRows: number };
    expect(previewBody).toMatchObject({ mode: 'preview', newRows: 5, duplicateRows: 0 });
    expect(repos.finance.listTransactions()).toHaveLength(0);
    expect(repos.financeAutomation.getStatus(ENDPOINT_URL).lastImportAt).toBeNull();

    // 3. Commit JSON with encrypted BankSalad .xlsx succeeds & records telemetry
    const commitRes = await handleFinanceAutomationImport(
      new Request(ENDPOINT_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          fileName: '뱅크샐러드_11월.xlsx',
          fileBase64: encryptedBuffer.toString('base64'),
          mode: 'commit',
        }),
      }),
      db,
    );
    expect(commitRes.status).toBe(200);
    expect(await commitRes.json()).toMatchObject({
      ok: true,
      mode: 'commit',
      fileName: '뱅크샐러드_11월.xlsx',
      format: 'banksalad_xlsx',
      inserted: 5,
      duplicates: 0,
    });
    expect(repos.finance.listTransactions()).toHaveLength(5);
    expect(repos.financeAutomation.getStatus(ENDPOINT_URL)).toMatchObject({
      lastImportStatus: 'success',
      lastImportFileName: '뱅크샐러드_11월.xlsx',
      lastImportSummary: '신규 5건 반영 · 중복 0건 건너뜀',
      lastImportError: null,
    });

    // 4. Re-upload identical file -> 0 inserted, 5 duplicates
    const dupRes = await handleFinanceAutomationImport(
      new Request(ENDPOINT_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          fileName: '뱅크샐러드_11월.xlsx',
          fileBase64: encryptedBuffer.toString('base64'),
        }),
      }),
      db,
    );
    expect(dupRes.status).toBe(200);
    expect(await dupRes.json()).toMatchObject({
      ok: true,
      inserted: 0,
      duplicates: 5,
    });

    // 5. Wrong saved password -> 422 INVALID_PASSWORD + error telemetry recorded
    repos.financeAutomation.updateSettings({ excelPassword: 'wrong-password' }, ENDPOINT_URL);
    const badPwRes = await handleFinanceAutomationImport(
      new Request(ENDPOINT_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          fileName: '잠긴파일.xlsx',
          fileBase64: encryptedBuffer.toString('base64'),
        }),
      }),
      db,
    );
    expect(badPwRes.status).toBe(422);
    expect(await badPwRes.json()).toMatchObject({ ok: false, code: 'INVALID_PASSWORD' });
    const afterErrStatus = repos.financeAutomation.getStatus(ENDPOINT_URL);
    expect(afterErrStatus.lastImportStatus).toBe('error');
    expect(afterErrStatus.lastImportFileName).toBe('잠긴파일.xlsx');
    expect(afterErrStatus.lastImportError).toBeTruthy();

    // 6. multipart/form-data upload works cleanly with explicit CSV
    const form = new FormData();
    const csvBlob = new Blob(
      ['날짜,구분,카테고리,가맹점,금액,결제수단\n2026-11-23,지출,식비,분식,-6500,카드\n'],
      { type: 'text/csv' },
    );
    form.set('file', csvBlob, 'card.csv');
    const mpRes = await handleFinanceAutomationImport(
      new Request(ENDPOINT_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: form,
      }),
      db,
    );
    expect(mpRes.status).toBe(200);
    expect(await mpRes.json()).toMatchObject({
      ok: true,
      mode: 'commit',
      format: 'csv',
      inserted: 1,
      duplicates: 0,
    });

    // 7. Oversized base64 payload rejected with 413 FILE_TOO_LARGE
    const hugeBase64 = 'A'.repeat(Math.ceil((MAX_FINANCE_UPLOAD_BYTES * 4) / 3) + 512);
    const bigRes = await handleFinanceAutomationImport(
      new Request(ENDPOINT_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ fileName: 'huge.xlsx', fileBase64: hugeBase64 }),
      }),
      db,
    );
    expect(bigRes.status).toBe(413);
    expect(await bigRes.json()).toMatchObject({ ok: false, code: 'FILE_TOO_LARGE' });

    // 8. Disabled/revoked token rejected with 401
    repos.financeAutomation.updateSettings({ enabled: false }, ENDPOINT_URL);
    const disabledRes = await handleFinanceAutomationImport(
      new Request(ENDPOINT_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      }),
      db,
    );
    expect(disabledRes.status).toBe(401);
  });

  it('builds valid Google Apps Script code with safe JSON string escaping and Seoul 12/23h triggers', () => {
    const trickyQuery = 'has:attachment subject:"가계부" path\\test -label:Binder-Finance-Imported';
    const script = buildBankSaladAppsScript({
      endpointUrl: `${ENDPOINT_URL}?v="test"`,
      searchQuery: trickyQuery,
    });

    expect(script).toContain('atHour(12)');
    expect(script).toContain('atHour(23)');
    expect(script).toContain("inTimezone('Asia/Seoul')");
    expect(script).toContain('Binder-Finance-Imported');
    expect(script).toContain('BINDER_IMPORT_TOKEN');

    // Compile generated JS syntax in vm.Script to verify embedded quotes/backslashes never break syntax
    expect(() => new vm.Script(script)).not.toThrow();
  });
});
