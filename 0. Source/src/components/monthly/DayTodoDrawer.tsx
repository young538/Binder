'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { X, Plus, Trash2, Link2 } from 'lucide-react';
import type { CalendarMarker } from '@/lib/calendarMarkers';
import { Todo } from '@/lib/types';
import { listByScope, createTodo, updateTodo, deleteTodo, setStatus } from '@/lib/repo/todos';
import { useBinder } from '@/store';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { TodoStatusButton } from '@/components/common/TodoStatusButton';
import { TodoTitleEditor } from '@/components/common/TodoTitleEditor';
import { TodoRolloverButton } from '@/components/common/TodoRolloverButton';
import { TodoCreateInput } from '@/components/common/TodoCreateInput';
import { TodoDetailsButton } from '@/components/common/TodoDetailsButton';
import { TodoNote } from '@/components/common/TodoNote';

interface Props {
  dateStr: string;
  markers?: CalendarMarker[];
  onClose: () => void;
}

const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];

export const DayTodoDrawer = ({ dateStr, markers = [], onClose }: Props) => {
  const { categories, goals, projects } = useBinder();
  const [adding, setAdding] = useState(false);

  const dayDate = parseISO(dateStr);
  const title = format(dayDate, 'M월 d일', { locale: ko }) + ' (' + DOW_KO[dayDate.getDay()] + ')';

  const { value: todos, refresh } = useAsyncResource(dateStr, () => listByScope('day', dateStr), [], ['todos']);
  const reload = () => refresh();

  const updateField = async (t: Todo, patch: Partial<Todo>) => {
    await updateTodo(t.id, patch);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm('삭제할까요?')) return;
    await deleteTodo(id);
    reload();
  };

  const cyclePriority = (t: Todo) => {
    const next = t.priority == null ? 1 : t.priority === 3 ? null : (t.priority + 1) as 1 | 2 | 3;
    updateField(t, { priority: next });
  };

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" />
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-50">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {markers.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50/70 p-2.5 dark:border-indigo-900/50 dark:bg-indigo-950/30">
              {markers.map(marker => (
                <Link
                  key={marker.id}
                  href={marker.href}
                  onClick={onClose}
                  className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-indigo-700 shadow-sm hover:underline dark:bg-zinc-900 dark:text-indigo-300"
                >
                  {marker.label}
                </Link>
              ))}
            </div>
          )}
          <TodoRolloverButton date={dateStr} todos={todos} />
          {todos.length === 0 && !adding && (
            <div className="text-center text-sm text-zinc-400 py-8">할 일을 추가하세요</div>
          )}
          {todos.map(t => {
            const goal = t.parentGoalId ? goals.find(g => g.id === t.parentGoalId) : null;
            const project = t.projectId ? projects.find(p => p.id === t.projectId) : null;
            const category = t.categoryId ? categories.find(c => c.id === t.categoryId) : null;
            return (
              <div key={t.id} className="group rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">
                    <TodoStatusButton
                      status={t.status}
                      onChange={(next) => { setStatus(t.id, next).then(reload); }}
                    />
                  </div>
                  <TodoTitleEditor
                    todo={t}
                    onCommit={(todo, nextTitle) => updateField(todo, { title: nextTitle })}
                    textClassName="text-zinc-800 dark:text-zinc-50"
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <TodoDetailsButton todo={t} />
                  <button onClick={() => cyclePriority(t)}
                    className={`text-xs px-2 py-0.5 rounded border transition
                      ${t.priority ? 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-amber-600'}`}>
                    {t.priority ? '*'.repeat(t.priority) : '우선순위'}
                  </button>
                  <select value={t.categoryId ?? ''}
                    onChange={e => updateField(t, { categoryId: e.target.value || null })}
                    title="카테고리" className="min-w-0 max-w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-1 bg-white dark:bg-zinc-950">
                    <option value="">카테고리</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {category && (
                    <span className="w-2 h-2 rounded-full" style={{ background: category.color }} />
                  )}
                  <select value={t.parentGoalId ?? ''}
                    onChange={e => updateField(t, { parentGoalId: e.target.value || null })}
                    title="목표 연결" className="min-w-0 max-w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-1 bg-white dark:bg-zinc-950">
                    <option value="">목표 연결</option>
                    {goals.filter(g => g.level === 'mandalartSub' || g.level === 'mandalartCore').map(g => (
                      <option key={g.id} value={g.id}>{g.title}</option>
                    ))}
                  </select>
                  {project && t.projectId && (
                    <Link href={`/projects?project=${encodeURIComponent(t.projectId)}`}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline truncate">
                      📁 {project.title}
                    </Link>
                  )}
                  {goal && (
                    <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <Link2 size={10} /> {goal.title}
                    </span>
                  )}
                  <button onClick={() => remove(t.id)} aria-label={`${t.title} 삭제`}
                    className="rounded p-1.5 text-zinc-500 hover:text-red-600 transition">
                    <Trash2 size={14} />
                  </button>
                </div>
                <TodoNote todo={t} />
              </div>
            );
          })}

          {adding && (
            <TodoCreateInput
              key={dateStr}
              onCreate={(title, requestKey) => createTodo({
                title, scope: 'day', scopeKey: dateStr, status: 'pending', order: todos.length,
              }, requestKey)}
              onDone={() => { setAdding(false); void reload(); }}
              className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>

        <div className="border-t border-zinc-200 dark:border-zinc-800 p-3">
          <button onClick={() => setAdding(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm">
            <Plus size={16} /> TODO 추가
          </button>
        </div>
      </div>
    </div>
  );
};
