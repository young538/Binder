// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { BACKUP_COLLECTIONS } from '@/lib/backup';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { DatabaseConnection } from '@/lib/server/db/connection';
import { UserRepositories } from '@/lib/server/repos';
import { GoalRepository } from '@/lib/server/repos/goals';
import { TodoActions } from '@/lib/server/todos/actions';
import { BackupService } from '@/lib/server/backup/service';
import { SettingsRepository } from '@/lib/server/repos/settings';
import { GoogleCalendarConnectionRepository } from '@/lib/server/repos/googleCalendar';

let connection: DatabaseConnection;
let backups: BackupService;
const now = '2026-10-29T00:00:00.000Z';
const times = { createdAt: now, updatedAt: now };
const fixture = () => ({
  goals: [{ id: 'goal', title: '목표', level: 'oneThing', order: 0, ...times }],
  categories: [{ id: 'category', name: '분류', color: '#123456', order: 0 }],
  projects: [{ id: 'project', title: '프로젝트', status: 'active', order: 0, goalId: 'goal', categoryId: 'category', deadline: '2026-11-30', outcome: '배포', note: '메모', ...times }],
  people: [{ id: 'person', name: '민수', relationship: '친구', cadenceDays: 30, lastContactAt: '2026-10-20', birthday: '1990-05-05', giftIdeas: '커피', note: '메모', order: 0, ...times }],
  metrics: [{ id: 'metric', name: '체중', unit: 'kg', direction: 'down', targetValue: 70, goalId: 'goal', color: '#2563eb', order: 0, ...times }],
  metricEntries: [{ id: 'entry', metricId: 'metric', date: '2026-10-29', value: 73.5, note: '아침', ...times }],
  injectionPens: [{ id: 'pen', drug: 'semaglutide', name: '펜', capacityMcg: 1000, closed: false, ...times }],
  injectionEntries: [{ id: 'dose', penId: 'pen', takenAt: '2020-01-01T00:00:00.000Z', amountMcg: 100, ...times }],
  dailyCheckins: [{ id: 'checkin', date: '2026-10-29', sleepHours: 7.5, energy: 4, stress: 2, mood: '좋음', ...times }],
  notes: [{ id: 'binderNote', kind: 'principle', title: '원칙', body: '본문', pinned: true, reviewDate: null, decisionOutcome: null, goalId: 'goal', projectId: 'project', sourceRetro: null, ...times }],
  lifeEvents: [{ id: 'event', title: '기념일', date: '2026-10-29', endDate: null, kind: 'anniversary', allDay: true, startMin: null, endMin: null, color: null, personId: 'person', projectId: 'project', goalId: 'goal', externalUid: null, googleCalendarId: null, googleEventId: null, googleUpdatedAt: null, note: '메모', ...times }],
  subscriptions: [{ id: 'sub', name: 'ChatGPT Plus', amount: 29000, currency: 'KRW', billingCycle: 'monthly', status: 'active', billingDay: 1, nextBillingDate: '2026-11-01', category: 'AI/생산성', paymentMethod: '현대카드', autoRenew: true, url: 'https://chatgpt.com', note: '메모', order: 0, ...times }],
  financeTransactions: [{ id: 'ftx', date: '2026-10-29', time: '12:30', kind: 'expense', amount: 12000, currency: 'KRW', category: '식비', subCategory: '점심', merchant: '김밥천국', paymentMethod: '현대카드', note: '메모', excluded: false, source: 'manual', externalHash: null, subscriptionId: 'sub', ...times }],
  financeBudgets: [{ id: 'fbd', yyyymm: 'default', category: '__total__', amount: 1500000, ...times }],
  timeBlocks: [{ id: 'time', date: '2026-10-29', startMin: 540, endMin: 600, text: '계획', kind: 'plan', categoryId: 'category', projectId: 'project', todoId: 'todo', ...times }],
  retrospectives: [{ id: 'retro', type: 'daily', dateOrWeek: '2026-10-29', template: { good: '기록' }, ...times }],
  todos: [{ id: 'todo', title: '할 일', scope: 'day', scopeKey: '2026-10-29', status: 'pending', order: 0, parentGoalId: 'goal', projectId: 'project', ...times }],
  focusNotes: [{ id: 'note', scope: 'board', scopeKey: 'main', text: '메모', updatedAt: now }],
  annualGoals: [{ id: 'annual', year: '2026', title: '수치', order: 0, monthlyTargets: Array(12).fill(null), monthlyActuals: Array(12).fill(null), ...times }],
  habits: [{ id: 'habit', name: '루틴', color: '#123456', order: 0, schedule: { kind: 'daily' }, annualGoalId: 'annual', ...times }],
  habitLogs: [{ id: 'log', habitId: 'habit', date: '2026-10-29', createdAt: now }],
  books: [{ id: 'book', year: '2026', order: 0, title: '책', ...times }],
  weeklyTemplates: [{ id: 'template', name: '기본 주간', blocks: [{ dayOffset: 0, startMin: 540, endMin: 600, text: '계획', categoryId: 'category', goalId: 'goal' }], ...times }],
  settings: { ...DEFAULT_SETTINGS, theme: 'dark' },
});

