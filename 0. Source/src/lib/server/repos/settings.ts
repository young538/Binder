import 'server-only';
import { eq } from 'drizzle-orm';
import type { Settings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { validateFields, validateRelationships } from '@/lib/validation/mutations';
import type { BinderDatabase, DatabaseSession } from '../db/connection';
import { settings } from '../db/schema';

/** Settings belonging to a single user; defaults and writes have one owner. */
export class SettingsRepository {
  constructor(private readonly database: BinderDatabase, private readonly userId: string) { }

  get(db: DatabaseSession = this.database): Settings {
    const row = db.select().from(settings).where(eq(settings.userId, this.userId)).get();
    if (!row) return { ...DEFAULT_SETTINGS };
    const { userId, ...values } = row;
    void userId;
    return values as Settings;
  }

  update(patch: Partial<Settings>): Settings {
    validateFields('settings', patch, true);
    return this.database.transaction(tx => {
      const values = { ...this.get(tx), ...patch };
      validateRelationships('settings', values);
      tx.insert(settings).values({ ...values, userId: this.userId })
        .onConflictDoUpdate({ target: settings.userId, set: values }).run();
      return values;
    }, { behavior: 'immediate' });
  }
}
