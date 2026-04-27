'use client';
import { useCallback, useEffect, useState } from 'react';
import { Habit, HabitLog, Weekday } from '@/lib/types';
import { listHabits } from '@/lib/repo/habits';
import { listLogsForRange, toggleHabit } from '@/lib/repo/habitLogs';
import { toIsoDate, weekDates } from '@/lib/utils/date';
import Link from 'next/link';

interface Props {
  isoweek: string;
}

const DOW_KO = ['월', '화', '수', '목', '금', '토', '일'];

// Does this habit's schedule allow a check on the given weekday?
// perWeek/perMonth: any day qualifies.
const scheduleMatches = (h: Habit, dow: Weekday): boolean => {
  const s = h.schedule;
  if (!s || s.kind === 'daily' || s.kind === 'perWeek' || s.kind === 'perMonth') return true;
  return s.days.includes(dow);
};

export const WeeklyHabitCalendar = ({ isoweek }: Props) => {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);

  const days = weekDates(isoweek); // Monday-first
  const today = toIsoDate(new Date());
  const start = toIsoDate(days[0]);
  const end = toIsoDate(days[6]);

  const reload = useCallback(async () => {
    const [h, l] = await Promise.all([listHabits(), listLogsForRange(start, end)]);
    setHabits(h);
    setLogs(l);
  }, [start, end]);

  useEffect(() => {
    reload();
  }, [reload]);

  const isDone = (habitId: string, dateStr: string) =>
    logs.some((l) => l.habitId === habitId && l.date === dateStr);

  const onToggle = async (habitId: string, dateStr: string) => {
    await toggleHabit(habitId, dateStr);
    reload();
  };

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-50">주간 습관 달력</h2>
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
          <table className="w-full text-xs border-collapse" style={{ minWidth: '420px' }}>
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50">
                <th className="p-2 text-left sticky left-0 bg-zinc-50 dark:bg-zinc-800/80 border-r border-zinc-200 dark:border-zinc-800 min-w-[140px]">
                  습관
                </th>
                {days.map((d, i) => {
                  const ds = toIsoDate(d);
                  const dow = d.getDay();
                  return (
                    <th
                      key={ds}
                      className={`p-1.5 text-center border-r border-zinc-100 dark:border-zinc-900
                      ${ds === today ? 'bg-blue-100 dark:bg-blue-950/40' : ''}`}
                    >
                      <div
                        className={`text-[11px] font-medium
                        ${dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-zinc-500'}`}
                      >
                        {DOW_KO[i]}
                      </div>
                      <div className="text-sm tabular-nums text-zinc-700 dark:text-zinc-300 font-semibold">
                        {d.getDate()}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {habits.map((h) => (
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
                    const dow = d.getDay() as Weekday;
                    const applies = scheduleMatches(h, dow);
                    const cellDone = isDone(h.id, ds);
                    return (
                      <td
                        key={ds}
                        className={`p-1 text-center border-r border-zinc-100 dark:border-zinc-900
                          ${!applies ? 'bg-zinc-50/50 dark:bg-zinc-800/20' : ''}`}
                      >
                        <button
                          onClick={() => onToggle(h.id, ds)}
                          disabled={!applies}
                          className={`w-8 h-8 rounded-md border flex items-center justify-center transition
                            ${applies ? 'hover:scale-110 hover:shadow-sm' : 'opacity-30 cursor-not-allowed'}`}
                          style={{
                            background: cellDone ? h.color : 'transparent',
                            borderColor: cellDone ? h.color : 'var(--color-border)',
                          }}
                          title={applies ? '클릭해 체크' : '스케줄에 해당하지 않는 요일'}
                        >
                          {cellDone && <span className="text-xs text-zinc-800">✓</span>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
