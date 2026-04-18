'use client';
import { useEffect, useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { Goal, Todo } from '@/lib/types';
import { createTodo, listByParentGoal, existsForPeriod } from '@/lib/repo/todos';
import { monthKey } from '@/lib/utils/period';

interface Props {
  sub: Goal;
  currentMonth: Date;
}

export const SubCard = ({ sub, currentMonth }: Props) => {
  const [linkedTodos, setLinkedTodos] = useState<Todo[]>([]);
  const [busy, setBusy] = useState(false);
  const currentKey = monthKey(currentMonth);

  useEffect(() => {
    listByParentGoal(sub.id).then(ts => setLinkedTodos(ts.filter(t => t.period === 'monthly')));
  }, [sub.id]);

  const monthBadges = linkedTodos.map(t => {
    const m = t.periodKey.match(/^month:(\d{4})-(\d{2})$/);
    if (!m) return null;
    return { key: t.periodKey, label: `${parseInt(m[2])}월`, done: t.done };
  }).filter(Boolean) as { key: string; label: string; done: boolean }[];

  const alreadyThisMonth = linkedTodos.some(t => t.periodKey === currentKey);

  const assignThisMonth = async () => {
    if (alreadyThisMonth || busy) return;
    setBusy(true);
    if (await existsForPeriod('monthly', currentKey, sub.id)) {
      setBusy(false);
      return;
    }
    await createTodo({
      title: sub.title,
      parentGoalId: sub.id,
      period: 'monthly',
      periodKey: currentKey,
      done: false,
      order: Date.now(),
    });
    const ts = await listByParentGoal(sub.id);
    setLinkedTodos(ts.filter(t => t.period === 'monthly'));
    setBusy(false);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 hover:shadow-sm transition">
      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50 line-clamp-2 min-h-[2.5rem]">
        {sub.title}
      </div>
      <div className="flex items-center gap-1 flex-wrap mt-2">
        {monthBadges.map(b => (
          <span key={b.key}
            className={`text-[10px] px-1.5 py-0.5 rounded ${b.done ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'}`}>
            {b.done && <Check size={10} className="inline mr-0.5" />}
            {b.label}
          </span>
        ))}
      </div>
      <button
        onClick={assignThisMonth}
        disabled={alreadyThisMonth || busy}
        className={`mt-2 w-full flex items-center justify-center gap-1 text-xs py-1.5 rounded-md border transition
          ${alreadyThisMonth
            ? 'border-zinc-200 dark:border-zinc-800 text-zinc-400 cursor-not-allowed'
            : 'border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30'}`}>
        {alreadyThisMonth ? <><Check size={12} /> 이번 달 포함</> : <><Plus size={12} /> 이번 달에 하기</>}
      </button>
    </div>
  );
};
