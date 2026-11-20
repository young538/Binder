// Client-side fetch wrapper for progress. Heavy lifting happens on the server.
import { toIsoDate } from './utils/date';
import { http } from './repo/http';

import type { GoalProgress } from './progress/types';
export type { GoalProgress } from './progress/types';

export const computeGoalProgress = (goalId: string, date?: Date): Promise<GoalProgress> =>
  http.get<GoalProgress>(`/api/progress?goalId=${encodeURIComponent(goalId)}${date ? `&date=${toIsoDate(date)}` : ''}`);

export const computeMultipleProgress = async (
  goalIds: string[],
  date?: Date
): Promise<Map<string, GoalProgress>> => {
  if (goalIds.length === 0) return new Map();
  const q = goalIds.map(encodeURIComponent).join(',');
  const obj = await http.get<Record<string, GoalProgress>>(`/api/progress?goalIds=${q}${date ? `&date=${toIsoDate(date)}` : ''}`);
  return new Map(Object.entries(obj));
};
