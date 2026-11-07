'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { RetroSource, Todo } from '@/lib/types';
import { createTodo } from '@/lib/repo/todos';
import { nextRetroTarget, todoHref } from '@/lib/todos/planning';
import { TodoCreateInput } from '@/components/common/TodoCreateInput';
import { Dialog, fieldClass } from '@/components/common/Dialog';

export function RetroTodoAction({ source, text, beforeCreate }: { source: RetroSource; text: string; beforeCreate?: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(() => nextRetroTarget(source));
  const [created, setCreated] = useState<Todo | null>(null);
  const [busy, setBusy] = useState(false);
  return <div className="mt-3 space-y-2">
    <button type="button" disabled={!text.trim()} onClick={() => { setCreated(null); setOpen(true); }} className="rounded-lg border border-blue-200 px-3 py-2 text-sm text-blue-700 disabled:opacity-40 dark:border-blue-800 dark:text-blue-300">할 일로 추가</button>
    {created && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">할 일에 추가했어요. <Link className="underline" href={todoHref(created)}>등록한 목록 보기</Link></p>}
    {open && <Dialog title="회고에서 할 일 만들기" onClose={() => { if (!busy) setOpen(false); }}>
      <label className="mb-4 block text-sm">{target.scope === 'day' ? '실행 날짜' : '실행 주'}
        <input disabled={busy} type={target.scope === 'day' ? 'date' : 'week'} aria-label="회고 할 일 기간" value={target.scopeKey} onChange={event => setTarget({ ...target, scopeKey: event.target.value })} className={fieldClass} />
      </label>
      {target.scopeKey && <TodoCreateInput key={`${target.scope}:${target.scopeKey}`} initialValue={text.trim().replace(/\s+/g, ' ')} submitLabel="할 일 등록" className={fieldClass}
        onCreate={async (title, key) => {
          setBusy(true);
          try {
            await beforeCreate?.();
            const todo = await createTodo({ title, ...target, sourceRetro: source, status: 'pending', order: 0 }, key);
            setCreated(todo);
          } finally { setBusy(false); }
        }} onDone={() => setOpen(false)} />}
      <p className="mt-3 text-xs leading-5 text-zinc-500">같은 회고·제목·기간의 할 일이 이미 있으면 기존 항목을 사용합니다. 회고 내용은 그대로 남습니다.</p>
    </Dialog>}
  </div>;
}
