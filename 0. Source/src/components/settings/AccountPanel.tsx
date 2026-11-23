'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, LogOut } from 'lucide-react';
import { useBinder } from '@/store';
import { changePassword, logout } from '@/lib/repo/auth';

function extractErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return '비밀번호를 변경하지 못했어요.';
  return err.message.replace(/^POST \/api\/auth\/password:\s*/, '') || '비밀번호를 변경하지 못했어요.';
}

export const AccountPanel = () => {
  const me = useBinder(s => s.me);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  const onLogout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await logout();
      router.push('/login');
    } catch {
      setBusy(false);
    }
  };

  const toggleForm = () => {
    setFormOpen(prev => {
      const next = !prev;
      setPwError(null);
      if (next) setPwSuccess(null);
      return next;
    });
  };

  const onSubmitPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (pwBusy) return;
    setPwError(null);
    setPwSuccess(null);

    if (!currentPassword) {
      setPwError('현재 비밀번호를 입력해 주세요.');
      return;
    }
    if (newPassword.length < 8) {
      setPwError('새 비밀번호는 8자 이상으로 입력해 주세요.');
      return;
    }
    if (newPassword === currentPassword) {
      setPwError('새 비밀번호는 현재 비밀번호와 다르게 입력해 주세요.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('새 비밀번호 확인이 일치하지 않아요.');
      return;
    }

    setPwBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFormOpen(false);
      setPwSuccess('비밀번호를 변경했어요. 다음 로그인부터 새 비밀번호를 사용합니다.');
    } catch (err) {
      setPwError(extractErrorMessage(err));
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-3">
      <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">계정</h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">로그인됨: </span>
          <span className="font-medium text-zinc-800 dark:text-zinc-100">{me?.username ?? '…'}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-expanded={formOpen}
            onClick={toggleForm}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            <KeyRound size={14} strokeWidth={1.75} />
            비밀번호 변경
          </button>
          <button
            type="button"
            onClick={onLogout}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50"
          >
            <LogOut size={14} strokeWidth={1.75} />
            {busy ? '로그아웃 중…' : '로그아웃'}
          </button>
        </div>
      </div>

      {pwSuccess && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
        >
          {pwSuccess}
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={onSubmitPassword}
          className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 space-y-3 dark:border-zinc-800 dark:bg-zinc-900/50"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-zinc-600 dark:text-zinc-400">현재 비밀번호</span>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-zinc-600 dark:text-zinc-400">새 비밀번호</span>
              <input
                type="password"
                placeholder="8자 이상"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-zinc-600 dark:text-zinc-400">새 비밀번호 확인</span>
              <input
                type="password"
                placeholder="한 번 더 입력"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
          </div>

          {pwError && (
            <div
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300"
            >
              {pwError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                setPwError(null);
              }}
              disabled={pwBusy}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={pwBusy}
              className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {pwBusy ? '변경 중…' : '비밀번호 저장'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
};
