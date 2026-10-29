'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { getTimeBlocksInRange } from '@/lib/repo/timeBlocks';
import { listDayTodosInRange } from '@/lib/repo/todos';
import { onDirty } from '@/lib/repo/events';
import { weekDates, toIsoDate } from '@/lib/utils/date';
import type { TimeBlock, Todo } from '@/lib/types';

const WeeklyDataContext = createContext<{ blocks: TimeBlock[]; todos: Todo[] } | null>(null);

/** Both responsive views use the same range queries and mutation subscription. */
export function WeeklyDataProvider({ isoweek, children }: { isoweek: string; children: ReactNode }) {
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [retry, setRetry] = useState(0);
  const initialRequests = useRef<{ key: string; blocks: Promise<TimeBlock[]>; todos: Promise<Todo[]> } | null>(null);
  const dates = weekDates(isoweek);
  const start = toIsoDate(dates[0]);
  const end = toIsoDate(dates[6]);

  useEffect(() => {
    let active = true;
    let blockVersion = 0;
    let todoVersion = 0;
    const requestKey = `${start}:${end}:${retry}`;
    // React's development effect replay must share the initial requests too.
    if (initialRequests.current?.key !== requestKey) {
      initialRequests.current = {
        key: requestKey,
        blocks: getTimeBlocksInRange(start, end),
        todos: listDayTodosInRange(start, end),
      };
    }
    const initial = initialRequests.current;
    const loadBlocks = async (request?: Promise<TimeBlock[]>) => {
      const version = ++blockVersion;
      try {
        const rows = await (request ?? getTimeBlocksInRange(start, end));
        if (active && version === blockVersion) {
          setBlocks(rows);
          setErrors((previous) => ({ ...previous, blocks: false }));
        }
      } catch {
        if (active && version === blockVersion) setErrors((previous) => ({ ...previous, blocks: true }));
      }
    };
    const loadTodos = async (request?: Promise<Todo[]>) => {
      const version = ++todoVersion;
      try {
        const rows = await (request ?? listDayTodosInRange(start, end));
        if (active && version === todoVersion) {
          setTodos(rows);
          setErrors((previous) => ({ ...previous, todos: false }));
        }
      } catch {
        if (active && version === todoVersion) setErrors((previous) => ({ ...previous, todos: true }));
      }
    };
    void loadBlocks(initial.blocks);
    void loadTodos(initial.todos);
    const unsubscribe = onDirty((resource) => {
      if (resource === 'timeBlocks') void loadBlocks();
      if (resource === 'todos') void loadTodos();
    });
    return () => { active = false; unsubscribe(); };
  }, [start, end, retry]);

  return (
    <WeeklyDataContext.Provider value={{ blocks, todos }}>
      {Object.values(errors).some(Boolean) && (
        <div role="alert" className="flex items-center gap-3 px-5 py-3 text-sm text-red-600">
          주간 데이터를 불러오지 못했습니다.
          <button type="button" className="underline" onClick={() => setRetry((value) => value + 1)}>다시 시도</button>
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
