'use client';
import { useMemo, useState } from 'react';
import { buildCalendarMarkers } from '@/lib/calendarMarkers';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { listByYear as listAnnualGoalsByYear } from '@/lib/repo/annualGoals';
import { listLifeEvents } from '@/lib/repo/lifeEvents';
import { listPeople } from '@/lib/repo/people';
import { listSubscriptions } from '@/lib/repo/subscriptions';
import { Todo } from '@/lib/types';
import { listDayTodosInRange } from '@/lib/repo/todos';
import { useBinder } from '@/store';
import { toIsoDate } from '@/lib/utils/date';
import { DayCell } from './DayCell';
import { DayTodoDrawer } from './DayTodoDrawer';
import { addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO } from 'date-fns';

interface Props { yyyymm: string; }

const DOW = ['월', '화', '수', '목', '금', '토', '일'];

export const MonthlyCalendar = ({ yyyymm }: Props) => {
  const { categories, projects } = useBinder();
  const [selected, setSelected] = useState<string | null>(null);

  const { currentMonth, startStr, endStr, days } = useMemo(() => {
    const monthDate = parseISO(`${yyyymm}-01`);
    const firstOfMonth = startOfMonth(monthDate);
    const lastOfMonth = endOfMonth(monthDate);
    const gridStart = startOfWeek(firstOfMonth, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(lastOfMonth, { weekStartsOn: 1 });
    const list: Date[] = [];
    for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
      list.push(d);
    }
    return {
      currentMonth: monthDate.getMonth(),
      startStr: toIsoDate(gridStart),
      endStr: toIsoDate(gridEnd),
      days: list,
    };
  }, [yyyymm]);

  const { value: todos, refresh: reload } = useAsyncResource(
    yyyymm, () => listDayTodosInRange(startStr, endStr), [], ['todos'],
  );

  const { value: calendarExtras } = useAsyncResource(
    `calendar-extras:${yyyymm}`,
    async () => {
      const years = [...new Set([startStr.slice(0, 4), endStr.slice(0, 4)])];
      const [annualLists, lifeEvents, people, subscriptions] = await Promise.all([
        Promise.all(years.map(y => listAnnualGoalsByYear(y))),
        listLifeEvents({ startDate: startStr, endDate: endStr }),
        listPeople(),
        listSubscriptions(),
      ]);
      return {
        annualGoals: annualLists.flat(),
        lifeEvents,
        people,
        subscriptions,
      };
    },
    { annualGoals: [], lifeEvents: [], people: [], subscriptions: [] },
    ['annualGoals', 'lifeEvents', 'people', 'subscriptions'],
  );

  const markersByDate = useMemo(
    () =>
      buildCalendarMarkers(startStr, endStr, {
        projects,
        annualGoals: calendarExtras.annualGoals,
        lifeEvents: calendarExtras.lifeEvents,
        people: calendarExtras.people,
        subscriptions: calendarExtras.subscriptions,
      }),
    [startStr, endStr, projects, calendarExtras],
  );

  const today = toIsoDate(new Date());
  const catColor = (id: string) => categories.find(c => c.id === id)?.color ?? '#a1a1aa';

  const todosByDate = useMemo(() => {
    const map = new Map<string, Todo[]>();
    for (const t of todos) {
      const arr = map.get(t.scopeKey) ?? [];
      arr.push(t);
      map.set(t.scopeKey, arr);
    }
    return map;
  }, [todos]);

  return (
    <>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DOW.map((d, i) => (
          <div key={d} className={`text-xs font-medium text-center py-2
            ${i === 6 ? 'text-red-500' : i === 5 ? 'text-sky-600 dark:text-sky-400' : 'text-zinc-600 dark:text-zinc-400'}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map(d => {
          const dateStr = toIsoDate(d);
          const dayTodos = todosByDate.get(dateStr) ?? [];
          const dayMarkers = markersByDate.get(dateStr) ?? [];
          return (
            <DayCell key={dateStr}
              date={d}
              dateStr={dateStr}
              isCurrentMonth={d.getMonth() === currentMonth}
              isToday={dateStr === today}
              todos={dayTodos}
              markers={dayMarkers}
              categoryColor={catColor}
              onClick={() => setSelected(dateStr)} />
          );
        })}
      </div>
      {selected && (
        <DayTodoDrawer
          dateStr={selected}
          markers={markersByDate.get(selected) ?? []}
          onClose={() => { setSelected(null); reload(); }}
        />
      )}
    </>
  );
};
