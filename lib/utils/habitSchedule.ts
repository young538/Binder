import { HabitSchedule, Weekday } from '../types';
import { eachDayOfInterval } from 'date-fns';

export interface HabitYearBreakdown {
  target: number;
  monthlyTargets: number[]; // 12 entries, always numeric (0 if schedule misses a month)
}

// Derives annual + monthly target counts from a habit schedule for a given year.
export const computeHabitYearBreakdown = (
  schedule: HabitSchedule | undefined,
  year: string
): HabitYearBreakdown => {
  const y = Number(year);
  const sched: HabitSchedule = schedule ?? { kind: 'daily' };
  const monthlyTargets: number[] = [];
  for (let m = 0; m < 12; m++) {
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    const days = eachDayOfInterval({ start, end });
    if (sched.kind === 'daily') {
      monthlyTargets.push(days.length);
    } else if (sched.kind === 'weekdays') {
      const set = new Set<Weekday>(sched.days);
      monthlyTargets.push(days.filter(d => set.has(d.getDay() as Weekday)).length);
    } else if (sched.kind === 'perWeek') {
      monthlyTargets.push(Math.round(sched.count * (days.length / 7)));
    } else {
      monthlyTargets.push(sched.count);
    }
  }
  const target = monthlyTargets.reduce((s, v) => s + v, 0);
  return { target, monthlyTargets };
};
