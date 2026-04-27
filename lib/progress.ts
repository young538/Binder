// Client-side fetch wrapper for progress. Heavy lifting happens on the server.
import { http } from './repo/http';

export interface GoalProgress {
  goalId: string;
  numeric?: { target: number; current: number; percent: number };
  habits?: {
    total: number;
    thisMonthLogs: number;
    expectedThisMonth: number;
    percent: number;
  };
  todos?: {
    total: number;
    done: number;
    postponed: number;
    delegated: number;
    cancelled: number;
    pending: number;
    percent: number;
  };
  timeInvested: { weekMin: number; monthMin: number; yearMin: number };
  overall: number;
}

export const computeGoalProgress = (goalId: string): Promise<GoalProgress> =>
  http.get<GoalProgress>(`/api/progress?goalId=${encodeURIComponent(goalId)}`);

export const computeMultipleProgress = async (
  goalIds: string[]
): Promise<Map<string, GoalProgress>> => {
  if (goalIds.length === 0) return new Map();
  const q = goalIds.map(encodeURIComponent).join(',');
  const obj = await http.get<Record<string, GoalProgress>>(`/api/progress?goalIds=${q}`);
  return new Map(Object.entries(obj));
};
