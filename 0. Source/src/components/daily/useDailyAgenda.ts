'use client';

import { addDays, parseISO } from 'date-fns';
import { useMemo } from 'react';
import { buildCalendarMarkers, type CalendarMarker } from '@/lib/calendarMarkers';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { listByYear } from '@/lib/repo/annualGoals';
import { listLifeEvents } from '@/lib/repo/lifeEvents';
import { listPeople } from '@/lib/repo/people';
import { listSubscriptions } from '@/lib/repo/subscriptions';
import { getTimeBlocksInRange } from '@/lib/repo/timeBlocks';
import { listDayTodosInRange } from '@/lib/repo/todos';
import type { TimeBlock, Todo } from '@/lib/types';
import { toIsoDate } from '@/lib/utils/date';
import { useBinder } from '@/store';

export interface DailyAgendaDay {
  date: string;
  markers: CalendarMarker[];
  blocks: TimeBlock[];
  todos: Todo[];
}

export function useDailyAgenda(date: string) {
  const selected = parseISO(date);
  const start = toIsoDate(addDays(selected, -1));
  const end = toIsoDate(addDays(selected, 1));
  const range = `${start}:${end}`;
  const projects = useBinder(state => state.projects);
  const blocks = useAsyncResource(`daily-blocks:${range}`, () => getTimeBlocksInRange(start, end), [], ['timeBlocks']);
  const todos = useAsyncResource(`daily-todos:${range}`, () => listDayTodosInRange(start, end), [], ['todos']);
  const events = useAsyncResource(`daily-events:${range}`, () => listLifeEvents({ startDate: start, endDate: end }), [], ['lifeEvents']);
  const extras = useAsyncResource(`daily-markers:${range}`, async () => {
    const years = new Set([start.slice(0, 4), end.slice(0, 4)]);
    const [goalsByYear, people, subscriptions] = await Promise.all([
      Promise.all(Array.from(years, listByYear)), listPeople(), listSubscriptions(),
    ]);
    return { annualGoals: goalsByYear.flat(), people, subscriptions };
  }, { annualGoals: [], people: [], subscriptions: [] }, ['annualGoals', 'people', 'subscriptions']);

  const days = useMemo(() => {
    const markers = buildCalendarMarkers(start, end, { ...extras.value, projects, lifeEvents: events.value });
    return [start, date, end].map((day): DailyAgendaDay => ({
      date: day,
      markers: markers.get(day) ?? [],
      blocks: blocks.value.filter(block => block.date === day).sort((a, b) =>
        a.startMin - b.startMin || a.endMin - b.endMin || a.id.localeCompare(b.id)),
      todos: todos.value.filter(todo => todo.scopeKey === day),
    }));
  }, [start, date, end, projects, extras.value, events.value, blocks.value, todos.value]);
  const resources = [blocks, todos, events, extras];
  return {
    days, events: events.value, blocks,
    loading: resources.some(resource => resource.loading),
    failed: resources.filter(resource => resource.error != null),
  };
}
