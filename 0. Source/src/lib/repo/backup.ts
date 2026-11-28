import { BACKUP_COLLECTIONS, type ImportMode, type ImportResult } from '@/lib/backup';
import { http } from './http';
import { notifyMutation } from './events';

export async function importBackup(mode: ImportMode, data: unknown): Promise<ImportResult> {
  const result = await http.post<ImportResult>('/api/import', { mode, data });
  notifyMutation(...BACKUP_COLLECTIONS, 'settings');
  return result;
}
