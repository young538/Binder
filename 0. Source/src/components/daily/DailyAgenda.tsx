'use client';

import Link from 'next/link';
import { useState } from 'react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronRight } from 'lucide-react';
import { STATUS_LABEL } from '@/lib/types';
import { minutesToTimeStr } from '@/lib/utils/date';
import type { DailyAgendaDay } from './useDailyAgenda';

interface Props {
  days: DailyAgendaDay[];
  today: string;
  loading: boolean;
  onRetry?: () => void;
}

interface AgendaItem {
  id: string;
  label: string;
  title: string;
  href?: string;
}

function AgendaRow({ day, label, selected, emptyText }: {
  day: DailyAgendaDay;
  label: string;
  selected: boolean;
  emptyText: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const markers: AgendaItem[] = day.markers.map(marker => ({
    id: marker.id, label: marker.startMin == null ? '' : minutesToTimeStr(marker.startMin),
    title: marker.label, href: marker.href,
  }));
  const blocks: AgendaItem[] = day.blocks.map(block => ({
    id: `block:${block.id}`, label: `${minutesToTimeStr(block.startMin)} ${block.kind === 'actual' ? '실제' : '계획'}`,
    title: block.text || '(내용 없음)',
  }));
  const todos: AgendaItem[] = day.todos.map(todo => ({
    id: `todo:${todo.id}`, label: todo.status === 'pending' ? '할 일' : STATUS_LABEL[todo.status], title: todo.title,
  }));
  // Keep a busy calendar from hiding every task or time block in the preview.
  const groups = [markers, blocks, todos];
  const items = [...groups.flatMap(group => group.slice(0, 1)), ...groups.flatMap(group => group.slice(1))];
  const dayLabel = format(parseISO(day.date), 'M.d (EEE)', { locale: ko });

  return (
    <article aria-label={day.date} className={`grid min-w-0 grid-cols-[5rem_minmax(0,1fr)] gap-2 p-3 sm:block sm:p-4 ${selected ? 'bg-blue-50/70 dark:bg-blue-950/25' : ''}`}>
      <Link href={`/daily/${day.date}`} aria-current={selected ? 'page' : undefined}
        aria-label={`${label} ${dayLabel} 플래너`}
        className="flex min-h-11 flex-col items-start justify-center self-start rounded-md text-left hover:underline focus-visible:outline-blue-500 sm:mb-2 sm:flex-row sm:items-center sm:justify-start sm:gap-2">
        <span className={`flex items-center gap-0.5 text-sm font-bold ${selected ? 'text-blue-700 dark:text-blue-300' : ''}`}>
          {label}{!selected && <ChevronRight aria-hidden size={14} />}
        </span>
        <time dateTime={day.date} className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">{dayLabel}</time>
      </Link>
      <div className="min-w-0 self-center">
        {items.length ? (
          <ul className="space-y-1 text-sm">
            {(expanded ? items : items.slice(0, 3)).map(item => (
              <li key={item.id} className="flex items-baseline gap-1.5">
                {item.label && <span className="shrink-0 text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">{item.label}</span>}
                {item.href
                  ? <Link href={item.href} className="min-w-0 break-words text-indigo-700 hover:underline dark:text-indigo-300">{item.title}</Link>
                  : <span className="min-w-0 break-words">{item.title}</span>}
              </li>
            ))}
          </ul>
        ) : <p className="text-xs text-zinc-500">{emptyText}</p>}
        {items.length > 3 && (
          <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}
            className="min-h-8 text-xs font-medium text-blue-700 hover:underline dark:text-blue-300">
            {expanded ? '접기' : `${items.length - 3}개 더 보기`}
          </button>
        )}
      </div>
    </article>
  );
}

export function DailyAgenda({ days, today, loading, onRetry }: Props) {
  return (
    <section aria-label="3일 플래너" className="mt-4 border-t border-zinc-200 dark:border-zinc-800">
      <div className="grid divide-y divide-zinc-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-zinc-800">
        {days.map((day, index) => {
          const offset = differenceInCalendarDays(parseISO(day.date), parseISO(today));
          const label = ['어제', '오늘', '내일'][offset + 1] ?? ['전날', '선택일', '다음 날'][index];
          return <AgendaRow key={day.date} day={day} label={label} selected={index === 1}
            emptyText={loading ? '불러오는 중…' : onRetry ? '조회된 항목 없음' : '등록된 항목 없음'} />;
        })}
      </div>
      {onRetry && <p role="alert" className="px-3 pt-2 text-xs text-rose-700 dark:text-rose-300">
        일부 항목을 불러오지 못했어요. <button type="button" onClick={onRetry} className="underline">다시 시도</button>
      </p>}
    </section>
  );
}
