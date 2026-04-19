import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import {
  createRoutine,
  listAllRoutines,
  listRoutinesByDay,
} from '@/lib/repo/routines';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('routines', () => {
  it('creates and sorts by dayOfWeek then order', async () => {
    await createRoutine({ name: 'tuesA', dayOfWeek: 1, order: 0 });
    await createRoutine({ name: 'monB', dayOfWeek: 0, order: 1 });
    await createRoutine({ name: 'monA', dayOfWeek: 0, order: 0 });
    const all = await listAllRoutines();
    expect(all.map((r) => r.name)).toEqual(['monA', 'monB', 'tuesA']);
  });

  it('listRoutinesByDay filters by day', async () => {
    await createRoutine({ name: 'A', dayOfWeek: 0, order: 0 });
    await createRoutine({ name: 'B', dayOfWeek: 2, order: 0 });
    const mon = await listRoutinesByDay(0);
    expect(mon).toHaveLength(1);
    expect(mon[0].name).toBe('A');
  });

  it('stores and retrieves parentGoalId', async () => {
    const r = await createRoutine({
      name: 'parented',
      dayOfWeek: 1,
      order: 0,
      parentGoalId: 'goal-abc',
    });
    const all = await listAllRoutines();
    const found = all.find((x) => x.id === r.id);
    expect(found?.parentGoalId).toBe('goal-abc');
  });
});
