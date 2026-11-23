import { Retrospective, RetroType } from '../types';
import type { RetroCoachMode, RetroCoachResponse } from '../retroCoach';
import { http } from './http';
import { notifyMutation } from './events';

export const getRetrospective = async (
  type: RetroType,
  dateOrWeek: string
): Promise<Retrospective | undefined> => {
  const row = await http.get<Retrospective | null>(
    `/api/retrospectives?type=${encodeURIComponent(type)}&dateOrWeek=${encodeURIComponent(dateOrWeek)}`
  );
  return row ?? undefined;
};

export const upsertRetrospective = async (
  type: RetroType,
  dateOrWeek: string,
  data: Partial<Omit<Retrospective, 'id' | 'userId' | 'type' | 'dateOrWeek' | 'createdAt' | 'updatedAt'>>
): Promise<Retrospective> => {
  const row = await http.put<Retrospective>('/api/retrospectives', {
    type,
    dateOrWeek,
    ...data,
  });
  notifyMutation('retrospectives');
  return row;
};

export const generateRetroCoach = (
  mode: RetroCoachMode,
  period: string,
): Promise<RetroCoachResponse> =>
  http.post<RetroCoachResponse>('/api/retrospectives/coach', { mode, period });
