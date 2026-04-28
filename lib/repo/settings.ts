import { Settings } from '../types';
import { http } from './http';
import { notifyMutation } from './events';

export const getSettings = async (): Promise<Settings> => {
  return http.get<Settings>('/api/settings');
};

export const updateSettings = async (patch: Partial<Settings>): Promise<void> => {
  await http.patch<Settings>('/api/settings', patch);
  notifyMutation();
};
