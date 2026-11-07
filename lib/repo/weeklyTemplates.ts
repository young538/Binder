import type { WeeklyTemplate } from '@/lib/types';
import { http } from './http';
import { notifyMutation } from './events';

export const listWeeklyTemplates = () => http.get<WeeklyTemplate[]>('/api/weekly-templates');
export async function createWeeklyTemplate(name: string, sourceWeek: string) {
  const row = await http.post<WeeklyTemplate>('/api/weekly-templates', { name, sourceWeek });
  notifyMutation('weeklyTemplates');
  return row;
}
export async function applyWeeklyTemplate(id: string, week: string) {
  const result = await http.post<{ added: number; skipped: number }>(`/api/weekly-templates/${id}/apply`, { week });
  notifyMutation('timeBlocks');
  return result;
}
export async function deleteWeeklyTemplate(id: string) {
  await http.del(`/api/weekly-templates/${id}`);
  notifyMutation('weeklyTemplates');
}
