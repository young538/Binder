import { Retrospective, RetroType } from '../types';
import type {
  RetroCoachMode,
  RetroCoachRequestedProvider,
  RetroCoachResponse,
  RetroCoachStatus,
} from '../retroCoach';
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

export const getRetroCoachStatus = (): Promise<RetroCoachStatus> =>
  http.get<RetroCoachStatus>('/api/retrospectives/coach');

export const generateRetroCoach = (
  mode: RetroCoachMode,
  period: string,
  provider?: RetroCoachRequestedProvider,
): Promise<RetroCoachResponse> =>
  http.post<RetroCoachResponse>('/api/retrospectives/coach', {
    mode,
    period,
    ...(provider ? { provider } : {}),
  });