beforeEach(() => {
  connection = new DatabaseConnection({ filename: () => ':memory:', migrationsFolder: path.join(process.cwd(), 'drizzle') });
  backups = new BackupService(() => connection.get(), () => new Date(now));
});
afterEach(() => connection.close());

describe('backup service transactions and account boundaries', () => {
  it('round-trips all nineteen collections and preserves annual baselines and settings', () => {
    const imported = backups.importFor('a', { mode: 'replace', data: fixture() });
    new GoogleCalendarConnectionRepository(connection.get(), 'a').upsert({
      googleEmail: 'alice@gmail.com',
      accessTokenEnc: 'enc-secret-oauth-token',
      refreshTokenEnc: 'enc-refresh-oauth-token',
      tokenExpiresAt: now,
      calendarMeta: [{ id: 'primary', summary: '내 일정', backgroundColor: null, primary: true, accessRole: 'owner' }],
    });
    for (const name of BACKUP_COLLECTIONS) expect(imported.counts[name]).toBe(1);
    const first = backups.exportFor('a');
    expect(first).not.toHaveProperty('googleCalendarConnections');
    expect(JSON.stringify(first)).not.toContain('enc-secret-oauth-token');
    expect(first.version).toBe(22);
    expect(first.generatedAt).toBe(now);
    expect(first.annualGoals[0].target).toBe(365);
    expect(first.annualGoals[0].monthlyActualAdjustments).toHaveLength(12);
    backups.importFor('a', { mode: 'replace', data: first });
    const second = backups.exportFor('a');
    // Reconciliation timestamps can change; domain values and manual offsets cannot.
    expect(second.annualGoals[0].monthlyActuals).toEqual(first.annualGoals[0].monthlyActuals);
    expect(second.annualGoals[0].monthlyActualAdjustments).toEqual(first.annualGoals[0].monthlyActualAdjustments);
    for (const name of BACKUP_COLLECTIONS) expect(second[name]).toHaveLength(1);
    expect(second.settings).toEqual({ ...DEFAULT_SETTINGS, theme: 'dark' });
    expect(backups.exportFor('b').todos).toEqual([]);
    expect(second).not.toHaveProperty('users');
  });

  it('deletes a goal subtree atomically and round-trips every remaining linked record', async () => {
    const data = fixture();
    const root = data.goals[0];
    backups.importFor('a', { mode: 'replace', data: {
      ...data, goals: [root, { ...root, id: 'core', parentId: root.id, level: 'mandalartCore' },
        { ...root, id: 'sub', parentId: 'core', level: 'mandalartSub' }, { ...root, id: 'keep' }],
      todos: [{ ...data.todos[0], parentGoalId: 'sub' }],
      habits: [{ ...data.habits[0], parentGoalId: 'core' }],
      annualGoals: [{ ...data.annualGoals[0], parentGoalId: root.id }],
      timeBlocks: [{ ...data.timeBlocks[0], goalId: 'sub' }],
    } });
    const db = connection.get();
    await new GoalRepository(db, 'b').delete(root.id);
    expect(backups.exportFor('a').goals).toHaveLength(4);
    const goals = new GoalRepository(db, 'a');
    db.run(sql.raw("CREATE TRIGGER fail_goal BEFORE DELETE ON goals BEGIN SELECT RAISE(ABORT, 'interrupted'); END"));
    await expect(goals.delete(root.id)).rejects.toThrow();
    expect(backups.exportFor('a').todos[0].parentGoalId).toBe('sub');
    db.run(sql.raw('DROP TRIGGER fail_goal'));
    await goals.delete(root.id);
    const saved = backups.exportFor('a');
    expect(saved.goals.map(row => row.id)).toEqual(['keep']);
    for (const rows of [saved.todos, saved.habits, saved.annualGoals]) expect(rows[0].parentGoalId).toBeNull();
    for (const rows of [saved.projects, saved.metrics, saved.notes, saved.lifeEvents, saved.timeBlocks]) {
      expect(rows[0].goalId).toBeNull();
    }
    expect(saved.weeklyTemplates[0].blocks[0]).toMatchObject({ goalId: null, categoryId: 'category' });
    expect(backups.importFor('a', { mode: 'replace', data: saved }).ok).toBe(true);
  });

  it('repairs dangling goal links only in legacy exports and preserves the input', () => {
    const data = { ...fixture(), version: 16, generatedAt: now, goals: [] };
    expect(backups.importFor('a', { mode: 'replace', data }).ok).toBe(true);
    expect(data.weeklyTemplates[0].blocks[0].goalId).toBe('goal');
    expect(backups.exportFor('a').todos[0].parentGoalId).toBeNull();
    expect(() => backups.importFor('a', { mode: 'replace', data: { ...data, version: 17 } })).toThrow('Invalid reference');
    backups.importFor('b', { mode: 'replace', data: { goals: fixture().goals } });
    expect(() => backups.importFor('a', { mode: 'replace', data })).toThrow('Invalid reference');
  });

  it('moves category links, retains subscription expenses, and restores into an empty database', async () => {
    const r = new UserRepositories(connection.get(), 'a');
    const data = fixture();
    backups.importFor('a', { mode: 'replace', data });
    const replacement = await r.categories.create({ name: '옮길 분류', color: '#123456', order: 1 });
    const foreign = await new UserRepositories(connection.get(), 'b').categories.create({ name: 'B', color: '#123456', order: 0 });
    await expect(r.categories.delete('category')).rejects.toThrow('옮길 카테고리');
    await expect(r.categories.delete('category', foreign.id)).rejects.toThrow();
    await expect(r.categories.delete('category', 'category')).rejects.toThrow();
    expect(backups.exportFor('a').timeBlocks[0].categoryId).toBe('category');
    await r.categories.delete('category', replacement.id);
    r.subscriptions.delete('sub');
    const saved = backups.exportFor('a');
    expect(saved.timeBlocks[0].categoryId).toBe(replacement.id);
    expect(saved.weeklyTemplates[0].blocks[0].categoryId).toBe(replacement.id);
    expect(saved.projects[0].categoryId).toBe(replacement.id);
    expect(saved.financeTransactions[0]).toMatchObject({ id: 'ftx', amount: data.financeTransactions[0].amount, subscriptionId: null });
    const fresh = new DatabaseConnection({ filename: () => ':memory:', migrationsFolder: path.resolve('drizzle') });
    try {
      const service = new BackupService(() => fresh.get());
      expect(service.importFor('a', { mode: 'replace', data: saved }).ok).toBe(true);
      expect(service.exportFor('a').weeklyTemplates).toEqual(saved.weeklyTemplates);
    } finally {
      fresh.close();
    }
  });

  it('repairs pre-v18 category and subscription orphans without duplicating recovery categories on merge', () => {
    const data = { ...fixture(), version: 17, generatedAt: now, categories: [], subscriptions: [] };
    backups.importFor('a', { mode: 'merge', data });
    backups.importFor('a', { mode: 'merge', data });
    const saved = backups.exportFor('a');
    expect(saved.categories).toHaveLength(1);
    expect(saved.categories[0].name).toBe('기타');
    expect(saved.weeklyTemplates[0].blocks[0].categoryId).toBe(saved.categories[0].id);
    expect(saved.timeBlocks[0].categoryId).toBe(saved.categories[0].id);
    expect(saved.projects[0].categoryId).toBeNull();
    expect(saved.financeTransactions[0].subscriptionId).toBeNull();
    expect(() => backups.importFor('a', { mode: 'replace', data: { ...data, version: 18 } })).toThrow('Invalid reference');
  });

  it('round-trips 3500 todos in one replacement transaction', () => {
    const todos = Array.from({ length: 3500 }, (_, i) => ({
      id: String(i), scope: 'inbox', scopeKey: 'inbox', title: 'Read', status: 'pending', order: i, ...times,
    }));
    backups.importFor('a', { mode: 'replace', data: { todos } });
    const exported = backups.exportFor('a');
    backups.importFor('a', { mode: 'replace', data: exported });
    expect(backups.exportFor('a').todos).toHaveLength(todos.length);
  });

  it('round-trips a block after TODO deletion without breaking undo in the live database', () => {
    backups.importFor('a', { mode: 'replace', data: fixture() });
    const actions = new TodoActions(connection.get(), 'a');
    actions.remove('todo');
    const backup = backups.exportFor('a');
    expect(backup.timeBlocks[0].todoId).toBeNull();
    actions.restore('todo');
    expect(backups.exportFor('a').timeBlocks[0].todoId).toBe('todo');
    backups.importFor('a', { mode: 'replace', data: backup });
    expect(backups.exportFor('a').timeBlocks).toEqual(backup.timeBlocks);
  });

  it('repairs old exported TODO links without modifying the input or accepting a foreign reference', () => {
    const data = { ...fixture(), generatedAt: now, version: 15, todos: [] };
    backups.importFor('a', { mode: 'replace', data });
    expect(data.timeBlocks[0].todoId).toBe('todo');
    expect(backups.exportFor('a').timeBlocks[0].todoId).toBeNull();
    backups.importFor('b', { mode: 'merge', data: { todos: [{ ...fixture().todos[0],
      parentGoalId: null, projectId: null }] } });
    expect(() => backups.importFor('a', { mode: 'replace', data })).toThrow('Invalid reference');
  });

  it('preserves the current Google link when merging a legacy duplicate without dropping either todo', () => {
    const todo = { ...fixture().todos[0], parentGoalId: null, projectId: null, googleTaskId: 'remote', googleTaskListId: 'list' };
    backups.importFor('a', { mode: 'replace', data: { todos: [todo] } });
    backups.importFor('a', { mode: 'merge', data: { todos: [{ ...todo, id: 'earlier', createdAt: '2026-01-01T00:00:00Z' }] } });
    expect(backups.exportFor('a').todos.map(row => [row.id, row.googleTaskId]).sort())
      .toEqual([['earlier', null], ['todo', 'remote']]);
  });

  it('pairs legacy plans with matching actuals only once and preserves explicit independent records', () => {
    const data = fixture();
    const plan = data.timeBlocks[0];
    const blocks = [plan, { ...plan, id: 'plan2' }, { ...plan, id: 'actual1', kind: 'actual' },
      { ...plan, id: 'actual2', kind: 'actual', sourcePlanId: null }];
    backups.importFor('a', { mode: 'replace', data: { ...data, timeBlocks: blocks } });
    const saved = backups.exportFor('a');
    expect(saved.timeBlocks.filter(block => block.sourcePlanId)).toHaveLength(1);
    backups.importFor('a', { mode: 'replace', data: saved });
    expect(backups.exportFor('a').timeBlocks).toEqual(saved.timeBlocks);
    const invalid = saved.timeBlocks.map(block => block.kind === 'actual' ? { ...block, sourcePlanId: block.id } : block);
    expect(() => backups.importFor('a', { mode: 'replace', data: { ...saved, timeBlocks: invalid } })).toThrow();
    expect(backups.exportFor('a').timeBlocks).toEqual(saved.timeBlocks);
  });

  it('rejects foreign IDs before replace, and stamps accepted data with the current user', () => {
    backups.importFor('a', { mode: 'replace', data: fixture() });
    expect(() => backups.importFor('b', { mode: 'replace', data: fixture() })).toThrow('Invalid goals id');
    const todo = { ...fixture().todos[0], id: 'b-todo', parentGoalId: null, projectId: null, userId: 'spoofed' };
    backups.importFor('b', { mode: 'replace', data: { todos: [todo] } });
    expect(backups.exportFor('b').todos[0].userId).toBe('b');
    expect(() => backups.importFor('b', { mode: 'replace', data: { todos: [{ ...todo, parentGoalId: 'missing' }] } })).toThrow('Invalid reference');
    expect(backups.exportFor('b').todos).toHaveLength(1);
    expect(backups.exportFor('a').todos).toHaveLength(1);
  });

  it('rolls back deletes and preceding inserts when a later write fails', () => {
    backups.importFor('a', { mode: 'replace', data: fixture() });
    const before = backups.exportFor('a');
    connection.get().run(sql`CREATE TRIGGER fail_import BEFORE INSERT ON books BEGIN SELECT RAISE(ABORT, 'write failure'); END`);
    expect(() => backups.importFor('a', { mode: 'replace', data: fixture() })).toThrow();
    expect(backups.exportFor('a')).toEqual(before);
  });

  it('retains settings absent from replace and treats merge counts as submitted rows', () => {
    backups.importFor('a', { mode: 'replace', data: fixture() });
    expect(backups.importFor('a', { mode: 'merge', data: fixture() }).counts.todos).toBe(1);
    expect(backups.exportFor('a').todos).toHaveLength(1);
    backups.importFor('a', { mode: 'replace', data: {} });
    expect(backups.exportFor('a').settings?.theme).toBe('dark');
    expect(backups.exportFor('a').todos).toHaveLength(0);
  });

  it('settings updates validate the merged interval, default financeCycleStartDay on legacy backups, and preserve other accounts', () => {
    const mine = new SettingsRepository(connection.get(), 'a');
    const other = new SettingsRepository(connection.get(), 'b');
    expect(mine.get()).toEqual(DEFAULT_SETTINGS);
    expect(backups.exportFor('a').settings).toBeNull();
    mine.update({ dayStartHour: 12, theme: 'dark' });
    expect(() => mine.update({ dayEndHour: 10 })).toThrow('dayStartHour');
    expect(mine.get().dayEndHour).toBe(23);
    expect(mine.get().financeCycleStartDay).toBe(1);
    expect(other.get()).toEqual(DEFAULT_SETTINGS);

    const legacySettings = { firstDayOfWeek: 'sun', gridMinutes: 60, dayStartHour: 8, dayEndHour: 22, theme: 'dark' };
    backups.importFor('a', { mode: 'replace', data: { settings: legacySettings } });
    expect(backups.exportFor('a').settings).toEqual({ ...legacySettings, financeCycleStartDay: 1 });

    backups.importFor('a', {
      mode: 'replace',
      data: { ...fixture(), settings: { ...DEFAULT_SETTINGS, financeCycleStartDay: 25 } },
    });
    expect(backups.exportFor('a').settings?.financeCycleStartDay).toBe(25);
  });
});
