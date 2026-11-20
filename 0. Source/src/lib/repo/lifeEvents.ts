import type { LifeEvent } from '../types';
import { notifyMutation } from './events';
import { http } from './http';

type NewLifeEvent = Omit<
  LifeEvent,
  'id' | 'userId' | 'createdAt' | 'updatedAt' | 'googleCalendarId' | 'googleEventId' | 'googleUpdatedAt'
>;

export const listLifeEvents = (filters?: {
  startDate?: string;
  endDate?: string;
}): Promise<LifeEvent[]> => {
  const params = new URLSearchParams();
  if (filters?.startDate) params.set('startDate', filters.startDate);
  if (filters?.endDate) params.set('endDate', filters.endDate);
  const qs = params.toString();
  return http.get<LifeEvent[]>(qs ? `/api/events?${qs}` : '/api/events');
};

export const createLifeEvent = async (data: NewLifeEvent): Promise<LifeEvent> => {
  const row = await http.post<LifeEvent>('/api/events', data);
  notifyMutation('lifeEvents');
  return row;
};

export const updateLifeEvent = async (
  id: string,
  patch: Partial<NewLifeEvent>,
): Promise<LifeEvent> => {
  const row = await http.patch<LifeEvent>(`/api/events/${encodeURIComponent(id)}`, patch);
  notifyMutation('lifeEvents');
  return row;
};

export const deleteLifeEvent = async (id: string): Promise<void> => {
  await http.del(`/api/events/${encodeURIComponent(id)}`);
  notifyMutation('lifeEvents');
};

export const importIcsEvents = async (payload: {
  icsText?: string | null;
  url?: string | null;
}): Promise<{ imported: number; updated: number; total: number }> => {
  const result = await http.post<{ imported: number; updated: number; total: number }>(
    '/api/events/import-ics',
    payload,
  );
  notifyMutation('lifeEvents');
  return result;
};
