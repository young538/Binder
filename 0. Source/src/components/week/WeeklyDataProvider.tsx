'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { getTimeBlocksInRange } from '@/lib/repo/timeBlocks';
import { listDayTodosInRange } from '@/lib/repo/todos';
import { listLifeEvents } from '@/lib/repo/lifeEvents';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { weekDates, toIsoDate } from '@/lib/utils/date';
import type { LifeEvent, TimeBlock, Todo } from '@/lib/types';

const WeeklyDataContext = createContext<{ blocks: TimeBlock[]; todos: Todo[]; weekEvents: LifeEvent[] } | null>(null);

/** Both responsive views use the same range queries and mutation subscription. */
export function WeeklyDataProvider({ isoweek, children }: { isoweek: string; children: ReactNode }) {
  const dates = weekDates(isoweek);
  const start = toIsoDate(dates[0]);
  const end = toIsoDate(dates[6]);

  const range = `${start}:${end}`;
  const blocks = useAsyncResource(`week-blocks:${range}`, () => getTimeBlocksInRange(start, end), [], ['timeBlocks']);
  const todos = useAsyncResource(`week-todos:${range}`, () => listDayTodosInRange(start, end), [], ['todos']);
  const events = useAsyncResource(`week-events:${range}`, () => listLifeEvents({ startDate: start, endDate: end }), [], ['lifeEvents']);
  const failed = [blocks, todos, events].filter(query => query.error != null);

  return (
    <WeeklyDataContext.Provider value={{ blocks: blocks.value, todos: todos.value, weekEvents: events.value }}>
      {failed.length > 0 && (
        <div role="alert" className="flex items-center gap-3 px-5 py-3 text-sm text-red-600">
          주간 데이터를 불러오지 못했습니다.
          <button type="button" className="underline" onClick={() => failed.forEach(query => void query.refresh())}>다시 시도</button>
        </div>
      )}
      {children}
    </WeeklyDataContext.Provider>
  );
}

export function useWeeklyData() {
  const value = useContext(WeeklyDataContext);
  if (!value) throw new Error('WeeklyDataProvider is required');
  return value;
}
