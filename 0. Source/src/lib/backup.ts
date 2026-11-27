/** Shared collection names for backup validation, persistence and UI previews. */
export const BACKUP_COLLECTIONS = [
  'goals', 'categories', 'projects', 'people', 'metrics', 'metricEntries', 'injectionPens', 'injectionEntries',
  'dailyCheckins', 'notes', 'lifeEvents', 'subscriptions', 'financeTransactions', 'financeBudgets',
  'timeBlocks', 'retrospectives', 'todos',
  'focusNotes', 'annualGoals', 'habits', 'habitLogs', 'books', 'weeklyTemplates',
] as const;

export type BackupCollection = typeof BACKUP_COLLECTIONS[number];
export type ImportMode = 'merge' | 'replace';
export interface ImportBody {
  mode: ImportMode;
  data: Partial<Record<BackupCollection, Record<string, unknown>[]>> & {
    settings?: Record<string, unknown> | null;
  };
}
export interface ImportResult {
  ok: true;
  mode: ImportMode;
  counts: Partial<Record<BackupCollection | 'settings', number>>;
}
