'use client';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Todo } from '@/lib/types';
import { createTodo, updateTodo, deleteTodo, toggleDone } from '@/lib/repo/todos';
import { useBinder } from '@/store';

interface Props {
  periodKey: string;
  todos: Todo[];
  onChange: () => void;
}

export const MonthlyTodoList = ({ periodKey, todos, onChange }: Props) => {
  const { goals } = useBinder();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const goalTitle = (id?: string) => id ? goals.find(g => g.id === id)?.title : null;

  const handleAdd = async () => {
    if (!draft.trim()) { setAdding(false); setDraft(''); return; }
    await createTodo({
      title: draft.trim(),
      period: 'monthly',
      periodKey,
      done: false,
      order: Date.now(),
    });
    setDraft('');
    setAdding(false);
    onChange();
  };

  const handleToggle = async (id: string) => {
    await toggleDone(id);
    onChange();
  };

  const handleTitleBlur = async (t: Todo, nextTitle: string) => {
    const trimmed = nextTitle.trim();
    if (!trimmed || trimmed === t.title) return;
    await updateTodo(t.id, { title: trimmed });
    onChange();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('삭제할까요?')) return;
    await deleteTodo(id);
    onChange();
  };

  return (
    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-4">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">이번 달 TODO</h2>
      <ul className="space-y-2">
        {todos.length === 0 && !adding && (
          <li className="text-sm text-zinc-400 py-2">아직 TODO가 없어요.</li>
        )}
        {todos.map(t => {
          const pg = goalTitle(t.parentGoalId);
          return (
            <li key={t.id} className="flex items-start gap-2 group">
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => handleToggle(t.id)}
                className="mt-1 w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500" />
              <div className="flex-1">
                <input
                  type="text"
                  defaultValue={t.title}
                  onBlur={e => handleTitleBlur(t, e.target.value)}
                  className={`w-full bg-transparent border-none outline-none text-sm ${t.done ? 'line-through text-zinc-400' : 'text-zinc-900 dark:text-zinc-50'}`} />
                {pg && (
                  <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">🎯 {pg}</div>
                )}
              </div>
              <button onClick={() => handleDelete(t.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-600 transition">
                <Trash2 size={14} />
              </button>
            </li>
          );
        })}
      </ul>
      {adding ? (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={draft}
            autoFocus
            onChange={e => setDraft(e.target.value)}
            onBlur={handleAdd}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') { setAdding(false); setDraft(''); }
            }}
            placeholder="TODO 제목"
            className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-3 flex items-center gap-1.5 px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">
          <Plus size={14} /> TODO 추가
        </button>
      )}
    </section>
  );
};
