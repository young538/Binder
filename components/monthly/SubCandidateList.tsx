'use client';
import { Plus } from 'lucide-react';
import { useBinder } from '@/store';
import { Todo } from '@/lib/types';
import { createTodo, existsForPeriod } from '@/lib/repo/todos';

interface Props {
  periodKey: string;
  todos: Todo[];
  onChange: () => void;
}

export const SubCandidateList = ({ periodKey, todos, onChange }: Props) => {
  const { goals } = useBinder();

  const oneThing = goals.find(g => g.level === 'oneThing');
  const cores = goals.filter(g => g.level === 'mandalartCore' && g.parentId === oneThing?.id)
    .sort((a, b) => a.order - b.order);

  const usedParentGoalIds = new Set(todos.map(t => t.parentGoalId).filter(Boolean) as string[]);

  // subs per core, excluding those already a todo in this month
  const candidatesByCore = cores.map(core => {
    const subs = goals.filter(g => g.level === 'mandalartSub' && g.parentId === core.id && !usedParentGoalIds.has(g.id))
      .sort((a, b) => a.order - b.order);
    return { core, subs };
  }).filter(({ subs }) => subs.length > 0);

  const assign = async (subId: string, title: string) => {
    if (await existsForPeriod('monthly', periodKey, subId)) return;
    await createTodo({
      title,
      parentGoalId: subId,
      period: 'monthly',
      periodKey,
      done: false,
      order: Date.now(),
    });
    onChange();
  };

  return (
    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-4">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">만다라트 서브 후보</h2>
      {candidatesByCore.length === 0 ? (
        <div className="text-sm text-zinc-400">이번 달에 할 만다라트 서브가 모두 선택되었거나 만다라트 서브가 비어있어요.</div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {candidatesByCore.map(({ core, subs }) => (
            <div key={core.id}>
              <div className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5">{core.title}</div>
              <div className="space-y-1">
                {subs.map(s => (
                  <button key={s.id}
                    onClick={() => assign(s.id, s.title)}
                    className="w-full flex items-center justify-between gap-2 text-left px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-200 transition group">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">{s.title}</span>
                    <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 shrink-0 opacity-0 group-hover:opacity-100">
                      <Plus size={12} /> 이번달에
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
