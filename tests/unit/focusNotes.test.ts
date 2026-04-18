import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { upsertFocus, getFocus } from '@/lib/repo/focusNotes';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('focusNotes', () => {
  it('upserts new', async () => {
    const f = await upsertFocus('year', 'year:2026', '올해 한 문장');
    expect(f.text).toBe('올해 한 문장');
  });

  it('updates existing', async () => {
    await upsertFocus('month', 'month:2026-04', 'first');
    await upsertFocus('month', 'month:2026-04', 'second');
    const f = await getFocus('month', 'month:2026-04');
    expect(f?.text).toBe('second');
    const all = await db.focusNotes.toArray();
    expect(all).toHaveLength(1);
  });

  it('separates by scope+key', async () => {
    await upsertFocus('week', 'week:2026-W16', 'A');
    await upsertFocus('week', 'week:2026-W17', 'B');
    expect((await getFocus('week', 'week:2026-W16'))?.text).toBe('A');
    expect((await getFocus('week', 'week:2026-W17'))?.text).toBe('B');
  });
});
