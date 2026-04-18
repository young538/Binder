'use client';
import { useCallback, useEffect, useState } from 'react';
import { Habit, HabitLog } from '@/lib/types';
import { listHabits } from '@/lib/repo/habits';
import { listLogsForRange, toggleHabit } from '@/lib/repo/habitLogs';
import { toIsoDate } from '@/lib/utils/date';
import { addDays, endOfMonth, parseISO, startOfMonth } from 'date-fns';
import Link from 'next/link';

interface Props {
  yyyymm: string;
}

const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];

export const HabitCalendar = ({ yyyymm }: Props) => {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);

  const monthDate = parseISO(`${yyyymm}-01`);
  const first = startOfMonth(monthDate);
  const last = endOfMonth(monthDate);
  const days: Date[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(d);
  const today = toIsoDate(new Date());

  const reload = useCallback(async () => {
    const [h, l] = await Promise.all([
      listHabits(),
      listLogsForRange(toIsoDate(first), toIsoDate(last)),
    ]);
    setHabits(h);
    setLogs(l);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yyyymm]);

  useEffect(() => {
    reload();
  }, [reload]);

  const isDone = (habitId: string, dateStr: string) =>
    logs.some((l) => l.habitId === habitId && l.date === dateStr);

  const onToggle = async (habitId: string, dateStr: string) => {
    await toggleHabit(habitId, dateStr);
    reload();
  };

  const stats = (habitId: string) => {
    const done = logs.filter((l) => l.habitId === habitId).length;
    return { done, total: days.length };
  };

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">습관 달력</h2>
        {habits.length === 0 && (
          <Link href="/settings" className="text-xs text-blue-600 hover:underline">
            설정에서 추가 →
          </Link>
        )}
      </div>
      {habits.length === 0 ? (
        <div className="p-8 text-center text-sm text-zinc-400">
          설정 → 습관 섹션에서 추적할 습관을 추가하세요.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table
            className="w-full text-xs border-collapse"
            style={{ minWidth: `${140 + days.length * 28}px` }}
          >
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50">
                <th className="p-2 text-left sticky left-0 bg-zinc-50 dark:bg-zinc-800/80 border-r border-zinc-200 dark:border-zinc-800 min-w-[120px]">
                  습관
                </th>
                {days.map((d) => {
                  const ds = toIsoDate(d);
                  const dow = d.getDay();
                  return (
                    <th
                      key={ds}
                      className={`p-1 text-center border-r border-zinc-100 dark:border-zinc-900
                      ${ds === today ? 'bg-blue-100 dark:bg-blue-950/40' : ''}`}
                    >
                      <div
                        className={`text-[10px] font-normal
                        ${dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-zinc-500'}`}
                      >
                        {DOW_KO[dow]}
                      </div>
                      <div className="text-[11px] tabular-nums text-zinc-700 dark:text-zinc-300">
                        {d.getDate()}
                      </div>
                    </th>
                  );
                })}
                <th className="p-2 border-l border-zinc-200 dark:border-zinc-800 w-20 text-center">
                  합계
                </th>
              </tr>
            </thead>
            <tbody>
              {habits.map((h) => {
                const { done, total } = stats(h.id);
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                  <tr
                    key={h.id}
                    className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50/40 dark:hover:bg-zinc-800/20"
                  >
                    <td className="p-2 sticky left-0 bg-white dark:bg-zinc-900 border-r border-zinc-100 dark:border-zinc-900 font-medium">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ background: h.color }}
                        />
                        <span className="truncate">{h.name}</span>
                      </div>
                    </td>
                    {days.map((d) => {
                      const ds = toIsoDate(d);
                      const cellDone = isDone(h.id, ds);
                      return (
                        <td
                          key={ds}
                          className="p-0.5 text-center border-r border-zinc-100 dark:border-zinc-900"
                        >
                          <button
                            onClick={() => onToggle(h.id, ds)}
                            className="w-6 h-6 rounded-md border flex items-center justify-center transition
                              hover:scale-110 hover:shadow-sm"
                            style={{
                              background: cellDone ? h.color : 'transparent',
                              borderColor: cellDone ? h.color : 'var(--color-border)',
                            }}
                          >
                            {cellDone && <span className="text-[10px] text-zinc-900">✓</span>}
                          </button>
                        </td>
                      );
                    })}
                    <td className="p-2 text-center border-l border-zinc-200 dark:border-zinc-800 tabular-nums">
                      <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                        {done}/{total}
                      </div>
                      <div className="text-[10px] text-zinc-500">{pct}%</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
