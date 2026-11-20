'use client';
import { useEffect, useRef, useState } from 'react';
import { Habit, HabitLog } from '@/lib/types';
import { listHabits } from '@/lib/repo/habits';
import { listLogsForRange, toggleHabit } from '@/lib/repo/habitLogs';
import { toIsoDate, weekDates } from '@/lib/utils/date';
import { canCheckHabitOnDate, habitScheduleLabel } from '@/lib/utils/habitSchedule';
import { useBinder } from '@/store';
import Link from 'next/link';

interface Props {
  isoweek: string;
  embedded?: boolean;
}

const DOW_KO = ['월', '화', '수', '목', '금', '토', '일'];

export const WeeklyHabitCalendar = ({ isoweek, embedded = false }: Props) => {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Set<string>>(new Set());
  const inFlight = useRef(new Set<string>());
  const categories = useBinder(s => s.categories);

  const days = weekDates(isoweek); // Monday-first
  const today = toIsoDate(new Date());
  const start = toIsoDate(days[0]);
  const end = toIsoDate(days[6]);
  useEffect(() => {
    let cancelled = false;
    Promise.all([listHabits(), listLogsForRange(start, end)])
      .then(([h, l]) => {
        if (cancelled) return;
        setHabits(h);
        setLogs(l);
      })
      .catch(() => {
        if (!cancelled) setError('습관을 불러오지 못했어요. 새로고침해 주세요.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [start, end]);

  const isDone = (habitId: string, dateStr: string) =>
    logs.some((l) => l.habitId === habitId && l.date === dateStr);

  const onToggle = async (habitId: string, dateStr: string) => {
    const key = `${habitId}:${dateStr}`;
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    setPending(new Set(inFlight.current));
    setError('');
    try {
      const added = await toggleHabit(habitId, dateStr);
      setLogs(current => {
        const remaining = current.filter(log => !(log.habitId === habitId && log.date === dateStr));
        return added ? [...remaining, {
          id: key, userId: '', habitId, date: dateStr, createdAt: new Date().toISOString(),
        }] : remaining;
      });
    } catch {
      setError('체크를 저장하지 못했어요. 다시 눌러 주세요.');
    } finally {
      inFlight.current.delete(key);
      setPending(new Set(inFlight.current));
    }
  };

  return (
    <section aria-label="주간 습관 체크" className={embedded
      ? 'overflow-hidden bg-white dark:bg-zinc-950'
      : 'overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'}>
      <div className="flex min-h-9 items-center justify-between gap-2 border-b border-zinc-200 px-3 py-1.5 dark:border-zinc-800">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="shrink-0 text-xs font-semibold text-zinc-800 dark:text-zinc-50">주간 습관 체크</h2>
          <span className="text-[10px] tabular-nums text-zinc-400">{days[0].getMonth() + 1}/{days[0].getDate()}–{days[6].getMonth() + 1}/{days[6].getDate()}</span>
        </div>
        <Link href="/daily" className="shrink-0 text-[11px] text-blue-600 hover:underline dark:text-blue-400">루틴 관리 →</Link>
      </div>
      {error && <p role="alert" className="px-3 py-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      {loading ? <p className="px-3 py-2 text-xs text-zinc-500">습관을 불러오는 중…</p> : habits.length === 0 && !error ? (
        <p className="px-3 py-2 text-xs text-zinc-400">루틴 관리에서 습관을 추가하세요.</p>
      ) : (
        <table className="w-full table-fixed border-collapse text-[11px]">
          <colgroup>
            <col className="w-[34%] sm:w-[38%]" />
            {days.map(day => <col key={toIsoDate(day)} />)}
          </colgroup>
          <thead>
            <tr className="h-7 bg-zinc-50 dark:bg-zinc-900">
              <th scope="col" className="px-3 text-left font-medium text-zinc-500">습관</th>
              {days.map((day, index) => (
                <th key={toIsoDate(day)} scope="col" className={`border-l border-zinc-100 text-center font-medium dark:border-zinc-800 ${toIsoDate(day) === today ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' : day.getDay() === 0 ? 'text-red-500' : day.getDay() === 6 ? 'text-blue-500' : 'text-zinc-500'}`}>
                  <span>{DOW_KO[index]}</span><span className="ml-0.5 tabular-nums">{day.getDate()}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {habits.map(habit => (
              <tr key={habit.id} className="border-t border-zinc-100 hover:bg-zinc-50/60 dark:border-zinc-800 dark:hover:bg-zinc-900/60">
                <th scope="row" className="px-3 text-left font-normal" title={`${habit.name} · ${habitScheduleLabel(habit.schedule)}`}>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: categories.find(category => category.id === habit.categoryId)?.color ?? habit.color }} />
                    <span className="truncate text-zinc-700 dark:text-zinc-200">{habit.name}</span>
                    <span className="ml-auto hidden shrink-0 text-[10px] text-zinc-400 sm:inline">{habitScheduleLabel(habit.schedule)}</span>
                  </div>
                </th>
                {days.map(day => {
                  const date = toIsoDate(day);
                  const applies = canCheckHabitOnDate(habit.schedule, day);
                  const done = isDone(habit.id, date);
                  return (
                    <td key={date} className={`border-l border-zinc-100 p-0 dark:border-zinc-800 ${!applies ? 'bg-zinc-50/60 dark:bg-zinc-900/40' : ''}`}>
                      <button type="button" onClick={() => onToggle(habit.id, date)}
                        aria-label={`${habit.name} ${date}`} aria-pressed={done} aria-busy={pending.has(`${habit.id}:${date}`)}
                        disabled={!applies || pending.has(`${habit.id}:${date}`)}
                        className="flex h-7 w-full items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-500 enabled:hover:bg-blue-50 disabled:cursor-default disabled:opacity-40 dark:enabled:hover:bg-blue-950/40"
                        title={applies ? `${habit.name} · ${date}` : '일정에 해당하지 않는 요일'}>
                        {applies ? <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center rounded-[3px] border text-[10px] text-zinc-800" style={{ background: done ? habit.color : 'transparent', borderColor: done ? habit.color : 'var(--color-border)' }}>{done ? '✓' : ''}</span> : <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-600">–</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};
