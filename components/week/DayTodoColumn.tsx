'use client';
import { useEffect, useState } from 'react';
import { Plus, Clock, Trash2 } from 'lucide-react';
import { Todo } from '@/lib/types';
import {
  listByDate,
  createTodo,
  updateTodo,
  deleteTodo,
  toggleDone,
} from '@/lib/repo/todos';
import { useBinder } from '@/store';

interface Props {
  dateStr: string;
  refreshKey: number;
  onMakeBlock: (todo: Todo) => void;
  onChanged: () => void;
}

export const DayTodoColumn = ({
  dateStr,
  refreshKey,
  onMakeBlock,
  onChanged,
}: Props) => {
  const { categories } = useBinder();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const reload = () => listByDate(dateStr).then(setTodos);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr, refreshKey]);

  const add = async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setAdding(false);
      setDraft('');
      return;
    }
    await createTodo({
      title: trimmed,
      date: dateStr,
      done: false,
      order: todos.length,
    });
    setDraft('');
    setAdding(false);
    reload();
    onChanged();
  };

  const toggle = async (id: string) => {
    await toggleDone(id);
    reload();
    onChanged();
  };

  const remove = async (id: string) => {
    if (!confirm('삭제?')) return;
    await deleteTodo(id);
    reload();
    onChanged();
  };

  const editTitle = async (t: Todo, v: string) => {
    const trimmed = v.trim();
    if (!trimmed || trimmed === t.title) return;
    await updateTodo(t.id, { title: trimmed });
    reload();
    onChanged();
  };

  const catColor = (id?: string) =>
    id ? categories.find((c) => c.id === id)?.color : null;

  return (
    <div className="flex flex-col border-r border-zinc-100 dark:border-zinc-900 last:border-r-0 min-h-[120px]">
      <ul className="flex-1 p-1.5 space-y-1 overflow-y-auto max-h-48">
        {todos.length === 0 && !adding && (
          <li className="text-[10px] text-zinc-400 text-center py-3">할 일 없음</li>
        )}
        {todos.map((t) => {
          const color = catColor(t.categoryId);
          return (
            <li
              key={t.id}
              className="group flex items-start gap-1 text-[11px] leading-tight hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded px-1 py-0.5"
            >
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => toggle(t.id)}
                className="mt-0.5 w-3 h-3 rounded border-zinc-300 text-blue-600 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-1">
                  {color && (
                    <span
                      className="w-1.5 h-1.5 rounded-full mt-1 shrink-0"
                      style={{ background: color }}
                    />
                  )}
                  {t.priority && (
                    <span className="text-amber-500 text-[9px] shrink-0">
                      {'*'.repeat(t.priority)}
                    </span>
                  )}
                  <input
                    type="text"
                    defaultValue={t.title}
                    onBlur={(e) => editTitle(t, e.target.value)}
                    className={`flex-1 min-w-0 bg-transparent border-none outline-none text-[11px] ${
                      t.done ? 'line-through text-zinc-400' : ''
                    }`}
                  />
                </div>
              </div>
              <button
                onClick={() => onMakeBlock(t)}
                title="블록 만들기"
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition shrink-0"
              >
                <Clock size={11} />
              </button>
              <button
                onClick={() => remove(t.id)}
                title="삭제"
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-400 hover:text-red-600 transition shrink-0"
              >
                <Trash2 size={11} />
              </button>
            </li>
          );
        })}
        {adding && (
          <li>
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
              className="w-full border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-1 text-[11px] bg-white dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </li>
        )}
      </ul>
      <button
        onClick={() => setAdding(true)}
        className="flex items-center justify-center gap-0.5 text-[10px] text-zinc-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 py-1 border-t border-zinc-100 dark:border-zinc-900 transition"
      >
        <Plus size={10} /> 추가
      </button>
    </div>
  );
};
