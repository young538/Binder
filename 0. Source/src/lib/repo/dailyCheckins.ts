import type { DailyCheckin } from '../types';
import { notifyMutation } from './events';
import { http } from './http';

type CheckinUpsert = Omit<DailyCheckin, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

export const getDailyCheckin = (date: string): Promise<DailyCheckin | null> =>
  http.get<DailyCheckin | null>(`/api/daily-checkins?date=${encodeURIComponent(date)}`);

export const listDailyCheckinsInRange = (
  startDate: string,
  endDate: string,
): Promise<DailyCheckin[]> =>
  http.get<DailyCheckin[]>(
    `/api/daily-checkins?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
  );

export const upsertDailyCheckin = async (data: CheckinUpsert): Promise<DailyCheckin> => {
  const row = await http.put<DailyCheckin>('/api/daily-checkins', data);
  notifyMutation('dailyCheckins');
  return row;
};
