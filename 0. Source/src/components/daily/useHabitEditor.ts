'use client';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Habit, HabitSchedule, Weekday } from '@/lib/types';
import { listHabits, createHabit, updateHabit, deleteHabit } from '@/lib/repo/habits';
import { listByYear as listAnnualGoalsByYear } from '@/lib/repo/annualGoals';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { AutosaveQueue } from '@/lib/autosave/queue';
import { getSchedule, type ScheduleKind, type RowHandlers } from './HabitRow';

export function useHabitEditor() {
  const year = String(new Date().getFullYear());
  const data = useAsyncResource(year, async () => {
    const [habits, annualGoals] = await Promise.all([listHabits(), listAnnualGoalsByYear(year)]);
    return { habits, annualGoals };
  }, { habits: [], annualGoals: [] }, ['habits', 'annualGoals']);
  const { habits, annualGoals } = data.value;
  const reload = data.refresh;
  const orders = useMemo(() => new AutosaveQueue<Habit[]>(async next => {
    await Promise.all(next.map((habit, order) => ({ habit, order }))
      .filter(({ habit, order }) => habit.order !== order)
      .map(({ habit, order }) => updateHabit(habit.id, { order })));
    await reload();
  }, (_previous, next) => next, undefined, 350), [reload]);
  const orderStatus = useSyncExternalStore(listener => orders.subscribe(listener), () => orders.status, () => 'idle');
  useEffect(() => () => { void orders.flush(); }, [orders]);

  const handleReorder = (next: Habit[]) => {
    data.setValue(previous => ({ ...previous, habits: next }));
    orders.enqueue(next);
  };

  const add = async () => {
    await createHabit({
      name: '새 습관',
      color: '#d9ead3',
      order: habits.length,
      schedule: { kind: 'daily' },
    });
    reload();
  };
  const update = async (id: string, patch: Partial<Omit<Habit, 'id'>>) => {
    await updateHabit(id, patch);
    reload();
  };
  const remove = async (id: string) => {
    if (!confirm('습관 삭제? 관련 체크 기록도 모두 삭제됩니다.')) return;
    await deleteHabit(id);
    reload();
  };

  const changeKind = (h: Habit, kind: ScheduleKind) => {
    let schedule: HabitSchedule;
    if (kind === 'daily') schedule = { kind: 'daily' };
    else if (kind === 'weekdays') {
      const prev = getSchedule(h);
      schedule = { kind: 'weekdays', days: prev.kind === 'weekdays' ? prev.days : [1, 2, 3, 4, 5] };
    } else if (kind === 'perWeek') {
      const prev = getSchedule(h);
      schedule = { kind: 'perWeek', count: prev.kind === 'perWeek' ? prev.count : 3 };
    } else {
      const prev = getSchedule(h);
      schedule = { kind: 'perMonth', count: prev.kind === 'perMonth' ? prev.count : 4 };
    }
    update(h.id, { schedule });
  };

  const toggleDayInSchedule = (h: Habit, d: Weekday) => {
    const s = getSchedule(h);
    if (s.kind !== 'weekdays') return;
    const next = s.days.includes(d)
      ? s.days.filter((x) => x !== d)
      : ([...s.days, d].sort() as Weekday[]);
    if (next.length === 0) return; // 최소 하루는 유지
    update(h.id, { schedule: { kind: 'weekdays', days: next } });
  };

  const changeCount = (h: Habit, count: number) => {
    const s = getSchedule(h);
    if (s.kind !== 'perWeek' && s.kind !== 'perMonth') return;
    const c = Math.max(1, Math.min(99, count));
    update(h.id, { schedule: { ...s, count: c } });
  };

  const handlers: RowHandlers = {
    onRemove: remove,
    onUpdate: update,
    onChangeKind: changeKind,
    onToggleDay: toggleDayInSchedule,
    onChangeCount: changeCount,
  };

  return { habits, annualGoals, handlers, add, handleReorder, orderStatus, retryOrder: () => { void orders.flush(); } };
}
