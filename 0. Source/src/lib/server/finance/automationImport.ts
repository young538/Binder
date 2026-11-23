import 'server-only';
import { NextResponse } from 'next/server';
import type { BinderDatabase } from '@/lib/server/db/connection';
import { getDb } from '@/lib/server/db/client';
import {
  FinanceImportError,
  MAX_FINANCE_UPLOAD_BYTES,
  parseFinanceUploadFile,
} from '@/lib/server/finance/parser';
import { decryptSecret } from '@/lib/server/googleCalendar/crypto';
import { UserRepositories } from '@/lib/server/repos';
import { resolveFinanceAutomationToken } from '@/lib/server/repos/financeAutomation';

function parseBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization')?.trim() ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match ? match[1] : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Core handler for Bearer-authenticated Finance Excel/CSV import automation. */
export async function handleFinanceAutomationImport(
  req: Request,
  database: BinderDatabase = getDb(),
): Promise<Response> {
  const rawToken = parseBearerToken(req);
  const resolved = rawToken ? resolveFinanceAutomationToken(database, rawToken) : null;
  if (!resolved) {
    return NextResponse.json(
      { ok: false, error: '유효한 자동 가져오기 토큰이 필요합니다.' },
      { status: 401 },
    );
  }

  const contentLengthRaw = req.headers.get('content-length');
  const contentLength = contentLengthRaw ? Number(contentLengthRaw) : NaN;
  if (Number.isFinite(contentLength) && contentLength > MAX_FINANCE_UPLOAD_BYTES * 2) {
    return NextResponse.json(
      { ok: false, error: '파일 크기는 최대 10MB까지 지원합니다.', code: 'FILE_TOO_LARGE' },
      { status: 413 },
    );
  }

  const contentType = (req.headers.get('content-type') ?? '').toLowerCase();
  let fileName = '';
  let buffer: Buffer;
  let explicitPassword: string | undefined;
  let mode: 'preview' | 'commit' = 'commit';

  if (contentType.includes('application/json')) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: '올바른 JSON 형식이 필요합니다.' },
        { status: 400 },
      );
    }

    if (!isPlainObject(body)) {
      return NextResponse.json(
        { ok: false, error: '요청 본문은 JSON 객체여야 합니다.' },
        { status: 400 },
      );
    }

    if (
      typeof body.fileName !== 'string' ||
      body.fileName.trim().length === 0 ||
      body.fileName.length > 255
    ) {
      return NextResponse.json(
        { ok: false, error: '유효한 fileName이 필요합니다 (1~255자).' },
        { status: 400 },
      );
    }
    if (typeof body.fileBase64 !== 'string' || body.fileBase64.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: 'fileBase64 데이터가 필요합니다.' },
        { status: 400 },
      );
    }

    const cleanedBase64 = body.fileBase64.replace(/\s+/g, '');
    const maxBase64Length = Math.ceil((MAX_FINANCE_UPLOAD_BYTES * 4) / 3) + 128;
    if (cleanedBase64.length > maxBase64Length) {
      return NextResponse.json(
        { ok: false, error: '파일 크기는 최대 10MB까지 지원합니다.', code: 'FILE_TOO_LARGE' },
        { status: 413 },
      );
    }
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleanedBase64)) {
      return NextResponse.json(
        { ok: false, error: '유효한 Base64 파일 데이터가 아닙니다.' },
        { status: 400 },
      );
    }

    buffer = Buffer.from(cleanedBase64, 'base64');
    if (buffer.length === 0) {
      return NextResponse.json(
        { ok: false, error: '파일 데이터가 비어 있습니다.' },
        { status: 400 },
      );
    }
    if (buffer.length > MAX_FINANCE_UPLOAD_BYTES) {
      return NextResponse.json(
        { ok: false, error: '파일 크기는 최대 10MB까지 지원합니다.', code: 'FILE_TOO_LARGE' },
        { status: 413 },
      );
    }

    fileName = body.fileName.trim();
    if (body.password !== undefined && body.password !== null) {
      if (typeof body.password !== 'string') {
        return NextResponse.json(
          { ok: false, error: 'password는 문자열이어야 합니다.' },
          { status: 400 },
        );
      }
      if (body.password.length > 0) {
        explicitPassword = body.password;
      }
    }
    mode = body.mode === 'preview' ? 'preview' : 'commit';
  } else if (contentType.includes('multipart/form-data')) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json(
        { ok: false, error: 'multipart/form-data 형식이 필요합니다.' },
        { status: 400 },
      );
    }

    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { ok: false, error: '업로드할 엑셀 또는 CSV 파일을 선택해 주세요.' },
        { status: 400 },
      );
    }
    if (file.size === 0) {
      return NextResponse.json(
        { ok: false, error: '파일 데이터가 비어 있습니다.' },
        { status: 400 },
      );
    }
    if (file.size > MAX_FINANCE_UPLOAD_BYTES) {
      return NextResponse.json(
        { ok: false, error: '파일 크기는 최대 10MB까지 지원합니다.', code: 'FILE_TOO_LARGE' },
        { status: 413 },
      );
    }

    buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_FINANCE_UPLOAD_BYTES) {
      return NextResponse.json(
        { ok: false, error: '파일 크기는 최대 10MB까지 지원합니다.', code: 'FILE_TOO_LARGE' },
        { status: 413 },
      );
    }

    fileName = (file.name || 'banksalad.xlsx').trim().slice(0, 255) || 'banksalad.xlsx';
    const passwordRaw = form.get('password');
    explicitPassword =
      typeof passwordRaw === 'string' && passwordRaw.length > 0 ? passwordRaw : undefined;
    mode = form.get('mode') === 'preview' ? 'preview' : 'commit';
  } else {
    return NextResponse.json(
      { ok: false, error: 'application/json 또는 multipart/form-data 형식이 필요합니다.' },
      { status: 400 },
    );
  }

  const repositories = new UserRepositories(database, resolved.userId);

  let password = explicitPassword;
  if (!password && resolved.excelPasswordEnc) {
    try {
      password = decryptSecret(resolved.excelPasswordEnc);
    } catch {
      const errMsg =
        '저장된 엑셀 비밀번호를 복호화하지 못했습니다. 가계부 설정에서 비밀번호를 다시 저장해 주세요.';
      if (mode === 'commit') {
        repositories.financeAutomation.recordImportError({ fileName, error: errMsg });
      }
      return NextResponse.json(
        { ok: false, error: errMsg, code: 'INVALID_PASSWORD' },
        { status: 422 },
      );
    }
  }

  try {
    const parsed = await parseFinanceUploadFile({
      fileName,
      buffer,
      password,
    });

    if (mode === 'preview') {
      const existingHashes = repositories.finance.findExistingHashes(
        parsed.rows.map(r => r.externalHash),
      );
      let newRows = 0;
      let duplicateRows = 0;
      let expenseCount = 0;
      let incomeCount = 0;
      let transferCount = 0;

      const annotated = parsed.rows.map(row => {
        const duplicate = existingHashes.has(row.externalHash);
        if (duplicate) duplicateRows++;
        else newRows++;

        if (row.kind === 'expense') expenseCount++;
        else if (row.kind === 'income') incomeCount++;
        else transferCount++;

        return { ...row, duplicate };
      });

      return NextResponse.json({
        ok: true,
        mode: 'preview',
        fileName,
        format: parsed.format,
        sheetName: parsed.sheetName,
        totalRows: parsed.rows.length,
        newRows,
        duplicateRows,
        expenseCount,
        incomeCount,
        transferCount,
        skippedRows: parsed.skippedRows,
        sampleRows: annotated.slice(0, 50),
      });
    }

    const { inserted, duplicates } = repositories.finance.importTransactions(parsed.rows);
    repositories.financeAutomation.recordImportSuccess({
      fileName,
      inserted,
      duplicates,
      skipped: parsed.skippedRows,
    });

    return NextResponse.json({
      ok: true,
      mode: 'commit',
      fileName,
      format: parsed.format,
      inserted,
      duplicates,
      skipped: parsed.skippedRows,
    });
  } catch (err) {
    if (err instanceof FinanceImportError) {
      if (mode === 'commit') {
        repositories.financeAutomation.recordImportError({ fileName, error: err.message });
      }
      const status =
        err.code === 'FILE_TOO_LARGE'
          ? 413
          : err.code === 'PASSWORD_REQUIRED' || err.code === 'INVALID_PASSWORD'
            ? 422
            : 400;
      return NextResponse.json(
        { ok: false, error: err.message, code: err.code },
        { status },
      );
    }
    throw err;
  }
}
