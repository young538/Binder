import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { getDb, closeDb, schema } from '@/lib/server/db/client';
import { createAnnualGoal, listAnnualGoalsByYear, updateAnnualGoal } from '@/lib/server/repos/annualGoals';
import { createHabit, updateHabit, deleteHabit } from '@/lib/server/repos/habits';
import { toggleHabit, listLogsForRange } from '@/lib/server/repos/habitLogs';
import { computeGoalProgress } from '@/lib/server/progress';
import { computeHabitStatsForRange, computeHabitYearBreakdown, expectedHabitCountInRange, habitTrackerLogRange } from '@/lib/utils/habitSchedule';
import { Habit, HabitLog } from '@/lib/types';

vi.mock('@/lib/server/auth', () => ({ requireSession: async () => ({ userId: 'aggregate-user' }) }));

const tmpDb = path.join(process.cwd(), 'tmp-test', `aggregates-${process.pid}-${Date.now()}.sqlite`);
const uid = 'aggregate-user';
const empty = () => Array<number | null>(12).fill(null);
const goal = async (id: string) => (await listAnnualGoalsByYear(uid, '2026')).find(row => row.id === id)!;

beforeEach(() => { process.env.DB_PATH = tmpDb; });
afterEach(() => {
  closeDb();
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${tmpDb}${suffix}`, { force: true });
});

describe('annual actuals from logs and manual offsets', () => {
  it('sums manual monthly targets including clearing the last value and preserves annual-only edits', async () => {
    const annual = await createAnnualGoal(uid, '2026', 0);
    const targets = empty(); targets[0] = 12; targets[3] = 8;
    await updateAnnualGoal(uid, annual.id, { monthlyTargets: targets, target: 999 });
    expect((await goal(annual.id)).target).toBe(20);
    await updateAnnualGoal(uid, annual.id, { monthlyTargets: empty() });
    expect((await goal(annual.id)).target).toBe(0);
    await updateAnnualGoal(uid, annual.id, { target: 42 });
    expect((await goal(annual.id)).target).toBe(42);
    await updateAnnualGoal(uid, annual.id, { title: 'Keep annual target' });
    expect((await goal(annual.id)).target).toBe(42);
    const habit = await createHabit(uid, { name: 'Read', color: '#ffffff', order: 0, annualGoalId: annual.id });
    await updateAnnualGoal(uid, annual.id, { monthlyTargets: empty(), target: 0 });
    expect((await goal(annual.id)).target).toBe(365);
    await deleteHabit(uid, habit.id);
  });

  it('roundtrips exported adjustments and initializes legacy imports after their logs are inserted', async () => {
    const { GET: exportData } = await import('@/app/api/export/route');
    const { POST: importData } = await import('@/app/api/import/route');
    const annual = await createAnnualGoal(uid, '2026', 0);
    const habit = await createHabit(uid, { name: 'Read', color: '#ffffff', order: 0, annualGoalId: annual.id });
    await toggleHabit(uid, habit.id, '2026-01-01');
    const totals = empty(); totals[0] = 10;
    await updateAnnualGoal(uid, annual.id, { monthlyActuals: totals });
    const exported = await (await exportData()).json();
    expect(exported.annualGoals[0].monthlyActuals[0]).toBe(10);
    expect(exported.annualGoals[0].monthlyActualAdjustments[0]).toBe(9);
    const restore = () => importData(new Request('http://localhost/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'replace', data: exported }) }));
    expect((await restore()).status).toBe(200);
    await toggleHabit(uid, habit.id, '2026-01-02');
    expect((await goal(annual.id)).monthlyActuals[0]).toBe(11);
    delete exported.annualGoals[0].monthlyActualAdjustments;
    expect((await restore()).status).toBe(200);
    await toggleHabit(uid, habit.id, '2026-01-02');
    expect((await goal(annual.id)).monthlyActuals[0]).toBe(11);
  });

  it('moves logs on relink, removes them on deletion, preserves manual offsets and clears the last target', async () => {
    const first = await createAnnualGoal(uid, '2026', 0);
    const second = await createAnnualGoal(uid, '2026', 1);
    const habit = await createHabit(uid, { name: 'Read', color: '#fff', order: 0, annualGoalId: first.id, schedule: { kind: 'perWeek', count: 3 } });
    await toggleHabit(uid, habit.id, '2026-01-01');
    await toggleHabit(uid, habit.id, '2026-01-02');
    const totals = empty(); totals[0] = 10;
    await updateAnnualGoal(uid, first.id, { monthlyActuals: totals });
    expect((await goal(first.id)).monthlyActuals[0]).toBe(10);
    await updateHabit(uid, habit.id, { annualGoalId: second.id });
    expect((await goal(first.id)).monthlyActuals[0]).toBe(8);
    expect((await goal(first.id)).target).toBe(0);
    expect((await goal(first.id)).monthlyTargets).toEqual(Array(12).fill(0));
    expect((await goal(second.id)).monthlyActuals[0]).toBe(2);
    await deleteHabit(uid, habit.id);
    expect((await goal(second.id)).monthlyActuals[0] ?? 0).toBe(0);
    expect((await goal(second.id)).target).toBe(0);
    expect((await goal(first.id)).monthlyActuals[0]).toBe(8);
  });

  it('does not lose concurrent completions and treats repeated toggles as one logical log', async () => {
    const annual = await createAnnualGoal(uid, '2026', 0);
    const habit = await createHabit(uid, { name: 'Read', color: '#fff', order: 0, annualGoalId: annual.id });
    await Promise.all(Array.from({ length: 20 }, (_, i) => toggleHabit(uid, habit.id, `2026-01-${String(i + 1).padStart(2, '0')}`)));
    expect((await goal(annual.id)).monthlyActuals[0]).toBe(20);
    await Promise.all(Array.from({ length: 10 }, () => toggleHabit(uid, habit.id, '2026-02-01')));
    expect(await listLogsForRange(uid, '2026-02-01', '2026-02-01')).toHaveLength(0);
    expect((await goal(annual.id)).monthlyActuals[0]).toBe(20);
    await expect(toggleHabit('other-user', habit.id, '2026-01-01')).rejects.toThrow('Habit not found');
  });

  it('preserves a legacy imported baseline before mutation and counts duplicate logs once', async () => {
    const annual = await createAnnualGoal(uid, '2026', 0);
    const habit = await createHabit(uid, { name: 'Read', color: '#fff', order: 0, annualGoalId: annual.id });
    await toggleHabit(uid, habit.id, '2026-01-01');
    const db = getDb();
    db.insert(schema.habitLogs).values({ id: 'duplicate', userId: uid, habitId: habit.id, date: '2026-01-01', createdAt: '' }).run();
    const totals = empty(); totals[0] = 6;
    db.update(schema.annualGoals).set({ monthlyActuals: totals, monthlyActualAdjustments: null }).where(eq(schema.annualGoals.id, annual.id)).run();
    await toggleHabit(uid, habit.id, '2026-01-02');
    expect((await goal(annual.id)).monthlyActuals[0]).toBe(7);
    await toggleHabit(uid, habit.id, '2026-01-01');
    expect((await goal(annual.id)).monthlyActuals[0]).toBe(6);
    expect(await listLogsForRange(uid, '2026-01-01', '2026-01-01')).toHaveLength(0);
  });

  it('backfills signed manual offsets during the schema migration without changing legacy totals', () => {
    const db = new Database(':memory:');
    try {
      db.exec('CREATE TABLE annual_goals (id text, user_id text, year text, monthly_actuals text); CREATE TABLE habits (id text, user_id text, annual_goal_id text); CREATE TABLE habit_logs (habit_id text, user_id text, date text);');
      const totals = empty(); totals[0] = 7; totals[1] = 0;
      db.prepare('INSERT INTO annual_goals VALUES (?, ?, ?, ?)').run('a', uid, '2026', JSON.stringify(totals));
      db.prepare('INSERT INTO habits VALUES (?, ?, ?)').run('h', uid, 'a');
      const insert = db.prepare('INSERT INTO habit_logs VALUES (?, ?, ?)');
      insert.run('h', uid, '2026-01-01'); insert.run('h', uid, '2026-01-01');
      insert.run('h', uid, '2026-02-01'); insert.run('h', 'other', '2026-01-02');
      db.exec(fs.readFileSync(path.join(process.cwd(), 'drizzle/0005_annual_actual_adjustments.sql'), 'utf8'));
      const row = db.prepare('SELECT monthly_actual_adjustments AS offsets FROM annual_goals').get() as { offsets: string };
      expect(JSON.parse(row.offsets)).toEqual([6, -1, ...Array(10).fill(null)]);
    } finally { db.close(); }
  });
});

describe('selected-period progress', () => {
  it('counts actual time only and includes the complete week at the year boundary', async () => {
    const now = '';
    getDb().insert(schema.timeBlocks).values([
      { id: 'dec', userId: uid, date: '2025-12-29', startMin: 0, endMin: 30, text: '', kind: 'actual', categoryId: 'c', goalId: 'g', createdAt: now, updatedAt: now },
      { id: 'jan', userId: uid, date: '2026-01-01', startMin: 0, endMin: 60, text: '', kind: 'actual', categoryId: 'c', goalId: 'g', createdAt: now, updatedAt: now },
      { id: 'plan', userId: uid, date: '2026-01-01', startMin: 0, endMin: 300, text: '', kind: 'plan', categoryId: 'c', goalId: 'g', createdAt: now, updatedAt: now },
      { id: 'feb', userId: uid, date: '2026-02-01', startMin: 0, endMin: 120, text: '', kind: 'actual', categoryId: 'c', goalId: 'g', createdAt: now, updatedAt: now },
    ]).run();
    getDb().insert(schema.todos).values([
      { id: 'jan-todo', userId: uid, title: '', scope: 'day', scopeKey: '2026-01-01', status: 'done', order: 0, parentGoalId: 'g', createdAt: now, updatedAt: now },
      { id: 'feb-todo', userId: uid, title: '', scope: 'month', scopeKey: '2026-02', status: 'pending', order: 0, parentGoalId: 'g', createdAt: now, updatedAt: now },
    ]).run();
    const january = await computeGoalProgress(uid, 'g', new Date(2026, 0, 1));
    expect(january.timeInvested).toEqual({ weekMin: 90, monthMin: 60, yearMin: 180 });
    expect(january.todos).toMatchObject({ total: 1, done: 1, percent: 100 });
    const february = await computeGoalProgress(uid, 'g', new Date(2026, 1, 1));
    expect(february.timeInvested.monthMin).toBe(120);
    expect(february.todos).toMatchObject({ total: 1, done: 0, percent: 0 });
  });
});

describe('shared schedule aggregation', () => {
  it('uses selected weekdays and flexible quotas, ignores orphan/duplicate/out-of-period logs and caps percent', () => {
    const habits = [
      { id: 'fixed', schedule: { kind: 'weekdays', days: [1, 3, 5] } },
      { id: 'weekly', schedule: { kind: 'perWeek', count: 2 } },
      { id: 'monthly', schedule: { kind: 'perMonth', count: 4 } },
    ] as Habit[];
    const logs = [
      { habitId: 'fixed', date: '2026-09-07' }, { habitId: 'fixed', date: '2026-09-07' },
      { habitId: 'fixed', date: '2026-09-08' }, { habitId: 'weekly', date: '2026-09-08' },
      { habitId: 'monthly', date: '2026-09-09' }, { habitId: 'orphan', date: '2026-09-09' },
      { habitId: 'weekly', date: '2026-08-31' },
    ] as HabitLog[];
    expect(computeHabitStatsForRange(habits, logs, new Date(2026, 8, 7), new Date(2026, 8, 13))).toEqual({ total: 3, logs: 3, expected: 6, percent: 50 });
    expect(computeHabitStatsForRange([habits[1]], Array.from({ length: 7 }, (_, i) => ({ habitId: 'weekly', date: `2026-09-${String(7 + i).padStart(2, '0')}` })) as HabitLog[], new Date(2026, 8, 7), new Date(2026, 8, 13)).percent).toBe(100);
  });

  it('shares month quota math with annual targets and loads full weeks crossing months', () => {
    const schedule = { kind: 'perWeek', count: 3 } as const;
    expect(computeHabitYearBreakdown(schedule, '2026').monthlyTargets[0]).toBe(expectedHabitCountInRange(schedule, new Date(2026, 0, 1), new Date(2026, 0, 31)));
    expect(habitTrackerLogRange(new Date(2026, 8, 1))).toEqual({ start: '2026-08-31', end: '2026-09-30' });
    expect(habitTrackerLogRange(new Date(2026, 8, 30))).toEqual({ start: '2026-09-01', end: '2026-10-04' });
  });
});
