'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { endOfMonth, endOfWeek, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import type { Category, Habit, HabitLog } from '@/lib/types';
import { createHabit, listHabits } from '@/lib/repo/habits';
import { listLogsForRange, toggleHabit } from '@/lib/repo/habitLogs';
import { toIsoDate } from '@/lib/utils/date';
import { habitTrackerLogRange, isFixedHabitDueOnDate, isFlexibleHabitSchedule, normalizeHabitSchedule } from '@/lib/utils/habitSchedule';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';

interface HabitGroup {
  id: string;
  name: string;
  color: string;
  habits: Habit[];
  order: number;
}

const TRACKER_PRESET = [
  { name: '오늘 일정 정리', color: '#d9ead3' },
  { name: '명상/묵상', color: '#d9d2e9' },
  { name: '독서', color: '#fff2cc' },
  { name: '감사한 일 기록', color: '#d9e2f3' },
  { name: '스쿼트 + 팔굽혀펴기', color: '#ddd9c4' },
  { name: '복근 운동', color: '#ddd9c4' },
  { name: '차승헌 운동', color: '#ddd9c4' },
] as const;

export function useDailyTracker(date: string, categories: Category[]) {
  const selectedDate = useMemo(() => parseISO(date), [date]);
  const { start, end } = habitTrackerLogRange(selectedDate);
  const data = useAsyncResource(date, async () => {
    const [habits, logs] = await Promise.all([listHabits(), listLogsForRange(start, end)]);
    return { habits, logs };
  }, { habits: [] as Habit[], logs: [] as HabitLog[] }, ['habits', 'habitLogs']);
  const { habits, logs } = data.value;
  const setLogs = (update: (previous: HabitLog[]) => HabitLog[]) => data.setValue(previous => ({ ...previous, logs: update(previous.logs) }));
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const pending = useRef(new Set<string>());
  const [actionError, setActionError] = useState('');
  const [presetBusy, setPresetBusy] = useState(false);
  const presetLock = useRef(false);
  const activeDateRef = useRef(date);
  useEffect(() => {
    activeDateRef.current = date;
    return () => { activeDateRef.current = ''; };
  }, [date]);

  const completedToday = useMemo(
    () => new Set(logs.filter((log) => log.date === date).map((log) => log.habitId)),
    [date, logs],
  );

  const fixedHabits = useMemo(
    () => habits.filter((habit) => isFixedHabitDueOnDate(habit.schedule, selectedDate)),
    [habits, selectedDate],
  );
  const flexibleHabits = useMemo(
    () => habits.filter((habit) => isFlexibleHabitSchedule(habit.schedule)),
    [habits],
  );

  const groups = useMemo(() => {
    const grouped = new Map<string, HabitGroup>();

    fixedHabits.forEach((habit) => {
      const category = habit.categoryId
        ? categories.find((candidate) => candidate.id === habit.categoryId)
        : undefined;
      const id = category?.id ?? 'uncategorized';
      const current = grouped.get(id) ?? {
        id,
        name: category?.name ?? '고정 루틴',
        color: category?.color ?? '#d9ead3',
        habits: [],
        order: category?.order ?? Number.MAX_SAFE_INTEGER,
      };
      current.habits.push(habit);
      grouped.set(id, current);
    });

    return [...grouped.values()].sort((a, b) => a.order - b.order);
  }, [categories, fixedHabits]);

  const fixedDone = fixedHabits.filter((habit) => completedToday.has(habit.id)).length;
  const fixedPercent = fixedHabits.length
    ? Math.round((fixedDone / fixedHabits.length) * 100)
    : 0;

  const toggle = async (habit: Habit) => {
    if (pending.current.has(habit.id)) return;
    pending.current.add(habit.id);
    const requestDate = date;
    setActionError('');
    setPendingIds((current) => new Set(current).add(habit.id));

    try {
      const added = await toggleHabit(habit.id, requestDate);
      if (activeDateRef.current !== requestDate) return;
      setLogs((current) => {
        const withoutCurrent = current.filter(
          (log) => !(log.habitId === habit.id && log.date === requestDate),
        );
        if (!added) return withoutCurrent;
        return [
          ...withoutCurrent,
          {
            id: `local-${habit.id}-${requestDate}`,
            userId: '',
            habitId: habit.id,
            date: requestDate,
            createdAt: new Date().toISOString(),
          },
        ];
      });
    } catch {
      if (activeDateRef.current === requestDate) {
        setActionError('체크 상태를 저장하지 못했어요. 다시 눌러 주세요.');
      }
    } finally {
      pending.current.delete(habit.id);
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(habit.id);
        return next;
      });
    }
  };

  const addTrackerPreset = async () => {
    if (presetLock.current || habits.length > 0) return;
    presetLock.current = true;
    setPresetBusy(true);
    setActionError('');
    try {
      await Promise.all(
        TRACKER_PRESET.map((item, order) =>
          createHabit({
            name: item.name,
            color: item.color,
            order,
            schedule: { kind: 'daily' },
          }),
        ),
      );
      await data.refresh();
    } catch {
      setActionError('기본 루틴을 추가하지 못했어요. 다시 시도해 주세요.');
    } finally {
      presetLock.current = false;
      setPresetBusy(false);
    }
  };

  const flexibleProgress = (habit: Habit) => {
    const schedule = normalizeHabitSchedule(habit.schedule);
    if (schedule.kind !== 'perWeek' && schedule.kind !== 'perMonth') return null;
    const periodStart =
      schedule.kind === 'perWeek'
        ? startOfWeek(selectedDate, { weekStartsOn: 1 })
        : startOfMonth(selectedDate);
    const periodEnd =
      schedule.kind === 'perWeek'
        ? endOfWeek(selectedDate, { weekStartsOn: 1 })
        : endOfMonth(selectedDate);
    const start = toIsoDate(periodStart);
    const end = toIsoDate(periodEnd);
    const done = logs.filter(
      (log) => log.habitId === habit.id && log.date >= start && log.date <= end,
    ).length;
    return {
      done,
      target: schedule.count,
      label: schedule.kind === 'perWeek' ? '이번 주' : '이번 달',
      percent: Math.min(100, Math.round((done / schedule.count) * 100)),
    };
  };

  return {
    habits, loading: data.loading,
    loadError: data.error ? '루틴을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' : '',
    actionError, presetBusy, pendingIds, groups, fixedHabits, flexibleHabits,
    completedToday, fixedDone, fixedPercent, toggle, addTrackerPreset, flexibleProgress,
  };
}
