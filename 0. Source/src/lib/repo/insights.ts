import type { BookHistory, BookLinkDailyResult, ReadingSummary } from '@/lib/reading';
import type { GoalReview } from '@/lib/planning/insights';
import { http } from './http';
import { notifyMutation } from './events';

export const getBookHistory = (id: string) => http.get<BookHistory>(`/api/books/${encodeURIComponent(id)}/history`);
export const getReadingSummary = (): Promise<ReadingSummary> => http.get<ReadingSummary>('/api/books/summary');
export const linkDailyReadings = async (
  bookId: string,
  payload: { dates?: string[]; matchTitle?: string },
): Promise<BookLinkDailyResult> => {
  const result = await http.post<BookLinkDailyResult>(`/api/books/${encodeURIComponent(bookId)}/link-daily`, payload);
  notifyMutation('retrospectives');
  notifyMutation('books');
  return result;
};
export const getGoalReview = (date: string) => http.get<{ start: string; end: string; goals: GoalReview[] }>(`/api/goal-review?date=${encodeURIComponent(date)}`);
