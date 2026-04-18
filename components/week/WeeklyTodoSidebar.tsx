'use client';
import { useEffect, useCallback, useState } from 'react';
import { Plus, Clock, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { Todo } from '@/lib/types';
import {
  listByPeriod,
  createTodo,
  updateTodo,
  deleteTodo,
  toggleDone,
} from '@/lib/repo/todos';
import { FocusNoteEditor } from '@/components/common/FocusNoteEditor';
import { weekKeyFromString, monthKeyFromString } from '@/lib/utils/period';
import { fromIsoWeek } from '@/lib/utils/date';
import { format } from 'date-fns';
import { useBinder } from '@/store';

interface Props {
  isoweek: string;
  onMakeBlock: (todo: Todo) => void;
}

export const WeeklyTodoSidebar = ({ isoweek, onMakeBlock }: Props) => {
  const { goals } = useBinder();
  const [weeklyTodos, setWeeklyTodos] = useState<Todo[]>([]);
  const [monthlyTodos, setMonthlyTodos] = useState<Todo[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [monthlySectionOpen, setMonthlySectionOpen] = useState(true);

  const weekKey = weekKeyFromString(isoweek);
  const monday = fromIsoWeek(isoweek);
  const monthStr = format(monday, 'yyyy-MM');
  const monthKey = monthKeyFromString(monthStr);

  const reload = useCallback(async () => {
    const [w, m] = await Promise.all([
      listByPeriod('weekly', weekKey),
      listByPeriod('monthly', monthKey),
    ]);
    setWeeklyTodos(w);
    setMonthlyTodos(m);
  }, [weekKey, monthKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  const goalTitle = (id?: string) =>
    id ? goals.find((g) => g.id === id)?.title : null;

  const weeklyParentGoalIds = new Set(
    weeklyTodos.map((t) => t.parentGoalId).filter(Boolean) as string[],
  );

  const monthlyAssignable = monthlyTodos.filter(
    (m) => !(m.parentGoalId && weeklyParentGoalIds.has(m.parentGoalId)),
  );

  const addWeeklyTodo = async () => {
    if (!draft.trim()) {
      setAdding(false);
      setDraft('');
      return;
    }
    await createTodo({
      title: draft.trim(),
      period: 'weekly',
      periodKey: weekKey,
      done: false,
      order: Date.now(),
    });
    setDraft('');
    setAdding(false);
    reload();
  };

  const pullMonthlyToWeek = async (m: Todo) => {
    await createTodo({
      title: m.title,
      parentGoalId: m.parentGoalId,
      period: 'weekly',
      periodKey: weekKey,
      done: false,
      order: Date.now(),
    });
    reload();
  };

  const handleTitleBlur = async (t: Todo, nextTitle: string) => {
    const trimmed = nextTitle.trim();
    if (!trimmed || trimmed === t.title) return;
    await updateTodo(t.id, { title: trimmed });
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm('삭제할까요?')) return;
    await deleteTodo(id);
    reload();
  };

  return (
    <aside className="border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-4 overflow-y-auto h-full">
      <FocusNoteEditor
        scope="week"
        scopeKey={weekKey}
        label="이번 주 한 문장"
        placeholder="예: 릴스 제작 루틴 실행"
      />

      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
          이번 주 TODO
        </h3>
        <ul className="space-y-1.5">
          {weeklyTodos.length === 0 && !adding && (
            <li className="text-xs text-zinc-400 py-1">없음</li>
          )}
          {weeklyTodos.map((t) => {
            const pg = goalTitle(t.parentGoalId);
            return (
              <li
                key={t.id}
                className="group flex items-start gap-2 px-1 py-1 rounded hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => {
                    toggleDone(t.id).then(reload);
                  }}
                  className="mt-0.5 w-4 h-4 rounded border-zinc-300 text-blue-600"
                />
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    defaultValue={t.title}
                    onBlur={(e) => handleTitleBlur(t, e.target.value)}
                    className={`w-full bg-transparent border-none outline-none text-xs ${
                      t.done
                        ? 'line-through text-zinc-400'
                        : 'text-zinc-900 dark:text-zinc-50'
                    }`}
                  />
                  {pg && (
                    <div className="text-[10px] text-blue-600 dark:text-blue-400 truncate">
                      🎯 {pg}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onMakeBlock(t)}
                  title="블록 만들기"
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition"
                >
                  <Clock size={12} />
                </button>
                <button
                  onClick={() => remove(t.id)}
                  title="삭제"
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-400 hover:text-red-600 transition"
                >
                  <Trash2 size={12} />
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
            onBlur={addWeeklyTodo}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addWeeklyTodo();
              if (e.key === 'Escape') {
                setAdding(false);
                setDraft('');
              }
            }}
            placeholder="TODO 제목"
            className="mt-2 w-full border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1 text-xs bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      <section>
        <button
          onClick={() => setMonthlySectionOpen(!monthlySectionOpen)}
          className="w-full flex items-center gap-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2"
        >
          {monthlySectionOpen ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
          이번 달 TODO ({monthlyAssignable.length})
        </button>
        {monthlySectionOpen && (
          <ul className="space-y-1">
            {monthlyAssignable.length === 0 && (
              <li className="text-xs text-zinc-400 py-1">
                이번 주에 올릴 항목이 없어요.
              </li>
            )}
            {monthlyAssignable.map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => pullMonthlyToWeek(m)}
                  className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-200 transition group"
                >
                  <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate text-left">
                    {m.title}
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] text-blue-600 dark:text-blue-400 shrink-0 opacity-0 group-hover:opacity-100">
                    <Plus size={10} /> 이번주로
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
};
