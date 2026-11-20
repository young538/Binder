'use client';
import { useId, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, StickyNote } from 'lucide-react';
import type { Todo } from '@/lib/types';
import { updateTodo } from '@/lib/repo/todos';

export function TodoNote({ todo }: { todo: Todo }) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState<{ previous: Todo['note']; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  // Keep a successful save visible while the shared TODO resource reloads.
  const note = saved && saved.previous === todo.note ? saved.text : (todo.note ?? '');

  const startEditing = () => {
    setDraft(note);
    setError('');
    setEditing(true);
  };

  const cancel = () => {
    if (lock.current) return;
    setEditing(false);
    setError('');
    if (!note) setOpen(false);
  };

  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    const text = draft.trim();
    try {
      await updateTodo(todo.id, { note: text || null });
      setSaved({ previous: todo.note, text });
      setEditing(false);
      if (!text) setOpen(false);
    } catch {
      setError('메모를 저장하지 못했어요. 작성한 내용은 유지됩니다. 다시 저장해 주세요.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const label = open ? '메모 접기' : note ? '메모 보기' : '메모 추가';
  return (
    <div className="min-w-0">
      <button type="button" aria-label={`${todo.title} ${label}`} aria-expanded={open} aria-controls={panelId}
        disabled={busy} onClick={() => {
          if (!open && !note && !editing) startEditing();
          setOpen(!open);
        }}
        className={`inline-flex min-h-8 items-center gap-1 rounded px-1 text-sm hover:bg-blue-50 dark:hover:bg-blue-950/40 ${note ? 'text-blue-700 dark:text-blue-300' : 'text-zinc-600 dark:text-zinc-400'}`}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <StickyNote size={14} />{label}
      </button>
      {open && (
        <div id={panelId} className="mt-1 rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-900">
          {editing ? (
            <form onSubmit={event => { event.preventDefault(); void save(); }} className="space-y-2">
              <textarea autoFocus aria-label={`${todo.title} 메모`} rows={4} value={draft} disabled={busy}
                placeholder="진행 내용이나 기억할 내용을 적어 보세요."
                onChange={event => setDraft(event.target.value)}
                onKeyDown={event => {
                  if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
                  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void save(); }
                  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); }
                }}
                className="w-full min-w-0 resize-y rounded-md border border-zinc-300 bg-white p-2 text-base leading-6 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100" />
              {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={busy} className="rounded-md bg-blue-600 px-2 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{busy ? '저장 중…' : '메모 저장'}</button>
                <button type="button" onClick={cancel} disabled={busy} className="rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800">취소</button>
              </div>
            </form>
          ) : (
            <>
              <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-700 [overflow-wrap:anywhere] dark:text-zinc-200">{note}</p>
              <button type="button" onClick={startEditing} className="mt-2 rounded px-1 py-1 text-sm font-medium text-blue-700 hover:underline dark:text-blue-300">메모 편집</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
