import { Habit } from '../types';
import { http } from './http';
import { notifyMutation } from './events';

export const listHabits = (): Promise<Habit[]> => http.get<Habit[]>('/api/habits');

export const createHabit = async (
  data: Omit<Habit, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<Habit> => {
  const row = await http.post<Habit>('/api/habits', data);
  notifyMutation('habits');
  return row;
};

export const updateHabit = async (
  id: string,
  patch: Partial<Omit<Habit, 'id' | 'userId' | 'createdAt'>>
): Promise<void> => {
  await http.patch<Habit>(`/api/habits/${id}`, patch);
  notifyMutation('habits');
};

export const deleteHabit = async (id: string): Promise<void> => {
  await http.del(`/api/habits/${id}`);
  notifyMutation('habits');
};
