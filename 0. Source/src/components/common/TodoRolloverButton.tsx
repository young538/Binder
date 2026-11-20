'use client';
import { useRef, useState } from 'react';
import { CalendarArrowUp } from 'lucide-react';
import type { Todo } from '@/lib/types';
import { rolloverTodos } from '@/lib/repo/todos';

export function TodoRolloverButton({ date, todos }: { date: string; todos: Todo[] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const ids = todos.filter(todo => todo.scope === 'day' && todo.scopeKey === date
    && (todo.status === 'pending' || todo.status === 'postponed')).map(todo => todo.id);
  const move = async () => {
    if (lock.current || !ids.length) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try { await rolloverTodos(date, ids); }
    catch { setError('옮기지 못했어요. 다시 시도해 주세요.'); }
    finally { lock.current = false; setBusy(false); }
  };
  if (!ids.length && !error) return null;
  return <div className="my-2 text-xs">
    <button type="button" onClick={() => void move()} disabled={busy || !ids.length}
      title="미완료·연기한 할 일을 다음 날로 이동합니다. 시간 기록은 그대로 남습니다."
      className="inline-flex items-center gap-1 rounded px-2 py-1 text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-300 dark:hover:bg-blue-950">
      <CalendarArrowUp size={13} />{busy ? '옮기는 중…' : `미완료 ${ids.length}개 다음 날로`}
    </button>
    {error && <p role="alert" className="text-red-600">{error}</p>}
  </div>;
}
