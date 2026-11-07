'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { createTodo } from '@/lib/repo/todos';
import { TodoCreateInput } from '@/components/common/TodoCreateInput';
import { Dialog, fieldClass } from '@/components/common/Dialog';

export function QuickCapture() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === 'n') { event.preventDefault(); setOpen(true); }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  return <>
    <button type="button" onClick={() => setOpen(true)} title="빠른 메모 (Alt+N)" className={`fixed ${path.startsWith('/week/') ? 'bottom-40' : 'bottom-24'} right-4 z-30 flex items-center gap-1 rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg lg:bottom-6`}><Plus size={18} />빠른 메모</button>
    {open && <Dialog title="빠른 메모" onClose={() => setOpen(false)}>
      <p className="mb-4 text-sm text-zinc-500">떠오른 생각을 수집함에 담고, 나중에 날짜와 목표를 정하세요.</p>
      <TodoCreateInput submitLabel="수집함에 저장" onCreate={(title, key) => createTodo({ title, scope: 'inbox', scopeKey: 'inbox', status: 'pending', order: 0 }, key)} onDone={() => setOpen(false)} className={fieldClass} />
      <Link href="/inbox" onClick={() => setOpen(false)} className="mt-4 block text-sm text-blue-600">수집함 열기</Link>
    </Dialog>}
  </>;
}
