'use client';
import { useEffect, useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { Goal, Todo } from '@/lib/types';
import { createTodo, listByParentGoal } from '@/lib/repo/todos';
import { toIsoDate } from '@/lib/utils/date';
import { format } from 'date-fns';

interface Props {
  sub: Goal;
  currentMonth: Date;
}

const defaultPickedDate = (currentMonth: Date): string => {
  const today = new Date();
  const sameMonth =
    today.getFullYear() === currentMonth.getFullYear() &&
    today.getMonth() === currentMonth.getMonth();
  if (sameMonth) return toIsoDate(today);
  return `${format(currentMonth, 'yyyy-MM')}-01`;
};

export const SubCard = ({ sub, currentMonth }: Props) => {
  const [linkedTodos, setLinkedTodos] = useState<Todo[]>([]);
  const [busy, setBusy] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickedDate, setPickedDate] = useState(() => defaultPickedDate(currentMonth));

  useEffect(() => {
    listByParentGoal(sub.id).then(setLinkedTodos);
  }, [sub.id]);

  useEffect(() => {
    setPickedDate(defaultPickedDate(currentMonth));
  }, [currentMonth]);

  const monthBadges = Array.from(
    linkedTodos.reduce((acc, t) => {
      const ym = t.date.slice(0, 7);
      const existing = acc.get(ym);
      if (!existing) {
        acc.set(ym, { ym, done: t.done });
      } else if (existing.done && !t.done) {
        acc.set(ym, { ym, done: false });
      }
      return acc;
    }, new Map<string, { ym: string; done: boolean }>()).values()
  ).sort((a, b) => a.ym.localeCompare(b.ym)).map(({ ym, done }) => {
    const m = ym.match(/^(\d{4})-(\d{2})$/);
    const label = m ? `${parseInt(m[2])}월` : ym;
    return { key: ym, label, done };
  });

  const assignForDate = async (dateStr: string) => {
    if (busy) return;
    const existing = linkedTodos.some(t => t.date === dateStr);
    if (existing) {
      alert('이미 그 날짜에 있어요');
      return;
    }
    setBusy(true);
    await createTodo({
      title: sub.title,
      parentGoalId: sub.id,
      date: dateStr,
      done: false,
      order: Date.now(),
    });
    const ts = await listByParentGoal(sub.id);
    setLinkedTodos(ts);
    setBusy(false);
    setShowPicker(false);
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
      {showPicker ? (
        <div className="flex gap-1 mt-2">
          <input
            type="date"
            value={pickedDate}
            onChange={e => setPickedDate(e.target.value)}
            className="flex-1 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs px-1.5 py-1 rounded-md" />
          <button
            onClick={() => assignForDate(pickedDate)}
            disabled={busy}
            className="px-2 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            추가
          </button>
          <button
            onClick={() => setShowPicker(false)}
            className="px-2 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            취소
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowPicker(true)}
          className="mt-2 w-full flex items-center justify-center gap-1 text-xs py-1.5 rounded-md border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition">
          <Plus size={12} /> 날짜 선택 후 추가
        </button>
      )}
    </div>
  );
};
