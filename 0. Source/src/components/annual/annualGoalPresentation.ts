import type { HabitSchedule } from '@/lib/types';

export const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
export const H1 = [0, 1, 2, 3, 4, 5];
export const H2 = [6, 7, 8, 9, 10, 11];

export const formatSchedule = (s: HabitSchedule | undefined): string => {
  if (!s || s.kind === 'daily') return '매일';
  if (s.kind === 'weekdays') return `주 ${s.days.length}일`;
  if (s.kind === 'perWeek') return `주 ${s.count}회`;
  return `월 ${s.count}회`;
};
