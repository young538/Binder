'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Todo, TodoScope } from '@/lib/types';
import {
  listByScope,
  createTodo,
  updateTodo,
  deleteTodo,
  toggleDone,
} from '@/lib/repo/todos';
import { useBinder } from '@/store';

interface Props {
  scope: TodoScope;
  scopeKey: string;
  title: string;
}

export const TodoListSection = ({ scope, scopeKey, title }: Props) => {
  const { goals } = useBinder();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const reload = () => listByScope(scope, scopeKey).then(setTodos);
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, scopeKey]);

  const add = async () => {
    if (!draft.trim()) {
      setAdding(false);
      setDraft('');
      return;
    }
    await createTodo({
      title: draft.trim(),
      scope,
      scopeKey,
      done: false,
      order: todos.length,
    });
    setDraft('');
    setAdding(false);
    reload();
  };

  const editTitle = async (t: Todo, v: string) => {
    const trimmed = v.trim();
    if (!trimmed || trimmed === t.title) return;
    await updateTodo(t.id, { title: trimmed });
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm('삭제할까요?')) return;
    await deleteTodo(id);
    reload();
  };

  const goalTitle = (id?: string) =>
    id ? goals.find((g) => g.id === id)?.title : null;

  return (
    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-4">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
        {title}
      </h3>
      <ul className="space-y-1.5">
        {todos.length === 0 && !adding && (
          <li className="text-xs text-zinc-400 py-1">없음</li>
        )}
        {todos.map((t) => {
          const pg = goalTitle(t.parentGoalId);
          return (
            <li key={t.id} className="group flex items-start gap-2 py-0.5">
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => {
                  toggleDone(t.id).then(reload);
                }}
                className="mt-1 w-4 h-4 rounded border-zinc-300 text-blue-600"
              />
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  defaultValue={t.title}
                  onBlur={(e) => editTitle(t, e.target.value)}
                  className={`w-full bg-transparent border-none outline-none text-sm ${
                    t.done
                      ? 'line-through text-zinc-400'
                      : 'text-zinc-900 dark:text-zinc-50'
                  }`}
                />
                {pg && (
                  <div className="text-[11px] text-blue-600 dark:text-blue-400 truncate">
                    🎯 {pg}
                  </div>
                )}
              </div>
              <button
                onClick={() => remove(t.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-600 transition"
              >
                <Trash2 size={14} />
              </button>
            </li>
          );
        })}
      </ul>
      {adding ? (
        <input
          type="text"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={add}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
            if (e.key === 'Escape') {
              setAdding(false);
              setDraft('');
            }
          }}
          placeholder="할 일"
          className="mt-2 w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-2 flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-blue-600"
        >
          <Plus size={12} /> 추가
        </button>
      )}
    </section>
  );
};
