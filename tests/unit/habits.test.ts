import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { createHabit, listHabits, deleteHabit } from '@/lib/repo/habits';
import { toggleHabit, listLogsForRange } from '@/lib/repo/habitLogs';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('habits', () => {
  it('creates and lists habits ordered', async () => {
    await createHabit({ name: 'B', color: '#111', order: 1 });
    await createHabit({ name: 'A', color: '#222', order: 0 });
    const hs = await listHabits();
    expect(hs.map(h => h.name)).toEqual(['A', 'B']);
  });

  it('toggleHabit adds then removes a log', async () => {
    const h = await createHabit({ name: 'X', color: '#000', order: 0 });
    let done = await toggleHabit(h.id, '2026-04-13');
    expect(done).toBe(true);
    done = await toggleHabit(h.id, '2026-04-13');
    expect(done).toBe(false);
  });

  it('deleting a habit removes its logs', async () => {
    const h = await createHabit({ name: 'Y', color: '#000', order: 0 });
    await toggleHabit(h.id, '2026-04-13');
    await toggleHabit(h.id, '2026-04-14');
    await deleteHabit(h.id);
    const logs = await listLogsForRange('2026-04-01', '2026-04-30');
    expect(logs).toHaveLength(0);
  });

  it('stores and retrieves parentGoalId', async () => {
    const h = await createHabit({
      name: 'parented',
      color: '#000',
      order: 0,
      parentGoalId: 'goal-123',
    });
    const hs = await listHabits();
    const found = hs.find(x => x.id === h.id);
    expect(found?.parentGoalId).toBe('goal-123');
  });
});
