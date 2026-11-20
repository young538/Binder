import { describe, it, expect } from 'vitest';
import {
  canCheckHabitOnDate,
  habitScheduleLabel,
  isFixedHabitDueOnDate,
  isFlexibleHabitSchedule,
  normalizeHabitSchedule,
} from '@/lib/utils/habitSchedule';
import { HabitSchedule } from '@/lib/types';

// 2026-09-06 is a Sunday (weekday index 0), 2026-09-04 is a Friday (5).
const friday = new Date('2026-09-04T12:00:00');
const sunday = new Date('2026-09-06T12:00:00');

describe('habit schedule helpers', () => {
  it('defaults to daily when schedule is missing', () => {
    expect(normalizeHabitSchedule(undefined)).toEqual({ kind: 'daily' });
    expect(isFixedHabitDueOnDate(undefined, sunday)).toBe(true);
  });

  it('weekdays schedules match only their chosen days', () => {
    const weekdays: HabitSchedule = { kind: 'weekdays', days: [1, 2, 3, 4, 5] };
    expect(isFixedHabitDueOnDate(weekdays, friday)).toBe(true);
    expect(isFixedHabitDueOnDate(weekdays, sunday)).toBe(false);
  });

  it('count-based schedules are flexible and checkable any day', () => {
    const perWeek: HabitSchedule = { kind: 'perWeek', count: 3 };
    expect(isFlexibleHabitSchedule(perWeek)).toBe(true);
    expect(isFixedHabitDueOnDate(perWeek, friday)).toBe(false);
    expect(canCheckHabitOnDate(perWeek, sunday)).toBe(true);
  });

  it('count-based day-specific schedules are not treated as flexible', () => {
    const weekdays: HabitSchedule = { kind: 'weekdays', days: [0] };
    expect(isFlexibleHabitSchedule(weekdays)).toBe(false);
    expect(canCheckHabitOnDate(weekdays, friday)).toBe(false);
    expect(canCheckHabitOnDate(weekdays, sunday)).toBe(true);
  });

  it('builds readable schedule labels', () => {
    expect(habitScheduleLabel(undefined)).toBe('매일');
    expect(habitScheduleLabel({ kind: 'weekdays', days: [1, 3] })).toBe('월·수');
    expect(habitScheduleLabel({ kind: 'perWeek', count: 3 })).toBe('주 3회');
    expect(habitScheduleLabel({ kind: 'perMonth', count: 4 })).toBe('월 4회');
  });
});
