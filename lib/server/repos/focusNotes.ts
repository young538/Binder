import 'server-only';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { focusNotes } from '../db/schema';
import { FocusNote, FocusScope } from '@/lib/types';
import { newId } from '@/lib/utils/id';

export const getFocus = async (
  userId: string,
  scope: FocusScope,
  scopeKey: string
): Promise<FocusNote | null> => {
  const db = getDb();
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
};

export const upsertFocus = async (
  userId: string,
  scope: FocusScope,
  scopeKey: string,
  text: string
): Promise<FocusNote> => {
  const db = getDb();
  const existing = await getFocus(userId, scope, scopeKey);
  const now = new Date().toISOString();
  if (existing) {
    await db
      .update(focusNotes)
      .set({ text, updatedAt: now })
      .where(and(eq(focusNotes.userId, userId), eq(focusNotes.id, existing.id)))
      .run();
    return { ...existing, text, updatedAt: now };
  }
  const row: FocusNote = { id: newId(), userId, scope, scopeKey, text, updatedAt: now };
  await db.insert(focusNotes).values(row).run();
  return row;
};
