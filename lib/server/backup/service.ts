import 'server-only';
import { BACKUP_COLLECTIONS, type ImportResult } from '@/lib/backup';
import type { BinderDatabase } from '../db/connection';
import { validateImport } from '../importValidation';
import { UserBackupRepository } from './repository';

/** Coordinates validation and all-or-nothing backup operations without HTTP dependencies. */
export class BackupService {
  constructor(
    private readonly database: () => BinderDatabase,
    private readonly now: () => Date = () => new Date(),
  ) {}

  exportFor(userId: string) {
    return this.database().transaction(tx => ({
      version: 10 as const,
      generatedAt: this.now().toISOString(),
      ...new UserBackupRepository(tx, userId).exportData(),
    }));
  }

  importFor(userId: string, raw: unknown): ImportResult {
    return this.database().transaction(tx => {
      const repository = new UserBackupRepository(tx, userId);
      // Validation and writes share the same lock: referenced rows cannot change in between.
      const { mode, data } = validateImport(raw, userId, repository);
      if (mode === 'merge') repository.preserveActuals();
      else repository.clear();
      const counts: ImportResult['counts'] = {};
      for (const name of BACKUP_COLLECTIONS) {
        const rows = data[name];
        if (!rows?.length) continue;
        repository.insert(name, rows);
        counts[name] = rows.length;
      }
      repository.reconcileAnnualGoals();
      if (data.settings) {
        repository.saveSettings(data.settings);
        counts.settings = 1;
      }
      return { ok: true, mode, counts };
    }, { behavior: 'immediate' });
  }
}

export type BackupDocument = ReturnType<BackupService['exportFor']>;
