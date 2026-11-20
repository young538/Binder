'use client';
import { useState } from 'react';
import { Plus, Clock, Trash2 } from 'lucide-react';
import { Todo } from '@/lib/types';
import {
  createTodo,
  updateTodo,
  deleteTodo,
  setStatus,
} from '@/lib/repo/todos';
import { useBinder } from '@/store';
import { useWeeklyData } from './WeeklyDataProvider';
import { tint } from '@/lib/utils/color';
import { TodoStatusButton } from '@/components/common/TodoStatusButton';
import { TodoTitleEditor } from '@/components/common/TodoTitleEditor';
import { TodoRolloverButton } from '@/components/common/TodoRolloverButton';
import { TodoCreateInput } from '@/components/common/TodoCreateInput';
import { TodoDetailsButton } from '@/components/common/TodoDetailsButton';
import { TodoNote } from '@/components/common/TodoNote';

interface Props {
  dateStr: string;
  onMakeBlock: (todo: Todo) => void;
}

export const DayTodoColumn = ({
  dateStr,
  onMakeBlock,
}: Props) => {
  const { categories } = useBinder();
  const { todos: weekTodos } = useWeeklyData();
  const todos = weekTodos.filter((todo) => todo.scopeKey === dateStr);
  const [adding, setAdding] = useState(false);
  const changeStatus = async (id: string, next: Todo['status']) => {
    await setStatus(id, next);
  };

  const remove = async (id: string) => {
    if (!confirm('삭제?')) return;
    await deleteTodo(id);
  };

  const editTitle = async (t: Todo, nextTitle: string) => {
    await updateTodo(t.id, { title: nextTitle });
  };

  const setCategory = async (id: string, categoryId: string | null) => {
    await updateTodo(id, { categoryId });
  };

  const catColor = (id?: string | null) =>
    id ? categories.find((c) => c.id === id)?.color : null;

  return (
    <div className="flex flex-col border-r border-zinc-100 dark:border-zinc-900 last:border-r-0 min-h-[120px]">
      <TodoRolloverButton date={dateStr} todos={todos} />
      <ul className="flex-1 p-1.5 space-y-2 md:max-h-96 md:overflow-y-auto">
        {todos.length === 0 && !adding && (
          <li className="text-sm text-zinc-500 text-center py-3">할 일 없음</li>
        )}
        {todos.map((t) => {
          const color = catColor(t.categoryId);
          return (
            <li
              key={t.id}
              className="group min-w-0 space-y-1 rounded-lg border border-zinc-200 py-2 text-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
              style={
                color
                  ? {
                      borderLeft: `2px solid ${color}`,
                      background: tint.subtle(color),
                      paddingLeft: '0.25rem',
                      paddingRight: '0.25rem',
                    }
                  : { paddingLeft: '0.25rem', paddingRight: '0.25rem' }
              }
            >
              <div className="flex items-start gap-1">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-1">
                    {t.priority && (
                      <span className="shrink-0 text-xs leading-6 text-amber-600">
                        {'*'.repeat(t.priority)}
                      </span>
                    )}
                    <TodoTitleEditor todo={t} onCommit={editTitle} />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1 border-t border-zinc-100 pt-1 dark:border-zinc-800">
                <TodoStatusButton status={t.status} onChange={(next) => changeStatus(t.id, next)} />
                <TodoDetailsButton todo={t} />
                <select
                  value={t.categoryId ?? ''}
                  onChange={(e) =>
                    setCategory(t.id, e.target.value || null)
                  }
                  title="카테고리"
                  className="h-7 min-w-0 max-w-full rounded border border-zinc-200 bg-white px-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                >
                  <option value="">분류</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => onMakeBlock(t)}
                  title="블록 만들기"
                  aria-label={`${t.title} 블록 만들기`}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-blue-600 transition hover:bg-blue-50 dark:hover:bg-blue-950/40"
                >
                  <Clock size={14} />
                </button>
                <button
                  onClick={() => remove(t.id)}
                  title="삭제"
                  aria-label={`${t.title} 삭제`}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-zinc-500 transition hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <TodoNote todo={t} />
            </li>
          );
        })}
        {adding && (
          <li>
            <TodoCreateInput
              key={dateStr}
              onCreate={(title, requestKey) => createTodo({
                title, scope: 'day', scopeKey: dateStr, status: 'pending', order: todos.length,
              }, requestKey)}
              onDone={() => { setAdding(false); }}
              className="w-full border border-zinc-200 dark:border-zinc-700 rounded px-2 py-2 text-base sm:text-sm bg-white dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </li>
        )}
      </ul>
      <button
        onClick={() => setAdding(true)}
        className="flex items-center justify-center gap-1 text-sm text-zinc-600 dark:text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 py-2 border-t border-zinc-100 dark:border-zinc-900 transition"
      >
        <Plus size={14} /> 추가
      </button>
    </div>
  );
};
