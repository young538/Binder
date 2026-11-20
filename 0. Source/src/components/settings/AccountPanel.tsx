'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useBinder } from '@/store';
import { logout } from '@/lib/repo/auth';

export const AccountPanel = () => {
  const me = useBinder(s => s.me);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

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

  return (
    <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-3">
      <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">계정</h2>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">로그인됨: </span>
          <span className="font-medium text-zinc-800 dark:text-zinc-100">{me?.username ?? '…'}</span>
        </div>
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
    </section>
  );
};
