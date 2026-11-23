'use client';

import { useState } from 'react';
import { FileSpreadsheet, Lock, Upload } from 'lucide-react';
import {
  formatFinanceTransactionAmount,
  getFinanceTransactionKindLabel,
  type FinanceImportCommitResult,
  type FinanceImportPreview,
} from '@/lib/finance';
import {
  FinanceImportApiError,
  commitFinanceImport,
  previewFinanceImport,
} from '@/lib/repo/finance';
import { Dialog, actionClass, fieldClass } from '@/components/common/Dialog';

interface Props {
  onClose: () => void;
  onCommitted: (result: FinanceImportCommitResult) => void;
}

export function FinanceImportDialog({ onClose, onCommitted }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [passwordNeeded, setPasswordNeeded] = useState(false);
  const [preview, setPreview] = useState<FinanceImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setError('');
    try {
      const data = await previewFinanceImport(file, password || undefined);
      setPreview(data);
      setPasswordNeeded(false);
    } catch (err) {
      if (
        err instanceof FinanceImportApiError &&
        (err.code === 'PASSWORD_REQUIRED' || err.code === 'INVALID_PASSWORD')
      ) {
        setPasswordNeeded(true);
      }
      setError(err instanceof Error ? err.message : '파일을 미리 보지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await commitFinanceImport(file, password || undefined);
      onCommitted(result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '가져오기를 완료하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="뱅크샐러드 엑셀 · CSV 가져오기"
      onClose={() => { if (!busy) onClose(); }}
    >
      {!preview ? (
        <form onSubmit={e => void handlePreview(e)} className="space-y-3.5">
          <div className="rounded-xl bg-zinc-50 p-3 text-xs leading-5 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-zinc-800 dark:text-zinc-100">
              <FileSpreadsheet size={15} className="text-emerald-600 dark:text-emerald-400" />
              지원 형식 안내
            </div>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>
                <strong>뱅크샐러드 통합 엑셀(.xlsx · .zip)</strong>: <code>가계부 내역</code> 시트를 자동 인식합니다(비밀번호 설정 엑셀 및 이메일 첨부 <code>.zip</code> 지원).
              </li>
              <li>
                <strong>카드사·은행 CSV(.csv)</strong>: UTF-8 및 EUC-KR 인코딩을 자동 감지합니다.
              </li>
              <li>
                동일 파일을 여러 번 올려도 이미 등록된 거래는 <strong>중복 건너뛰기</strong> 처리됩니다.
              </li>
            </ul>
          </div>

          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            엑셀 / ZIP / CSV 파일 선택 (최대 10MB)
            <input
              type="file"
              accept=".xlsx,.zip,.csv,.txt"
              aria-label="가계부 엑셀, ZIP 또는 CSV 파일"
              disabled={busy}
              onChange={e => {
                const picked = e.target.files?.[0] ?? null;
                setFile(picked);
                setError('');
              }}
              className="mt-1.5 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-100"
            />
          </label>

          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            <span className="inline-flex items-center gap-1">
              <Lock size={12} /> 엑셀 비밀번호 {passwordNeeded ? '(필수)' : '(암호 설정 시만 입력)'}
            </span>
            <input
              type="password"
              aria-label="엑셀 비밀번호"
              placeholder="암호 없는 파일은 비워 두세요"
              value={password}
              disabled={busy}
              onChange={e => setPassword(e.target.value)}
              className={`mt-1 ${fieldClass} ${passwordNeeded ? 'border-amber-400 ring-1 ring-amber-400' : ''}`}
            />
          </label>

          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded-xl border border-zinc-200 px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!file || busy}
              className={`${actionClass} inline-flex items-center gap-1.5`}
            >
              <Upload size={13} />
              {busy ? '분석 중…' : '파일 미리보기'}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
            <div className="rounded-xl bg-zinc-50 p-2.5 dark:bg-zinc-900">
              <div className="text-zinc-500">전체 파싱</div>
              <div className="mt-0.5 text-base font-bold text-zinc-900 dark:text-zinc-100">
                {preview.totalRows.toLocaleString()}건
              </div>
            </div>
            <div className="rounded-xl bg-blue-50 p-2.5 dark:bg-blue-950/40">
              <div className="text-blue-700 dark:text-blue-300">신규 등록</div>
              <div className="mt-0.5 text-base font-bold text-blue-800 dark:text-blue-200">
                {preview.newRows.toLocaleString()}건
              </div>
            </div>
            <div className="rounded-xl bg-amber-50 p-2.5 dark:bg-amber-950/40">
              <div className="text-amber-700 dark:text-amber-300">중복 건너뜀</div>
              <div className="mt-0.5 text-base font-bold text-amber-800 dark:text-amber-200">
                {preview.duplicateRows.toLocaleString()}건
              </div>
            </div>
            <div className="rounded-xl bg-zinc-50 p-2.5 dark:bg-zinc-900">
              <div className="text-zinc-500">지출 · 수입 · 이체</div>
              <div className="mt-0.5 font-semibold text-zinc-800 dark:text-zinc-200">
                {preview.expenseCount} / {preview.incomeCount} / {preview.transferCount}
              </div>
            </div>
          </div>

          <div className="max-h-60 overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-[11px]">
              <thead className="sticky top-0 bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-2.5 py-1.5 font-medium">날짜</th>
                  <th className="px-2 py-1.5 font-medium">구분</th>
                  <th className="px-2 py-1.5 font-medium">분류</th>
                  <th className="px-2 py-1.5 font-medium">내용</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">금액</th>
                  <th className="px-2 py-1.5 font-medium">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {preview.sampleRows.map((row, idx) => (
                  <tr key={`${row.externalHash}-${idx}`}>
                    <td className="whitespace-nowrap px-2.5 py-1.5 text-zinc-600 dark:text-zinc-300">
                      {row.date}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5">
                      {getFinanceTransactionKindLabel(row)}
                      {row.kind !== 'transfer' && row.amount < 0 && (
                        <span className="ml-1 rounded bg-emerald-50 px-1 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                          취소
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-zinc-600 dark:text-zinc-300">{row.category}</td>
                    <td className="max-w-[140px] truncate px-2 py-1.5 font-medium text-zinc-800 dark:text-zinc-100">
                      {row.merchant}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-1.5 text-right tabular-nums">
                      {formatFinanceTransactionAmount(row)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5">
                      {row.duplicate ? (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800">
                          중복
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                          신규
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => setPreview(null)}
              className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              다시 선택
            </button>
            <button
              type="button"
              disabled={busy || preview.newRows === 0}
              onClick={() => void handleCommit()}
              className={actionClass}
            >
              {busy
                ? '저장 중…'
                : preview.newRows === 0
                  ? '신규 거래 없음 (모두 중복)'
                  : `신규 ${preview.newRows.toLocaleString()}건 가져오기 확정`}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
