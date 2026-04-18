import { toIsoWeek } from './date';
import { format } from 'date-fns';

export const yearKey = (d: Date): string => `year:${format(d, 'yyyy')}`;
export const monthKey = (d: Date): string => `month:${format(d, 'yyyy-MM')}`;
export const weekKey = (d: Date): string => `week:${toIsoWeek(d)}`;

export const yearKeyFromString = (year: string | number): string => `year:${year}`;
export const monthKeyFromString = (yyyymm: string): string => `month:${yyyymm}`;
export const weekKeyFromString = (isoweek: string): string => `week:${isoweek}`;

export const parseYearKey = (key: string): string | null => {
  const m = key.match(/^year:(\d{4})$/);
  return m ? m[1] : null;
};

export const parseMonthKey = (key: string): string | null => {
  const m = key.match(/^month:(\d{4}-\d{2})$/);
  return m ? m[1] : null;
};

export const parseWeekKey = (key: string): string | null => {
  const m = key.match(/^week:(\d{4}-W\d{2})$/);
  return m ? m[1] : null;
};
