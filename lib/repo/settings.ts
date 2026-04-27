import { Settings } from '../types';
import { http } from './http';
import { notifyMutation } from './events';

export const getSettings = async (): Promise<Settings> => {
  const row = await http.get<Settings & { key?: string }>('/api/settings');
  const { key: _k, ...s } = row;
  void _k;
  return s as Settings;
};

export const updateSettings = async (patch: Partial<Settings>): Promise<void> => {
  await http.patch<Settings>('/api/settings', patch);
  notifyMutation();
};
