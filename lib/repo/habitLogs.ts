import { HabitLog } from '../types';
import { http } from './http';
import { notifyMutation } from './events';

export const toggleHabit = async (
  habitId: string,
  date: string
): Promise<boolean> => {
  const res = await http.post<{ added: boolean }>('/api/habit-logs', { habitId, date });
  notifyMutation();
  return res.added;
};

export const listLogsForRange = (
  startDate: string,
  endDate: string
): Promise<HabitLog[]> =>
  http.get<HabitLog[]>(
    `/api/habit-logs?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
  );
