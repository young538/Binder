// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { BACKUP_COLLECTIONS } from '@/lib/backup';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { DatabaseConnection } from '@/lib/server/db/connection';
import { BackupService } from '@/lib/server/backup/service';
import { SettingsRepository } from '@/lib/server/repos/settings';

let connection: DatabaseConnection;
let backups: BackupService;
const now = '2026-10-29T00:00:00.000Z';
const times = { createdAt: now, updatedAt: now };
const fixture = () => ({
  goals: [{ id: 'goal', title: '목표', level: 'oneThing', order: 0, ...times }],
  categories: [{ id: 'category', name: '분류', color: '#123456', order: 0 }],
  timeBlocks: [{ id: 'time', date: '2026-10-29', startMin: 540, endMin: 600, text: '계획', kind: 'plan', categoryId: 'category', todoId: 'todo', ...times }],
  retrospectives: [{ id: 'retro', type: 'daily', dateOrWeek: '2026-10-29', template: { good: '기록' }, ...times }],
  todos: [{ id: 'todo', title: '할 일', scope: 'day', scopeKey: '2026-10-29', status: 'pending', order: 0, parentGoalId: 'goal', ...times }],
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
  it('round-trips all eleven collections and preserves annual baselines and settings', () => {
    const imported = backups.importFor('a', { mode: 'replace', data: fixture() });
    for (const name of BACKUP_COLLECTIONS) expect(imported.counts[name]).toBe(1);
    const first = backups.exportFor('a');
    expect(first.version).toBe(11);
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

  it('rejects foreign IDs before replace, and stamps accepted data with the current user', () => {
    backups.importFor('a', { mode: 'replace', data: fixture() });
    expect(() => backups.importFor('b', { mode: 'replace', data: fixture() })).toThrow('Invalid goals id');
    const todo = { ...fixture().todos[0], id: 'b-todo', parentGoalId: null, userId: 'spoofed' };
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

  it('settings updates validate the merged interval and preserve other accounts', () => {
    const mine = new SettingsRepository(connection.get(), 'a');
    const other = new SettingsRepository(connection.get(), 'b');
    expect(mine.get()).toEqual(DEFAULT_SETTINGS);
    expect(backups.exportFor('a').settings).toBeNull();
    mine.update({ dayStartHour: 12, theme: 'dark' });
    expect(() => mine.update({ dayEndHour: 10 })).toThrow('dayStartHour');
    expect(mine.get().dayEndHour).toBe(23);
    expect(other.get()).toEqual(DEFAULT_SETTINGS);
  });
});
