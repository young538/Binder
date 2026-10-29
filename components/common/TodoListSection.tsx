'use client';
import { useState } from 'react';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { Plus, Trash2 } from 'lucide-react';
import { Todo, TodoScope } from '@/lib/types';
import {
  listByScope,
  createTodo,
  updateTodo,
  deleteTodo,
  setStatus,
} from '@/lib/repo/todos';
import { useBinder } from '@/store';
import { tint } from '@/lib/utils/color';
import { TodoStatusButton } from '@/components/common/TodoStatusButton';
import { TodoTitleEditor } from '@/components/common/TodoTitleEditor';
import { TodoRolloverButton } from '@/components/common/TodoRolloverButton';
import { TodoCreateInput } from '@/components/common/TodoCreateInput';

interface Props {
  scope: TodoScope;
  scopeKey: string;
  title: string;
}

export const TodoListSection = ({ scope, scopeKey, title }: Props) => {
  const { goals, categories } = useBinder();
  const [adding, setAdding] = useState(false);

  const { value: todos, refresh } = useAsyncResource(
    `${scope}:${scopeKey}`, () => listByScope(scope, scopeKey), [], ['todos'],
  );
  const reload = () => refresh();

  const editTitle = async (t: Todo, nextTitle: string) => {
    await updateTodo(t.id, { title: nextTitle });
    reload();
  };

  const setCategory = async (id: string, categoryId: string | null) => {
    await updateTodo(id, { categoryId });
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm('삭제할까요?')) return;
    await deleteTodo(id);
    reload();
  };

  const goalTitle = (id?: string | null) =>
    id ? goals.find((g) => g.id === id)?.title : null;

  const category = (id?: string | null) =>
    id ? categories.find((c) => c.id === id) : undefined;

  return (
    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-4">
      <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-50 mb-3">
        {title}
      </h3>
      {scope === 'day' && <TodoRolloverButton date={scopeKey} todos={todos} />}
      <ul className="space-y-1.5">
        {todos.length === 0 && !adding && (
          <li className="text-xs text-zinc-400 py-1">없음</li>
        )}
        {todos.map((t) => {
          const pg = goalTitle(t.parentGoalId);
          const cat = category(t.categoryId);
          return (
            <li
              key={t.id}
              className="group flex items-start gap-2 rounded-md relative"
              style={
                cat
                  ? {
                      borderLeft: `3px solid ${cat.color}`,
                      background: tint.subtle(cat.color),
                      paddingLeft: '0.5rem',
                    }
                  : undefined
              }
            >
              <div className="mt-1.5">
                <TodoStatusButton
                  status={t.status}
                  onChange={(next) => {
                    setStatus(t.id, next).then(reload);
                  }}
                  size="sm"
                />
              </div>
              <div className="flex-1 min-w-0 py-1">
                <TodoTitleEditor
                  todo={t}
                  onCommit={editTitle}
                  className="py-0.5"
                  textClassName="text-sm text-zinc-800 dark:text-zinc-50"
                />
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  {cat && (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ background: tint.soft(cat.color) }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: cat.color }}
                      />
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {cat.name}
                      </span>
                    </span>
                  )}
                  {pg && (
                    <span className="text-[11px] text-blue-600 dark:text-blue-400 truncate">
                      🎯 {pg}
                    </span>
                  )}
                </div>
              </div>
              <select
                value={t.categoryId ?? ''}
                onChange={(e) => setCategory(t.id, e.target.value || null)}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 mt-1.5 text-[10px] border border-zinc-200 dark:border-zinc-700 rounded px-1 py-0.5 bg-white dark:bg-zinc-950 transition"
                title="카테고리"
              >
                <option value="">카테고리</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                aria-label={`${t.title} 삭제`}
                onClick={() => remove(t.id)}
                className="opacity-0 group-hover:opacity-100 p-1 mt-1 text-zinc-400 hover:text-red-600 transition shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </li>
          );
        })}
      </ul>
      {adding ? (
        <TodoCreateInput
          key={`${scope}:${scopeKey}`}
          onCreate={(title, requestKey) => createTodo({
            title, scope, scopeKey, status: 'pending', order: todos.length,
          }, requestKey)}
          onDone={() => { setAdding(false); void reload(); }}
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
