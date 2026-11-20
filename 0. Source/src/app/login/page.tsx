'use client';
import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  // next 파라미터는 같은 origin 의 절대 경로만 허용 — javascript: / 외부 URL / 프로토콜 상대 URL 차단
  const rawNext = search.get('next') ?? '/';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.error ?? '로그인 실패');
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setErr('네트워크 오류');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 space-y-4"
    >
      <div className="text-center mb-2">
        <div className="text-lg font-bold text-zinc-800 dark:text-zinc-50">Super 플래너</div>
        <div className="text-xs text-zinc-500">로그인</div>
      </div>
      <label className="flex flex-col text-xs">
        <span className="text-zinc-500 mb-1">아이디</span>
        <input
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoComplete="username"
          className="border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-zinc-950 outline-none focus:ring-2 focus:ring-blue-500"
        />
      </label>
      <label className="flex flex-col text-xs">
        <span className="text-zinc-500 mb-1">비밀번호</span>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
          autoFocus
          className="border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-zinc-950 outline-none focus:ring-2 focus:ring-blue-500"
        />
      </label>
      {err && (
        <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-md">
          {err}
        </div>
      )}
      <button
        type="submit"
        disabled={loading || !password}
        className="w-full py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold"
      >
        {loading ? '로그인 중…' : '로그인'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
      <Suspense fallback={<div className="text-sm text-zinc-500">로딩 중…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
