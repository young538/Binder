import { db, markDirty } from '../db';
import { FocusNote, FocusScope } from '../types';
import { newId } from '../utils/id';

export const upsertFocus = async (
  scope: FocusScope,
  scopeKey: string,
  text: string
): Promise<FocusNote> => {
  const existing = await db.focusNotes.where({ scope, scopeKey }).first();
  const now = new Date().toISOString();
  if (existing) {
    const updated: FocusNote = { ...existing, text, updatedAt: now };
    await db.focusNotes.put(updated);
    await markDirty();
    return updated;
  }
  const created: FocusNote = {
    id: newId(),
    scope,
    scopeKey,
    text,
    updatedAt: now,
  };
  await db.focusNotes.put(created);
  await markDirty();
  return created;
};

export const getFocus = async (
  scope: FocusScope,
  scopeKey: string
): Promise<FocusNote | undefined> =>
  db.focusNotes.where({ scope, scopeKey }).first();
