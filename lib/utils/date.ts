import { format, getISOWeek, getISOWeekYear, addDays } from 'date-fns';

export const toIsoWeek = (date: Date): string => {
  const year = getISOWeekYear(date);
  const week = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
};

export const fromIsoWeek = (iso: string): Date => {
  const match = iso.match(/^(\d{4})-W(\d{2})$/);
  if (!match) throw new Error(`Invalid ISO week: ${iso}`);
  const [, y, w] = match;
  const jan4 = new Date(Date.UTC(Number(y), 0, 4));
  const jan4DayOffset = (jan4.getUTCDay() + 6) % 7;
  const monOfWeek1 = addDays(jan4, -jan4DayOffset);
  return addDays(monOfWeek1, (Number(w) - 1) * 7);
};

export const weekDates = (iso: string): Date[] => {
  const monday = fromIsoWeek(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
};

export const toIsoDate = (date: Date): string => format(date, 'yyyy-MM-dd');

export const minutesToTimeStr = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const timeStrToMinutes = (s: string): number => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};

export const snapToGrid = (minutes: number, gridMinutes: number): number =>
  Math.round(minutes / gridMinutes) * gridMinutes;

export const WEEKDAYS_KO = ['월','화','수','목','금','토','일'] as const;
