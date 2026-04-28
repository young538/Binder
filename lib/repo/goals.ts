import { Goal, GoalLevel } from '../types';
import { http } from './http';
import { notifyMutation } from './events';

// Small mandalart data (≤73 rows) — fetch all then filter in memory.
export const listAllGoals = (): Promise<Goal[]> => http.get<Goal[]>('/api/goals');

export const listGoalsByLevel = async (level: GoalLevel): Promise<Goal[]> => {
  const all = await listAllGoals();
  return all.filter(g => g.level === level);
};

export const listChildren = async (parentId: string): Promise<Goal[]> => {
  const all = await listAllGoals();
  return all.filter(g => g.parentId === parentId);
};

export const createGoal = async (
  data: Omit<Goal, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<Goal> => {
  const row = await http.post<Goal>('/api/goals', data);
  notifyMutation();
  return row;
};

export const updateGoal = async (
  id: string,
  patch: Partial<Omit<Goal, 'id' | 'userId' | 'createdAt'>>
): Promise<void> => {
  await http.patch<Goal>(`/api/goals/${id}`, patch);
  notifyMutation();
};

export const deleteGoal = async (id: string): Promise<void> => {
  await http.del(`/api/goals/${id}`);
  notifyMutation();
};
