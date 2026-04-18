import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import {
  createAnnualGoal,
  listByYear,
  ensureSeven,
  updateAnnualGoal,
} from '@/lib/repo/annualGoals';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('annualGoals repo', () => {
  it('ensureSeven creates 7 rows', async () => {
    const rows = await ensureSeven('2026');
    expect(rows).toHaveLength(7);
    expect(rows.map(r => r.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(rows[0].monthlyTargets).toHaveLength(12);
  });

  it('ensureSeven is idempotent', async () => {
    await ensureSeven('2026');
    await ensureSeven('2026');
    const rows = await listByYear('2026');
    expect(rows).toHaveLength(7);
  });

  it('updateAnnualGoal persists', async () => {
    const g = await createAnnualGoal('2026', 1);
    await updateAnnualGoal(g.id, { title: '인스타 1만팔' });
    const updated = await db.annualGoals.get(g.id);
    expect(updated?.title).toBe('인스타 1만팔');
  });
});
