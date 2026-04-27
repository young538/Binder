import { AnnualGoal } from '../types';
import { http } from './http';
import { notifyMutation } from './events';

export const listByYear = (year: string): Promise<AnnualGoal[]> =>
  http.get<AnnualGoal[]>(`/api/annual-goals?year=${encodeURIComponent(year)}`);

export const createAnnualGoal = async (
  year: string,
  order: number
): Promise<AnnualGoal> => {
  const row = await http.post<AnnualGoal>('/api/annual-goals', { year, order });
  notifyMutation();
  return row;
};

export const updateAnnualGoal = async (
  id: string,
  patch: Partial<Omit<AnnualGoal, 'id' | 'createdAt'>>
): Promise<void> => {
  await http.patch<AnnualGoal>(`/api/annual-goals/${id}`, patch);
  notifyMutation();
};

export const deleteAnnualGoal = async (id: string): Promise<void> => {
  await http.del(`/api/annual-goals/${id}`);
  notifyMutation();
};

export const ensureSeven = async (year: string): Promise<AnnualGoal[]> => {
  const rows = await http.post<AnnualGoal[]>('/api/annual-goals', {
    year,
    order: 0,
    ensureSeven: true,
  });
  notifyMutation();
  return rows;
};
