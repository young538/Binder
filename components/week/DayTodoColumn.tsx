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
      <ul className="flex-1 p-1.5 space-y-1 overflow-y-auto max-h-48">
        {todos.length === 0 && !adding && (
          <li className="text-[10px] text-zinc-400 text-center py-3">할 일 없음</li>
        )}
        {todos.map((t) => {
          const color = catColor(t.categoryId);
          return (
            <li
              key={t.id}
              className="group flex min-h-6 items-center gap-1.5 text-[11px] leading-tight rounded relative"
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
              <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                <TodoStatusButton
                  status={t.status}
                  onChange={(next) => changeStatus(t.id, next)}
                  size="sm"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  {t.priority && (
                    <span className="h-5 shrink-0 text-[9px] leading-5 text-amber-500">
                      {'*'.repeat(t.priority)}
                    </span>
                  )}
                  <TodoTitleEditor todo={t} onCommit={editTitle} />
                </div>
              </div>
              <select
                value={t.categoryId ?? ''}
                onChange={(e) =>
                  setCategory(t.id, e.target.value || null)
                }
                title="카테고리"
                className="h-5 shrink-0 rounded border border-zinc-200 bg-white text-[9px] opacity-0 transition group-hover:opacity-100 focus:opacity-100 dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="">·</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => onMakeBlock(t)}
                title="블록 만들기"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-blue-600 opacity-0 transition hover:bg-blue-50 group-hover:opacity-100 dark:hover:bg-blue-950/40"
              >
                <Clock size={11} />
              </button>
              <button
                onClick={() => remove(t.id)}
                title="삭제"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-400 opacity-0 transition hover:text-red-600 group-hover:opacity-100"
              >
                <Trash2 size={11} />
              </button>
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
