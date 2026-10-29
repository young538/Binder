'use client';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useNotifications } from '@/store/notifications';
import { useBinder } from '@/store';
import { restoreTodo } from '@/lib/repo/todos';

function Notice({ item }: { item: ReturnType<typeof useNotifications.getState>['items'][number] }) {
  const remove = useNotifications(state => state.remove);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => remove(item.id), Math.max(0, item.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [item.id, item.expiresAt, remove]);
  const undo = async () => {
    if (!item.undo || lock.current) return;
    lock.current = true;
    setBusy(true);
    try { await restoreTodo(item.undo.id); remove(item.id); }
    catch { setError('복원하지 못했어요. 시간이 지나기 전에 다시 시도해 주세요.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <div className="rounded-xl bg-zinc-900 p-3 text-sm text-white shadow-lg" role="status">
    <div className="flex items-center gap-3">
      <span className="flex-1">{item.text}</span>
      {item.undo && <button type="button" disabled={busy} onClick={() => void undo()} className="shrink-0 font-semibold text-blue-200 underline disabled:opacity-50">{busy ? '복원 중…' : '실행 취소'}</button>}
      <button type="button" aria-label="알림 닫기" onClick={() => remove(item.id)}><X size={16} /></button>
    </div>
    {error && <p role="alert" className="mt-2 text-red-200">{error}</p>}
  </div>;
}

export function NotificationCenter() {
  const items = useNotifications(state => state.items);
  const userId = useBinder(state => state.me?.userId);
  return <div className="fixed bottom-24 right-3 left-3 z-[80] ml-auto max-h-[40vh] max-w-md space-y-2 overflow-y-auto lg:bottom-5" aria-label="작업 알림">
    {items.filter(item => item.userId === userId).map(item => <Notice key={item.id} item={item} />)}
  </div>;
}
