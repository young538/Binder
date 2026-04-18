'use client';
import { useEffect, useState } from 'react';
import { X, Plus, Trash2, Link2 } from 'lucide-react';
import { Todo } from '@/lib/types';
import { listByScope, createTodo, updateTodo, deleteTodo, setStatus } from '@/lib/repo/todos';
import { useBinder } from '@/store';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { TodoStatusButton } from '@/components/common/TodoStatusButton';
import { statusRowClass } from '@/lib/utils/todoStatus';

interface Props {
  dateStr: string;
  onClose: () => void;
}

const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];

export const DayTodoDrawer = ({ dateStr, onClose }: Props) => {
  const { categories, goals } = useBinder();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const dayDate = parseISO(dateStr);
  const title = format(dayDate, 'M월 d일', { locale: ko }) + ' (' + DOW_KO[dayDate.getDay()] + ')';

  const reload = () => listByScope('day', dateStr).then(setTodos);
  useEffect(() => { reload(); }, [dateStr]);

  const addTodo = async () => {
    if (!draft.trim()) { setAdding(false); setDraft(''); return; }
    await createTodo({
      title: draft.trim(),
      scope: 'day',
      scopeKey: dateStr,
      status: 'pending',
      order: todos.length,
    });
    setDraft('');
    setAdding(false);
    reload();
  };

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
    const next = t.priority === undefined ? 1 : t.priority === 3 ? undefined : (t.priority + 1) as 1 | 2 | 3;
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
          {todos.length === 0 && !adding && (
            <div className="text-center text-sm text-zinc-400 py-8">할 일을 추가하세요</div>
          )}
          {todos.map(t => {
            const goal = t.parentGoalId ? goals.find(g => g.id === t.parentGoalId) : null;
            const category = t.categoryId ? categories.find(c => c.id === t.categoryId) : null;
            return (
              <div key={t.id} className="group rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">
                    <TodoStatusButton
                      status={t.status}
                      onChange={(next) => { setStatus(t.id, next).then(reload); }}
                      size="sm"
                    />
                  </div>
                  <input type="text" defaultValue={t.title}
                    onBlur={e => {
                      const v = e.target.value.trim();
                      if (v && v !== t.title) updateField(t, { title: v });
                    }}
                    className={`flex-1 bg-transparent border-none outline-none text-sm text-zinc-800 dark:text-zinc-50 ${statusRowClass(t.status)}`} />
                  <button onClick={() => remove(t.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-600 transition">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap pl-6">
                  <button onClick={() => cyclePriority(t)}
                    className={`text-xs px-2 py-0.5 rounded border transition
                      ${t.priority ? 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-amber-600'}`}>
                    {t.priority ? '*'.repeat(t.priority) : '우선순위'}
                  </button>
                  <select value={t.categoryId ?? ''}
                    onChange={e => updateField(t, { categoryId: e.target.value || undefined })}
                    className="text-xs border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-0.5 bg-white dark:bg-zinc-950">
                    <option value="">카테고리</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {category && (
                    <span className="w-2 h-2 rounded-full" style={{ background: category.color }} />
                  )}
                  <select value={t.parentGoalId ?? ''}
                    onChange={e => updateField(t, { parentGoalId: e.target.value || undefined })}
                    className="text-xs border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-0.5 bg-white dark:bg-zinc-950">
                    <option value="">목표 연결</option>
                    {goals.filter(g => g.level === 'mandalartSub' || g.level === 'mandalartCore').map(g => (
                      <option key={g.id} value={g.id}>{g.title}</option>
                    ))}
                  </select>
                  {goal && (
                    <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <Link2 size={10} /> {goal.title}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {adding && (
            <input type="text" value={draft} autoFocus
              onChange={e => setDraft(e.target.value)}
              onBlur={addTodo}
              onKeyDown={e => {
                if (e.key === 'Enter') addTodo();
                if (e.key === 'Escape') { setAdding(false); setDraft(''); }
              }}
              placeholder="할 일"
              className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
