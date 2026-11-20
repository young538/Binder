import { Habit, HabitLog, HabitSchedule, Weekday } from '../types';
import { eachDayOfInterval, getDaysInMonth, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { toIsoDate } from './date';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

export const normalizeHabitSchedule = (
  schedule: HabitSchedule | undefined,
): HabitSchedule => schedule ?? { kind: 'daily' };

export const isFlexibleHabitSchedule = (
  schedule: HabitSchedule | undefined,
): boolean => {
  const normalized = normalizeHabitSchedule(schedule);
  return normalized.kind === 'perWeek' || normalized.kind === 'perMonth';
};

// A fixed habit is due on a specific day. Count-based habits are deliberately
// excluded because the user can complete them on any day in their period.
export const isFixedHabitDueOnDate = (
  schedule: HabitSchedule | undefined,
  date: Date,
): boolean => {
  const normalized = normalizeHabitSchedule(schedule);
  if (normalized.kind === 'daily') return true;
  if (normalized.kind === 'weekdays') {
    return normalized.days.includes(date.getDay() as Weekday);
  }
  return false;
};

export const canCheckHabitOnDate = (
  schedule: HabitSchedule | undefined,
  date: Date,
): boolean =>
  isFlexibleHabitSchedule(schedule) || isFixedHabitDueOnDate(schedule, date);

export const habitScheduleLabel = (
  schedule: HabitSchedule | undefined,
): string => {
  const normalized = normalizeHabitSchedule(schedule);
  if (normalized.kind === 'daily') return '매일';
  if (normalized.kind === 'weekdays') {
    return normalized.days.map((day) => DAY_LABELS[day]).join('·');
  }
  if (normalized.kind === 'perWeek') return `주 ${normalized.count}회`;
  return `월 ${normalized.count}회`;
};

export interface HabitYearBreakdown {
  target: number;
  monthlyTargets: number[]; // 12 entries, always numeric (0 if schedule misses a month)
}

// Flexible schedules are prorated over the selected calendar days. Round once
// per habit, so a full week/month uses exactly the configured quota.
export const expectedHabitCountInRange = (schedule: HabitSchedule | undefined, start: Date, end: Date): number => {
  const normalized = normalizeHabitSchedule(schedule);
  const days = eachDayOfInterval({ start, end });
  if (normalized.kind === 'perWeek') return Math.round(normalized.count * days.length / 7);
  if (normalized.kind === 'perMonth') {
    return Math.round(days.reduce((sum, day) => sum + normalized.count / getDaysInMonth(day), 0));
  }
  return days.filter(day => isFixedHabitDueOnDate(normalized, day)).length;
};

export const computeHabitStatsForRange = (habits: Habit[], logs: HabitLog[], start: Date, end: Date) => {
  const startDate = toIsoDate(start);
  const endDate = toIsoDate(end);
  const byId = new Map(habits.map(habit => [habit.id, habit]));
  const completed = new Set<string>();
  for (const log of logs) {
    const habit = byId.get(log.habitId);
    if (!habit || log.date < startDate || log.date > endDate || !canCheckHabitOnDate(habit.schedule, parseISO(log.date))) continue;
    completed.add(`${log.habitId}:${log.date}`);
  }
  const expected = habits.reduce((sum, habit) => sum + expectedHabitCountInRange(habit.schedule, start, end), 0);
  return { total: habits.length, logs: completed.size, expected,
    percent: expected > 0 ? Math.min(100, Math.round(completed.size / expected * 100)) : 0 };
};

export const habitTrackerLogRange = (date: Date): { start: string; end: string } => {
  const monthStart = toIsoDate(startOfMonth(date));
  const monthEnd = toIsoDate(endOfMonth(date));
  const weekStart = toIsoDate(startOfWeek(date, { weekStartsOn: 1 }));
  const weekEnd = toIsoDate(endOfWeek(date, { weekStartsOn: 1 }));
  return { start: monthStart < weekStart ? monthStart : weekStart, end: monthEnd > weekEnd ? monthEnd : weekEnd };
};

// Derives annual + monthly target counts from a habit schedule for a given year.
export const computeHabitYearBreakdown = (
  schedule: HabitSchedule | undefined,
  year: string
): HabitYearBreakdown => {
  const y = Number(year);
  const monthlyTargets: number[] = [];
  for (let m = 0; m < 12; m++) {
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    monthlyTargets.push(expectedHabitCountInRange(schedule, start, end));
  }
  const target = monthlyTargets.reduce((s, v) => s + v, 0);
  return { target, monthlyTargets };
};
