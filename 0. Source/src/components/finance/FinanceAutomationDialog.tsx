'use client';

import { useState } from 'react';
import { Check, Copy, KeyRound, Lock, Mail, RefreshCw, ShieldAlert } from 'lucide-react';
import type { FinanceAutomationStatus } from '@/lib/financeAutomation';
import {
  issueFinanceAutomationToken,
  revokeFinanceAutomationToken,
  updateFinanceAutomationSettings,
} from '@/lib/repo/finance';
import { Dialog, actionClass, fieldClass } from '@/components/common/Dialog';

interface Props {
  status: FinanceAutomationStatus | null;
  onClose: () => void;
  onChanged: () => void;
}

export function FinanceAutomationDialog({ status, onClose, onChanged }: Props) {
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [excelPasswordInput, setExcelPasswordInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [copiedToken, setCopiedToken] = useState(false);

  const copyToken = async (text: string) => {
    setError('');
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const el = document.createElement('textarea');
        el.value = text;
        el.setAttribute('readonly', '');
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopiedToken(true);
      setInfo('토큰을 클립보드에 복사했습니다.');
    } catch {
      setError('토큰 복사에 실패했습니다. 직접 선택해서 복사해 주세요.');
    }
  };

  const handleIssueToken = async () => {
    if (busy) return;
    if (
      status?.configured &&
      !confirm('새 토큰을 발급하면 기존 토큰은 즉시 무효화됩니다. 계속할까요?')
    ) {
      return;
    }
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const res = await issueFinanceAutomationToken();
      setIssuedToken(res.token);
      setCopiedToken(false);
      setInfo('새 자동 연동 토큰을 발급했습니다. 로컬 에이전트 설정(.env.finance-automation)에 등록해 주세요.');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : '토큰 발급에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleEnabled = async () => {
    if (busy || !status?.configured) return;
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const next = !status.enabled;
      await updateFinanceAutomationSettings({ enabled: next });
      setInfo(next ? '자동 연동을 다시 활성화했습니다.' : '자동 연동을 일시 중지했습니다.');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 변경에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeToken = async () => {
    if (busy || !status?.configured) return;
    if (!confirm('토큰을 폐기하면 자동 연동 에이전트에서 더 이상 업로드할 수 없습니다. 폐기할까요?')) {
      return;
    }
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await revokeFinanceAutomationToken();
      setIssuedToken(null);
      setInfo('자동 연동 토큰을 폐기했습니다.');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : '토큰 폐기에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || excelPasswordInput.length === 0) return;
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await updateFinanceAutomationSettings({ excelPassword: excelPasswordInput });
      setExcelPasswordInput('');
      setInfo('고정 엑셀 · ZIP 비밀번호를 암호화해 저장했습니다.');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : '비밀번호 저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleClearPassword = async () => {
    if (busy || !status?.hasExcelPassword) return;
    if (!confirm('저장된 고정 엑셀 · ZIP 비밀번호를 삭제할까요?')) return;
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await updateFinanceAutomationSettings({ excelPassword: null });
      setExcelPasswordInput('');
      setInfo('저장된 비밀번호를 삭제했습니다.');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : '비밀번호 삭제에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const statusBadge = !status?.configured
    ? { label: '미설정', cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300' }
    : status.enabled
      ? { label: '활성', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' }
      : { label: '일시 중지', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' };

  return (
    <Dialog
      title="Gmail 자동 연동"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="space-y-4 text-xs">
        <div className="rounded-xl bg-zinc-50 p-3 leading-5 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
          <div className="mb-1 flex items-center gap-1.5 font-semibold text-zinc-800 dark:text-zinc-100">
            <Mail size={14} className="text-blue-600 dark:text-blue-400" />
            자동 반영 동작 흐름
          </div>
          <p>
            뱅크샐러드 엑셀·ZIP·CSV를 내 Gmail로 보내 두면 예약 에이전트가 매일 <strong>낮 12시 · 밤 11시</strong>에 새 첨부파일을 Binder로 전송하고 완료 라벨(<code>Binder-Finance-Imported</code>)을 붙입니다.
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}
        {info && !error && (
          <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            {info}
          </p>
        )}

        {/* Section 1: Token & telemetry */}
        <section className="space-y-2.5 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
              <KeyRound size={14} />
              <span>1. API 토큰 및 실행 상태</span>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadge.cls}`}>
              {statusBadge.label}
            </span>
          </div>

          {status?.configured && status.tokenPrefix && (
            <div className="text-zinc-600 dark:text-zinc-300">
              발급된 토큰 접두어:{' '}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] dark:bg-zinc-800">
                {status.tokenPrefix}••••••••
              </code>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleIssueToken()}
              className={actionClass}
            >
              <span className="inline-flex items-center gap-1 text-xs">
                <RefreshCw size={12} />
                {status?.configured ? '토큰 재발급' : '토큰 발급'}
              </span>
            </button>

            {status?.configured && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleToggleEnabled()}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {status.enabled ? '일시 중지' : '다시 활성화'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleRevokeToken()}
                  className="rounded-lg border border-red-200 px-3 py-1.5 font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  토큰 폐기
                </button>
              </>
            )}
          </div>

          {issuedToken && (
            <div className="space-y-1.5 rounded-lg border border-blue-200 bg-blue-50 p-2.5 dark:border-blue-900/60 dark:bg-blue-950/30">
              <div className="font-semibold text-blue-900 dark:text-blue-200">
                새 토큰 (창을 닫으면 다시 확인할 수 없습니다)
              </div>
              <p className="text-[11px] text-blue-800 dark:text-blue-300">
                로컬 에이전트 설정(<code>.env.finance-automation</code>)에 등록하세요.
              </p>
              <div className="break-all rounded bg-white/90 px-2 py-1.5 font-mono text-[11px] text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
                {issuedToken}
              </div>
              <button
                type="button"
                aria-label="발급된 토큰 복사"
                onClick={() => void copyToken(issuedToken)}
                className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-white px-2.5 py-1 font-medium text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:bg-zinc-900 dark:text-blue-200"
              >
                {copiedToken ? <Check size={12} /> : <Copy size={12} />}
                토큰 복사
              </button>
            </div>
          )}

          {status?.lastImportAt && (
            <div className="rounded-lg bg-zinc-50 p-2.5 text-[11px] leading-5 dark:bg-zinc-950">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                  최근 자동 반영:{' '}
                  {status.lastImportStatus === 'success' ? (
                    <span className="text-emerald-700 dark:text-emerald-400">성공</span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400">오류</span>
                  )}
                </span>
                <span className="tabular-nums text-zinc-500">
                  {new Date(status.lastImportAt).toLocaleString('ko-KR')}
                </span>
              </div>
              {status.lastImportFileName && (
                <div className="truncate text-zinc-600 dark:text-zinc-300">
                  파일: {status.lastImportFileName}
                </div>
              )}
              {status.lastImportSummary && (
                <div className="text-zinc-700 dark:text-zinc-200">{status.lastImportSummary}</div>
              )}
              {status.lastImportError && (
                <div className="mt-0.5 flex items-start gap-1 text-red-600 dark:text-red-400">
                  <ShieldAlert size={13} className="mt-0.5 shrink-0" />
                  <span className="break-words">{status.lastImportError}</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Section 2: Encrypted fixed Excel/ZIP password */}
        <section className="space-y-2.5 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
              <Lock size={14} />
              <span>2. 고정 엑셀 · ZIP 비밀번호 (선택)</span>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                status?.hasExcelPassword
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
              }`}
            >
              {status?.hasExcelPassword ? '저장됨' : '미설정'}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            뱅크샐러드 엑셀/ZIP에 비밀번호가 걸려 있다면 서버에 AES-256-GCM으로 암호화해 보관합니다. 에이전트는 암호화된 파일만 전달하고, 복호화는 Binder 서버 내부에서 처리합니다.
          </p>

          <form onSubmit={e => void handleSavePassword(e)} className="flex flex-wrap items-center gap-2">
            <input
              type="password"
              aria-label="고정 엑셀 비밀번호"
              value={excelPasswordInput}
              onChange={e => setExcelPasswordInput(e.target.value)}
              placeholder={status?.hasExcelPassword ? '새 비밀번호 입력 시 덮어씀' : '엑셀 · ZIP 비밀번호 입력'}
              disabled={busy}
              className={`${fieldClass} flex-1 basis-40`}
            />
            <button
              type="submit"
              disabled={busy || excelPasswordInput.length === 0}
              className={actionClass}
            >
              비밀번호 저장
            </button>
            {status?.hasExcelPassword && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleClearPassword()}
                className="rounded-lg border border-zinc-200 px-3 py-2 font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                비밀번호 삭제
              </button>
            )}
          </form>
        </section>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-3.5 py-2 font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            닫기
          </button>
        </div>
      </div>
    </Dialog>
  );
}
