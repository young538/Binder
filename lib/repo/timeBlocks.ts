import { TimeBlock } from '../types';
import { http } from './http';
import { notifyMutation } from './events';

export const createTimeBlock = async (
  data: Omit<TimeBlock, 'id' | 'createdAt' | 'updatedAt'>
): Promise<TimeBlock> => {
  const row = await http.post<TimeBlock>('/api/time-blocks', data);
  notifyMutation();
  return row;
};

export const updateTimeBlock = async (
  id: string,
  patch: Partial<Omit<TimeBlock, 'id' | 'createdAt'>>
): Promise<void> => {
  await http.patch<TimeBlock>(`/api/time-blocks/${id}`, patch);
  notifyMutation();
};

export const deleteTimeBlock = async (id: string): Promise<void> => {
  await http.del(`/api/time-blocks/${id}`);
  notifyMutation();
};

export const getTimeBlocksInRange = (
  startDate: string,
  endDate: string
): Promise<TimeBlock[]> =>
  http.get<TimeBlock[]>(
    `/api/time-blocks?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
  );
