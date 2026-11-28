'use client';
import type { CalendarMarker } from '@/lib/calendarMarkers';
import { Todo, STATUS_ICON } from '@/lib/types';
import { tint } from '@/lib/utils/color';
import { statusRowClass } from '@/lib/utils/todoStatus';

interface Props {
  date: Date;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  todos: Todo[];
  markers?: CalendarMarker[];
  categoryColor: (id: string) => string;
  onClick: () => void;
}

const MAX_VISIBLE = 5;

export const DayCell = ({
  date,
  dateStr,
  isCurrentMonth,
  isToday,
  todos,
  markers = [],
  categoryColor,
  onClick,
}: Props) => {
  const visible = todos.slice(0, MAX_VISIBLE);
  const hidden = todos.length - visible.length;
  const visibleMarkers = markers.slice(0, 2);
  const dayNum = date.getDate();

  return (
    <button
      aria-label={`${dateStr} 할 일`}
      onClick={onClick}
      className={`
        group relative flex flex-col items-stretch text-left min-h-[110px] p-1.5 border border-stone-100 dark:border-zinc-800 rounded-md
        ${isCurrentMonth ? 'bg-white dark:bg-zinc-900' : 'bg-stone-50 dark:bg-zinc-950 opacity-50'}
        ${isToday ? 'ring-2 ring-blue-500 ring-inset' : ''}
        hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition
      `}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-semibold
          ${isToday ? 'text-blue-600 dark:text-blue-400' :
            !isCurrentMonth ? 'text-zinc-400' :
            date.getDay() === 0 ? 'text-red-500' :
            date.getDay() === 6 ? 'text-sky-600 dark:text-sky-400' :
            'text-zinc-700 dark:text-zinc-300'}`}>
          {dayNum}
        </span>
        {markers.length > 2 && (
          <span className="text-[9px] font-medium text-indigo-600 dark:text-indigo-400">
            +{markers.length - 2}
          </span>
        )}
      </div>
      {visibleMarkers.length > 0 && (
        <div className="mb-1 space-y-0.5">
          {visibleMarkers.map(m => (
            <div
              key={m.id}
              className="truncate rounded bg-indigo-50 px-1 py-0.5 text-[9px] font-medium text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200"
            >
              {m.label}
            </div>
          ))}
        </div>
      )}
      <ul className="flex-1 space-y-1 overflow-hidden">
        {visible.map(t => {
          const color = t.categoryId ? categoryColor(t.categoryId) : null;
          return (
            <li key={t.id}
              className={`flex items-center gap-1 text-[10px] leading-tight truncate rounded px-1 py-0.5 text-zinc-800 dark:text-zinc-50
                ${statusRowClass(t.status)}`}
              style={color ? {
                background: tint.soft(color),
                borderLeft: `2px solid ${color}`,
              } : undefined}>
              {t.status !== 'pending' && t.status !== 'done' && (
                <span className="text-[9px] shrink-0">{STATUS_ICON[t.status]}</span>
              )}
              {t.priority && (
                <span className="text-amber-700 text-[9px] shrink-0 font-bold">
                  {'*'.repeat(t.priority)}
                </span>
              )}
              <span className="truncate font-medium">{t.title || '(제목 없음)'}</span>
            </li>
          );
        })}
      </ul>
      {hidden > 0 && (
        <div className="text-[10px] text-zinc-500 mt-0.5">+{hidden}개</div>
      )}
    </button>
  );
};
