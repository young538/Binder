import 'server-only';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { focusNotes } from '../db/schema';
import { FocusNote, FocusScope } from '@/lib/types';
import { newId } from '@/lib/utils/id';
import type { BinderDatabase } from '../db/connection';

/** User-scoped focusNotes operations; accepts an isolated database for tests. */
export class FocusNoteRepository {
  constructor(private readonly database: BinderDatabase, private readonly userId: string) { }

  async get(scope: FocusScope, scopeKey: string): Promise<FocusNote | null> {
    const userId = this.userId;
    const db = this.database;
    const row = await db
      .select()
      .from(focusNotes)
      .where(
        and(
          eq(focusNotes.userId, userId),
          eq(focusNotes.scope, scope),
          eq(focusNotes.scopeKey, scopeKey)
        )
      )
      .get();
    return (row as FocusNote | undefined) ?? null;
  }

  async upsert(scope: FocusScope, scopeKey: string, text: string): Promise<FocusNote> {
    const userId = this.userId;
    const db = this.database;
    return db.transaction(tx => {
      const existing = tx.select().from(focusNotes).where(and(
        eq(focusNotes.userId, userId), eq(focusNotes.scope, scope), eq(focusNotes.scopeKey, scopeKey),
      )).get();
      const now = new Date().toISOString();
      if (existing) {
        tx.update(focusNotes).set({ text, updatedAt: now })
          .where(and(eq(focusNotes.userId, userId), eq(focusNotes.id, existing.id))).run();
        return { ...existing, scope, text, updatedAt: now };
      }
      const row: FocusNote = { id: newId(), userId, scope, scopeKey, text, updatedAt: now };
      tx.insert(focusNotes).values(row).run();
      return row;
    }, { behavior: 'immediate' });
  }
}

// Compatibility functions for existing callers. New services can inject the repository.
export const getFocus = async (userId: string, scope: FocusScope, scopeKey: string): Promise<FocusNote | null> =>
  new FocusNoteRepository(getDb(), userId).get(scope, scopeKey);

export const upsertFocus = async (userId: string, scope: FocusScope, scopeKey: string, text: string): Promise<FocusNote> =>
  new FocusNoteRepository(getDb(), userId).upsert(scope, scopeKey, text);
