'use client';
import { useEffect, useRef, useState } from 'react';
import { useBinder } from '@/store';
import { weekDates, toIsoDate } from '@/lib/utils/date';
import { getTimeBlocksInRange } from '@/lib/repo/timeBlocks';
import { getRetrospective, upsertRetrospective } from '@/lib/repo/retrospectives';
import { listDayTodosInRange } from '@/lib/repo/todos';
import { listHabits } from '@/lib/repo/habits';
import { listLogsForRange } from '@/lib/repo/habitLogs';
import { Retrospective, TimeBlock, Todo } from '@/lib/types';
import { WeeklySummary, HabitStats } from './WeeklySummary';
import { RetroTemplate } from './RetroTemplate';

export const WeeklyRetroPage = ({ isoweek }: { isoweek: string }) => {
  const { categories, goals } = useBinder();
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [habitStats, setHabitStats] = useState<HabitStats>({ total: 0, logs: 0, expected: 0, percent: 0 });
  const [value, setValue] = useState<Partial<Retrospective>>({ template: {} });
  const latest = useRef<Partial<Retrospective>>({ template: {} });
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const dates = weekDates(isoweek);
    const startStr = toIsoDate(dates[0]);
    const endStr = toIsoDate(dates[6]);
    getTimeBlocksInRange(startStr, endStr).then(setBlocks);
    listDayTodosInRange(startStr, endStr).then(setTodos);
    Promise.all([listHabits(), listLogsForRange(startStr, endStr)]).then(([habitsAll, logsInWeek]) => {
      const expected = habitsAll.length * 7;
      const logs = logsInWeek.length;
      const percent = expected > 0 ? Math.round((logs / expected) * 100) : 0;
      setHabitStats({ total: habitsAll.length, logs, expected, percent });
    });
    getRetrospective('weekly', isoweek).then((r) => {
      const v = r ?? { template: {} };
      setValue(v);
      latest.current = v;
    });
  }, [isoweek]);

  const patch = (p: Partial<Retrospective>) => {
    const merged: Partial<Retrospective> = {
      ...latest.current,
      ...p,
      template: { ...latest.current.template, ...(p.template ?? {}) },
    };
    latest.current = merged;
    setValue(merged);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      upsertRetrospective('weekly', isoweek, {
        rating: merged.rating,
        template: merged.template,
        freeText: merged.freeText,
      });
    }, 1000);
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="text-xs text-zinc-500 uppercase tracking-wide">주간 회고</div>
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-50">📝 {isoweek}</h1>
      </div>
      <WeeklySummary
        isoweek={isoweek}
        blocks={blocks}
        todos={todos}
        categories={categories}
        goals={goals}
        habitStats={habitStats}
      />
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-5">
        <RetroTemplate value={value} onChange={patch} />
      </div>
    </div>
  );
};
