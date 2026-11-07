import { addDays, addMonths, addWeeks, parseISO } from 'date-fns';
import type { RetroSource, Todo, TodoRepeatRule } from '@/lib/types';
import { toIsoDate, toIsoWeek, weekDates } from '@/lib/utils/date';

export function nextRepeatDate(date: string, rule: TodoRepeatRule, completedDate: string): string {
  const base = parseISO(rule.basis === 'completed' ? completedDate : date);
  const advance = rule.unit === 'day' ? addDays : rule.unit === 'week' ? addWeeks : addMonths;
  return toIsoDate(advance(base, rule.interval));
}

export const todoHref = (todo: Pick<Todo, 'scope' | 'scopeKey'>): string => {
  if (todo.scope === 'inbox') return '/inbox';
  if (todo.scope === 'day') return `/daily/${todo.scopeKey}`;
  if (todo.scope === 'week') return `/week/${todo.scopeKey}`;
  if (todo.scope === 'month') return `/monthly/${todo.scopeKey}`;
  return `/annual/${todo.scopeKey}`;
};

export const retroHref = (source: RetroSource): string => source.type === 'daily'
  ? `/daily/${source.dateOrWeek}#daily-record` : `/retrospective/week/${source.dateOrWeek}`;

export const nextRetroTarget = (source: RetroSource) => source.type === 'daily'
  ? { scope: 'day' as const, scopeKey: toIsoDate(addDays(parseISO(source.dateOrWeek), 1)) }
  : { scope: 'week' as const, scopeKey: toIsoWeek(addWeeks(weekDates(source.dateOrWeek)[0], 1)) };
