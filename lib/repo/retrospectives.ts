import { Retrospective } from '../types';
import { http } from './http';
import { notifyMutation } from './events';

export const getRetrospective = async (
  type: 'daily' | 'weekly',
  dateOrWeek: string
): Promise<Retrospective | undefined> => {
  const row = await http.get<Retrospective | null>(
    `/api/retrospectives?type=${encodeURIComponent(type)}&dateOrWeek=${encodeURIComponent(dateOrWeek)}`
  );
  return row ?? undefined;
};

export const upsertRetrospective = async (
  type: 'daily' | 'weekly',
  dateOrWeek: string,
  data: Partial<Omit<Retrospective, 'id' | 'type' | 'dateOrWeek' | 'createdAt' | 'updatedAt'>>
): Promise<Retrospective> => {
  const row = await http.put<Retrospective>('/api/retrospectives', {
    type,
    dateOrWeek,
    ...data,
  });
  notifyMutation();
  return row;
};
