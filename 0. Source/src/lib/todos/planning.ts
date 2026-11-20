import { addDays, addMonths, addWeeks, addYears, format, parseISO } from 'date-fns';
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

export const retroHref = (source: RetroSource): string => {
  if (source.type === 'daily') return `/daily/${source.dateOrWeek}#daily-record`;
  if (source.type === 'monthly') return `/retrospective/month/${source.dateOrWeek}`;
  if (source.type === 'yearly') return `/retrospective/year/${source.dateOrWeek}`;
  return `/retrospective/week/${source.dateOrWeek}`;
};

export const nextRetroTarget = (source: RetroSource) => {
  if (source.type === 'daily') {
    return { scope: 'day' as const, scopeKey: toIsoDate(addDays(parseISO(source.dateOrWeek), 1)) };
  }
  if (source.type === 'monthly') {
    return { scope: 'month' as const, scopeKey: format(addMonths(parseISO(`${source.dateOrWeek}-01`), 1), 'yyyy-MM') };
  }
  if (source.type === 'yearly') {
    return { scope: 'year' as const, scopeKey: format(addYears(parseISO(`${source.dateOrWeek}-01-01`), 1), 'yyyy') };
  }
  return { scope: 'week' as const, scopeKey: toIsoWeek(addWeeks(weekDates(source.dateOrWeek)[0], 1)) };
};
