import { BACKUP_COLLECTIONS, type ImportMode, type ImportResult } from '@/lib/backup';
import { http } from './http';
import { notifyMutation } from './events';

export async function importBackup(mode: ImportMode, data: unknown): Promise<ImportResult> {
  const result = await http.post<ImportResult>('/api/import', { mode, data });
  for (const name of BACKUP_COLLECTIONS) notifyMutation(name);
  notifyMutation('settings');
  return result;
}
