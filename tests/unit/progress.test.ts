import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { createTodo } from '@/lib/repo/todos';
import { createHabit } from '@/lib/repo/habits';
import { toggleHabit } from '@/lib/repo/habitLogs';
import { createAnnualGoal, updateAnnualGoal } from '@/lib/repo/annualGoals';
import { computeGoalProgress, computeMultipleProgress } from '@/lib/progress';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('computeGoalProgress', () => {
  it('returns zero overall for goal with no linked entities', async () => {
    const p = await computeGoalProgress('g1');
    expect(p.overall).toBe(0);
    expect(p.numeric).toBeUndefined();
    expect(p.todos).toBeUndefined();
    expect(p.habits).toBeUndefined();
    expect(p.routines).toBeUndefined();
    expect(p.timeInvested.weekMin).toBe(0);
    expect(p.timeInvested.monthMin).toBe(0);
    expect(p.timeInvested.yearMin).toBe(0);
  });

  it('computes TODO percent from linked todos by status', async () => {
    await createTodo({ title: 'A', scope: 'year', scopeKey: '2026', parentGoalId: 'g1', status: 'done', order: 0 });
    await createTodo({ title: 'B', scope: 'year', scopeKey: '2026', parentGoalId: 'g1', status: 'done', order: 1 });
    await createTodo({ title: 'C', scope: 'year', scopeKey: '2026', parentGoalId: 'g1', status: 'pending', order: 2 });
    const p = await computeGoalProgress('g1');
    expect(p.todos?.total).toBe(3);
    expect(p.todos?.done).toBe(2);
    expect(p.todos?.pending).toBe(1);
    expect(p.todos?.percent).toBe(67);
  });

  it('computes numeric progress from AnnualGoal.target and monthlyActuals', async () => {
    const year = String(new Date().getFullYear());
    const ag = await createAnnualGoal(year, 1);
    await updateAnnualGoal(ag.id, {
      parentGoalId: 'g1',
      title: 'Test',
      target: 100,
      monthlyActuals: [10, 20, 15, null, null, null, null, null, null, null, null, null],
    });
    const p = await computeGoalProgress('g1');
    expect(p.numeric?.target).toBe(100);
    expect(p.numeric?.current).toBe(45);
    expect(p.numeric?.percent).toBe(45);
  });

  it('caps numeric percent at 100 when exceeding target', async () => {
    const year = String(new Date().getFullYear());
    const ag = await createAnnualGoal(year, 1);
    await updateAnnualGoal(ag.id, {
      parentGoalId: 'g1',
      target: 10,
      monthlyActuals: [20, null, null, null, null, null, null, null, null, null, null, null],
    });
    const p = await computeGoalProgress('g1');
    expect(p.numeric?.percent).toBe(100);
  });

  it('computes habit adherence from logs in current month', async () => {
    const h = await createHabit({ name: 'H1', color: '#000', order: 0, parentGoalId: 'g1' });
    const today = new Date();
    const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    await toggleHabit(h.id, `${ym}-01`);
    await toggleHabit(h.id, `${ym}-02`);
    await toggleHabit(h.id, `${ym}-03`);
    const p = await computeGoalProgress('g1');
    expect(p.habits?.total).toBe(1);
    expect(p.habits?.thisMonthLogs).toBe(3);
    expect(p.habits?.percent).toBeGreaterThan(0);
    expect(p.habits?.percent).toBeLessThanOrEqual(100);
  });

  it('counts routines linked to the goal', async () => {
    await db.routines.put({
      id: 'r1',
      name: 'Morning',
      dayOfWeek: 1,
      order: 0,
      parentGoalId: 'g1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const p = await computeGoalProgress('g1');
    expect(p.routines?.total).toBe(1);
  });

  it('sums time invested from TimeBlocks linked via goalId', async () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    await db.timeBlocks.put({
      id: 'tb1',
      date: today,
      startMin: 9 * 60,
      endMin: 10 * 60,
      text: 'work',
      categoryId: 'c1',
      goalId: 'g1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const p = await computeGoalProgress('g1', now);
    expect(p.timeInvested.weekMin).toBe(60);
    expect(p.timeInvested.monthMin).toBe(60);
    expect(p.timeInvested.yearMin).toBe(60);
  });

  it('overall is the average of available percents', async () => {
    await createTodo({ title: 'A', scope: 'year', scopeKey: '2026', parentGoalId: 'g1', status: 'done', order: 0 });
    await createTodo({ title: 'B', scope: 'year', scopeKey: '2026', parentGoalId: 'g1', status: 'pending', order: 1 });
    const year = String(new Date().getFullYear());
    const ag = await createAnnualGoal(year, 1);
    await updateAnnualGoal(ag.id, {
      parentGoalId: 'g1',
      target: 100,
      monthlyActuals: [80, null, null, null, null, null, null, null, null, null, null, null],
    });
    const p = await computeGoalProgress('g1');
    // todos 50% + numeric 80% → avg 65
    expect(p.overall).toBe(65);
  });

  it('computeMultipleProgress returns a map keyed by goalId', async () => {
    await createTodo({ title: 'A', scope: 'year', scopeKey: '2026', parentGoalId: 'g1', status: 'done', order: 0 });
    await createTodo({ title: 'B', scope: 'year', scopeKey: '2026', parentGoalId: 'g2', status: 'pending', order: 0 });
    const map = await computeMultipleProgress(['g1', 'g2']);
    expect(map.size).toBe(2);
    expect(map.get('g1')?.todos?.percent).toBe(100);
    expect(map.get('g2')?.todos?.percent).toBe(0);
  });
});
