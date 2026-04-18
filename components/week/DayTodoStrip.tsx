'use client';
import { Todo } from '@/lib/types';
import { toIsoDate } from '@/lib/utils/date';
import { DayTodoColumn } from './DayTodoColumn';

const DOW = ['월', '화', '수', '목', '금', '토', '일'];

interface Props {
  dates: Date[];
  refreshKey: number;
  onMakeBlock: (todo: Todo) => void;
  onChanged: () => void;
}

export const DayTodoStrip = ({
  dates,
  refreshKey,
  onMakeBlock,
  onChanged,
}: Props) => {
  const today = toIsoDate(new Date());
  return (
    <div
      className="grid border-b border-zinc-200 dark:border-zinc-800"
      style={{ gridTemplateColumns: `60px repeat(7, minmax(120px, 1fr))` }}
    >
      <div className="text-[10px] text-zinc-400 text-right pr-2 pt-2 border-r border-zinc-100 dark:border-zinc-900">
        할 일
      </div>
      {dates.map((d, i) => {
        const dateStr = toIsoDate(d);
        const isToday = dateStr === today;
        return (
          <div
            key={dateStr}
            className={`border-r border-zinc-100 dark:border-zinc-900 last:border-r-0 ${
              isToday ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
            }`}
          >
            <div
              className={`text-center py-1.5 border-b border-zinc-100 dark:border-zinc-900 text-xs font-medium
                ${
                  isToday
                    ? 'text-blue-600 dark:text-blue-400'
                    : i === 6
                      ? 'text-red-500'
                      : i === 5
                        ? 'text-blue-500'
                        : 'text-zinc-700 dark:text-zinc-300'
                }`}
            >
              {DOW[i]} {d.getMonth() + 1}/{d.getDate()}
            </div>
            <DayTodoColumn
              dateStr={dateStr}
              refreshKey={refreshKey}
              onMakeBlock={onMakeBlock}
              onChanged={onChanged}
            />
          </div>
        );
      })}
    </div>
  );
};
