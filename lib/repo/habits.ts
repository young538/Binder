import { Habit } from '../types';
import { http } from './http';
import { notifyMutation } from './events';

// Server automatically syncs linked annual goals on create/update/delete.
// This function remains exported for legacy callers but is now a no-op
// (server-side repos handle the sync transparently).
export const syncAnnualGoalFromHabits = async (_annualGoalId: string): Promise<void> => {
  // server handles it; keep exported symbol for compatibility
  void _annualGoalId;
};

export const listHabits = (): Promise<Habit[]> => http.get<Habit[]>('/api/habits');

export const createHabit = async (
  data: Omit<Habit, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<Habit> => {
  const row = await http.post<Habit>('/api/habits', data);
  notifyMutation();
  return row;
};

export const updateHabit = async (
  id: string,
  patch: Partial<Omit<Habit, 'id' | 'userId' | 'createdAt'>>
): Promise<void> => {
  await http.patch<Habit>(`/api/habits/${id}`, patch);
  notifyMutation();
};

export const deleteHabit = async (id: string): Promise<void> => {
  await http.del(`/api/habits/${id}`);
  notifyMutation();
};
