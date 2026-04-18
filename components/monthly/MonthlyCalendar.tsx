'use client';
import { useEffect, useMemo, useState } from 'react';
import { Todo } from '@/lib/types';
import { listByDateRange } from '@/lib/repo/todos';
import { useBinder } from '@/store';
import { toIsoDate } from '@/lib/utils/date';
import { DayCell } from './DayCell';
import { DayTodoDrawer } from './DayTodoDrawer';
import { addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO } from 'date-fns';

interface Props { yyyymm: string; }

const DOW = ['월', '화', '수', '목', '금', '토', '일'];

export const MonthlyCalendar = ({ yyyymm }: Props) => {
  const { categories } = useBinder();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const monthDate = useMemo(() => parseISO(`${yyyymm}-01`), [yyyymm]);
  const firstOfMonth = startOfMonth(monthDate);
  const lastOfMonth = endOfMonth(monthDate);
  const gridStart = startOfWeek(firstOfMonth, { weekStartsOn: 1 }); // Monday
  const gridEnd = endOfWeek(lastOfMonth, { weekStartsOn: 1 });

  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
    days.push(d);
  }

  const reload = () => {
    listByDateRange(toIsoDate(gridStart), toIsoDate(gridEnd)).then(setTodos);
  };

  useEffect(() => { reload(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yyyymm]);

  const today = toIsoDate(new Date());
  const currentMonth = monthDate.getMonth();
  const catColor = (id: string) => categories.find(c => c.id === id)?.color ?? '#a1a1aa';

  const todosByDate = useMemo(() => {
    const map = new Map<string, Todo[]>();
    for (const t of todos) {
      const arr = map.get(t.date) ?? [];
      arr.push(t);
      map.set(t.date, arr);
    }
    return map;
  }, [todos]);

  return (
    <>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DOW.map((d, i) => (
          <div key={d} className={`text-xs font-medium text-center py-2
            ${i === 6 ? 'text-red-500' : i === 5 ? 'text-blue-500' : 'text-zinc-600 dark:text-zinc-400'}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map(d => {
          const dateStr = toIsoDate(d);
          const dayTodos = todosByDate.get(dateStr) ?? [];
          return (
            <DayCell key={dateStr}
              date={d}
              dateStr={dateStr}
              isCurrentMonth={d.getMonth() === currentMonth}
              isToday={dateStr === today}
              todos={dayTodos}
              categoryColor={catColor}
              onClick={() => setSelected(dateStr)} />
          );
        })}
      </div>
      {selected && (
        <DayTodoDrawer dateStr={selected}
          onClose={() => { setSelected(null); reload(); }} />
      )}
    </>
  );
};
