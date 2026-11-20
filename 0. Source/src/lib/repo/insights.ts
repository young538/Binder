import type { BookHistory } from '@/lib/reading';
import type { GoalReview } from '@/lib/planning/insights';
import { http } from './http';

export const getBookHistory = (id: string) => http.get<BookHistory>(`/api/books/${encodeURIComponent(id)}/history`);
export const getGoalReview = (date: string) => http.get<{ start: string; end: string; goals: GoalReview[] }>(`/api/goal-review?date=${encodeURIComponent(date)}`);
