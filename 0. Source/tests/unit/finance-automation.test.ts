// @vitest-environment node
import path from 'node:path';
import zlib from 'node:zlib';
import { eq } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import officeCrypto from 'officecrypto-tool';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseConnection } from '@/lib/server/db/connection';
import { financeAutomationConfigs, users } from '@/lib/server/db/schema';
import { handleFinanceAutomationImport } from '@/lib/server/finance/automationImport';
import {
  FinanceImportError,
  MAX_FINANCE_UPLOAD_BYTES,
  parseFinanceUploadFile,
} from '@/lib/server/finance/parser';
import { computeCrc32 } from '@/lib/server/finance/zip';
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

describe('finance automation repository, API & encrypted ZIP parser', () => {
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

  it('extracts plain ZIP, ZipCrypto (flags: 9) encrypted BankSalad ZIP, and rejects nested/empty ZIPs', async () => {
    const buildZipBuffer = (
      entries: Array<{ name: string; content: Buffer; password?: string; flags9?: boolean }>,
    ): Buffer => {
      const crcTable = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
          c = (c & 1) !== 0 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : c >>> 1;
        }
        crcTable[i] = c;
      }
      const stepCrc = (crc: number, b: number) =>
        ((crc >>> 8) ^ crcTable[(crc ^ b) & 0xff]) >>> 0;

      const encryptZipCrypto = (plain: Buffer, password: string, checkByte: number): Buffer => {
        let key0 = 0x12345678 >>> 0;
        let key1 = 0x23456789 >>> 0;
        let key2 = 0x34567890 >>> 0;
        const update = (b: number) => {
          key0 = stepCrc(key0, b);
          key1 = (key1 + (key0 & 0xff)) >>> 0;
          key1 = (Math.imul(key1, 0x08088405) + 1) >>> 0;
          key2 = stepCrc(key2, (key1 >>> 24) & 0xff);
        };
        const streamByte = () => {
          const temp = (key2 & 0xffff) | 2;
          return (Math.imul(temp, temp ^ 1) >>> 8) & 0xff;
        };
        for (const pb of Buffer.from(password, 'utf8')) update(pb);
        const out = Buffer.allocUnsafe(12 + plain.length);
        for (let i = 0; i < 11; i++) {
          const r = (i * 37 + 19) & 0xff;
          out[i] = r ^ streamByte();
          update(r);
        }
        out[11] = checkByte ^ streamByte();
        update(checkByte);
        for (let i = 0; i < plain.length; i++) {
          const p = plain[i];
          out[12 + i] = p ^ streamByte();
          update(p);
        }
        return out;
      };

      const localParts: Buffer[] = [];
      const cdParts: Buffer[] = [];
      let offset = 0;

      for (const entry of entries) {
        const nameBuf = Buffer.from(entry.name, 'utf8');
        const compressed = zlib.deflateRawSync(entry.content);
        const crc = computeCrc32(entry.content);
        const modTime = 0x5432;
        const isEnc = Boolean(entry.password);
        const useDD = Boolean(entry.flags9);
        const flags = (isEnc ? 1 : 0) | (useDD ? 8 : 0) | (entry.flags9 ? 0 : 0x800);
        const checkByte = useDD ? (modTime >>> 8) & 0xff : (crc >>> 24) & 0xff;
        const payload = entry.password
          ? encryptZipCrypto(compressed, entry.password, checkByte)
          : compressed;

        const lh = Buffer.alloc(30);
        lh.writeUInt32LE(0x04034b50, 0);
        lh.writeUInt16LE(20, 4);
        lh.writeUInt16LE(flags, 6);
        lh.writeUInt16LE(8, 8);
        lh.writeUInt16LE(modTime, 10);
        lh.writeUInt16LE(0x5577, 12);
        lh.writeUInt32LE(useDD ? 0 : crc, 14);
        lh.writeUInt32LE(useDD ? 0 : payload.length, 18);
        lh.writeUInt32LE(useDD ? 0 : entry.content.length, 22);
        lh.writeUInt16LE(nameBuf.length, 26);
        lh.writeUInt16LE(0, 28);

        const dd = Buffer.alloc(useDD ? 16 : 0);
        if (useDD) {
          dd.writeUInt32LE(0x08074b50, 0);
          dd.writeUInt32LE(crc, 4);
          dd.writeUInt32LE(payload.length, 8);
          dd.writeUInt32LE(entry.content.length, 12);
        }

        const cd = Buffer.alloc(46);
        cd.writeUInt32LE(0x02014b50, 0);
        cd.writeUInt16LE(20, 4);
        cd.writeUInt16LE(20, 6);
        cd.writeUInt16LE(flags, 8);
        cd.writeUInt16LE(8, 10);
        cd.writeUInt16LE(modTime, 12);
        cd.writeUInt16LE(0x5577, 14);
        cd.writeUInt32LE(crc, 16);
        cd.writeUInt32LE(payload.length, 20);
        cd.writeUInt32LE(entry.content.length, 24);
        cd.writeUInt16LE(nameBuf.length, 28);
        cd.writeUInt32LE(offset, 42);

        localParts.push(lh, nameBuf, payload, dd);
        cdParts.push(cd, nameBuf);
        offset += lh.length + nameBuf.length + payload.length + dd.length;
      }

      const cdBuf = Buffer.concat(cdParts);
      const eocd = Buffer.alloc(22);
      eocd.writeUInt32LE(0x06054b50, 0);
      eocd.writeUInt16LE(entries.length, 8);
      eocd.writeUInt16LE(entries.length, 10);
      eocd.writeUInt32LE(cdBuf.length, 12);
      eocd.writeUInt32LE(offset, 16);

      return Buffer.concat([...localParts, cdBuf, eocd]);
    };

    const xlsxBuf = await buildBankSaladWorkbookBuffer();

    // 1. Plain ZIP imports cleanly
    const plainZip = buildZipBuffer([{ name: '2026-11-23.xlsx', content: xlsxBuf }]);
    const parsedPlainZip = await parseFinanceUploadFile({
      fileName: 'banksalad_plain.zip',
      buffer: plainZip,
    });
    expect(parsedPlainZip.format).toBe('banksalad_xlsx');
    expect(parsedPlainZip.rows).toHaveLength(5);

    // 2. BankSalad-style ZipCrypto (flags: 9) requires password, rejects wrong, accepts right
    const encryptedZip = buildZipBuffer([
      { name: '2025-11-23~2026-11-23.xlsx', content: xlsxBuf, password: 'zip-secret-99', flags9: true },
    ]);

    await expect(
      parseFinanceUploadFile({ fileName: '오세영님_2025-11-23~2026-11-23.zip', buffer: encryptedZip }),
    ).rejects.toMatchObject({ code: 'PASSWORD_REQUIRED' } satisfies Partial<FinanceImportError>);

    await expect(
      parseFinanceUploadFile({
        fileName: '오세영님_2025-11-23~2026-11-23.zip',
        buffer: encryptedZip,
        password: 'wrong-zip-password',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PASSWORD' } satisfies Partial<FinanceImportError>);

    const parsedEncZip = await parseFinanceUploadFile({
      fileName: '오세영님_2025-11-23~2026-11-23.zip',
      buffer: encryptedZip,
      password: 'zip-secret-99',
    });
    expect(parsedEncZip.rows).toHaveLength(5);

    // 3. Nested .zip-in-.zip or ZIP without .xlsx/.csv rejects with UNSUPPORTED_FORMAT
    const nestedZip = buildZipBuffer([{ name: 'inner.zip', content: plainZip }]);
    await expect(
      parseFinanceUploadFile({ fileName: 'nested.zip', buffer: nestedZip }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_FORMAT' } satisfies Partial<FinanceImportError>);

    // 4. End-to-end automation endpoint handles ZipCrypto .zip using saved encrypted password
    const db = connection.get();
    const repos = new UserRepositories(db, 'user-a');
    const { token } = repos.financeAutomation.issueToken(ENDPOINT_URL);
    repos.financeAutomation.updateSettings({ excelPassword: 'zip-secret-99' }, ENDPOINT_URL);

    const zipImportRes = await handleFinanceAutomationImport(
      new Request(ENDPOINT_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          fileName: '오세영님_2025-11-23~2026-11-23.zip',
          fileBase64: encryptedZip.toString('base64'),
          mode: 'commit',
        }),
      }),
      db,
    );
    expect(zipImportRes.status).toBe(200);
    expect(await zipImportRes.json()).toMatchObject({
      ok: true,
      mode: 'commit',
      format: 'banksalad_xlsx',
      inserted: 5,
      duplicates: 0,
    });
  });
});
