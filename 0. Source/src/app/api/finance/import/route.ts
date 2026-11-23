import { NextResponse } from 'next/server';
import type { FinanceImportCommitResult, FinanceImportPreview } from '@/lib/finance';
import {
  FinanceImportError,
  MAX_FINANCE_UPLOAD_BYTES,
  parseFinanceUploadFile,
} from '@/lib/server/finance/parser';
import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';

export const POST = authenticated(async (session, req: Request) => {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'multipart/form-data 형식이 필요합니다.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: '업로드할 엑셀 또는 CSV 파일을 선택해 주세요.' }, { status: 400 });
  }
  if (file.size > MAX_FINANCE_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: '파일 크기는 최대 10MB까지 지원합니다.', code: 'FILE_TOO_LARGE' },
      { status: 413 },
    );
  }

  const passwordRaw = form.get('password');
  const password = typeof passwordRaw === 'string' && passwordRaw.length > 0 ? passwordRaw : undefined;
  const mode = form.get('mode') === 'commit' ? 'commit' : 'preview';

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseFinanceUploadFile({
      fileName: file.name,
      buffer,
      password,
    });

    const repositories = getUserRepositories(session.userId);

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

      const preview: FinanceImportPreview = {
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
      };
      return NextResponse.json(preview);
    }

    const { inserted, duplicates } = repositories.finance.importTransactions(parsed.rows);
    const result: FinanceImportCommitResult = {
      format: parsed.format,
      inserted,
      duplicates,
      skipped: parsed.skippedRows,
    };
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof FinanceImportError) {
      const status =
        err.code === 'FILE_TOO_LARGE'
          ? 413
          : err.code === 'PASSWORD_REQUIRED' || err.code === 'INVALID_PASSWORD'
            ? 422
            : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    throw err;
  }
});
