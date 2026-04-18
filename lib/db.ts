import Dexie, { Table } from 'dexie';
import { Goal, TimeBlock, Category, Retrospective, Settings, Todo, AnnualGoal, Habit, HabitLog, Routine, Book } from './types';

export interface SyncMeta {
  key: 'main';
  dirty: boolean;
  lastSyncedAt: string | null;
  deviceId: string;
}

export interface AuthToken {
  key: 'google';
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface Snapshot {
  id: string;
  createdAt: string;
  data: string;
}

export interface FocusNoteRow {
  id: string;
  scope: 'year' | 'month' | 'week';
  scopeKey: string;
  text: string;
  updatedAt: string;
}

class BinderDb extends Dexie {
  goals!: Table<Goal, string>;
  categories!: Table<Category, string>;
  timeBlocks!: Table<TimeBlock, string>;
  retrospectives!: Table<Retrospective, string>;
  settings!: Table<Settings & { key: 'main' }, 'main'>;
  syncMeta!: Table<SyncMeta, 'main'>;
  authTokens!: Table<AuthToken, 'google'>;
  snapshots!: Table<Snapshot, string>;
  todos!: Table<Todo, string>;
  focusNotes!: Table<FocusNoteRow, string>;
  annualGoals!: Table<AnnualGoal, string>;
  habits!: Table<Habit, string>;
  habitLogs!: Table<HabitLog, string>;
  routines!: Table<Routine, string>;
  books!: Table<Book, string>;

  constructor() {
    super('BinderDb');
    this.version(1).stores({
      goals: 'id, parentId, level, order',
      categories: 'id, order',
      timeBlocks: 'id, date, categoryId, goalId',
      retrospectives: 'id, type, dateOrWeek, [type+dateOrWeek]',
      settings: 'key',
      syncMeta: 'key',
      authTokens: 'key',
      snapshots: 'id, createdAt',
    });
    this.version(2).stores({
      goals: 'id, parentId, level, order',
      categories: 'id, order',
      timeBlocks: 'id, date, categoryId, goalId, todoId',
      retrospectives: 'id, type, dateOrWeek, [type+dateOrWeek]',
      settings: 'key',
      syncMeta: 'key',
      authTokens: 'key',
      snapshots: 'id, createdAt',
      todos: 'id, period, periodKey, parentGoalId, done, order, [period+periodKey], [period+periodKey+parentGoalId]',
      focusNotes: 'id, scope, scopeKey, [scope+scopeKey]',
    }).upgrade(async tx => {
      await tx.table('goals').toCollection().modify((g: { level?: string }) => {
        if (g.level !== 'oneThing' && g.level !== 'mandalartCore' && g.level !== 'mandalartSub') {
          g.level = 'mandalartSub';
        }
      });
    });
    this.version(3).stores({
      goals: 'id, parentId, level, order',
      categories: 'id, order',
      timeBlocks: 'id, date, categoryId, goalId, todoId',
      retrospectives: 'id, type, dateOrWeek, [type+dateOrWeek]',
      settings: 'key',
      syncMeta: 'key',
      authTokens: 'key',
      snapshots: 'id, createdAt',
      todos: 'id, date, parentGoalId, categoryId, done, order, [date+order]',
      focusNotes: 'id, scope, scopeKey, [scope+scopeKey]',
    }).upgrade(async tx => {
      await tx.table('todos').toCollection().modify((t: {
        period?: string;
        periodKey?: string;
        date?: string;
      }) => {
        if (t.date) return;
        if (t.periodKey) {
          if (t.periodKey.startsWith('month:')) {
            const yyyymm = t.periodKey.slice(6);
            t.date = `${yyyymm}-01`;
          } else if (t.periodKey.startsWith('week:')) {
            const m = t.periodKey.match(/^week:(\d{4})-W(\d{2})$/);
            if (m) {
              const [, y, w] = m;
              const jan4 = new Date(Date.UTC(Number(y), 0, 4));
              const dayOffset = (jan4.getUTCDay() + 6) % 7;
              const mondayWeek1 = new Date(jan4.getTime() - dayOffset * 86400000);
              const monday = new Date(mondayWeek1.getTime() + (Number(w) - 1) * 7 * 86400000);
              const yyyy = monday.getUTCFullYear();
              const mm = String(monday.getUTCMonth() + 1).padStart(2, '0');
              const dd = String(monday.getUTCDate()).padStart(2, '0');
              t.date = `${yyyy}-${mm}-${dd}`;
            } else {
              t.date = '2026-01-01';
            }
          } else {
            t.date = '2026-01-01';
          }
        } else {
          t.date = '2026-01-01';
        }
        delete t.period;
        delete t.periodKey;
      });
    });
    this.version(4).stores({
      goals: 'id, parentId, level, order',
      categories: 'id, order',
      timeBlocks: 'id, date, categoryId, goalId, todoId',
      retrospectives: 'id, type, dateOrWeek, [type+dateOrWeek]',
      settings: 'key',
      syncMeta: 'key',
      authTokens: 'key',
      snapshots: 'id, createdAt',
      todos: 'id, scope, scopeKey, parentGoalId, categoryId, done, order, [scope+scopeKey]',
      focusNotes: 'id, scope, scopeKey, [scope+scopeKey]',
    }).upgrade(async tx => {
      await tx.table('todos').toCollection().modify((t: {
        date?: string;
        scope?: string;
        scopeKey?: string;
      }) => {
        if (t.scope) return;
        t.scope = 'day';
        t.scopeKey = t.date ?? '2026-01-01';
        delete t.date;
      });
    });
    this.version(5).stores({
      goals: 'id, parentId, level, order',
      categories: 'id, order',
      timeBlocks: 'id, date, categoryId, goalId, todoId',
      retrospectives: 'id, type, dateOrWeek, [type+dateOrWeek]',
      settings: 'key',
      syncMeta: 'key',
      authTokens: 'key',
      snapshots: 'id, createdAt',
      todos: 'id, scope, scopeKey, parentGoalId, categoryId, done, order, [scope+scopeKey]',
      focusNotes: 'id, scope, scopeKey, [scope+scopeKey]',
      annualGoals: 'id, year, order',
    });
    this.version(6).stores({
      goals: 'id, parentId, level, order',
      categories: 'id, order',
      timeBlocks: 'id, date, categoryId, goalId, todoId',
      retrospectives: 'id, type, dateOrWeek, [type+dateOrWeek]',
      settings: 'key',
      syncMeta: 'key',
      authTokens: 'key',
      snapshots: 'id, createdAt',
      todos: 'id, scope, scopeKey, parentGoalId, categoryId, done, order, [scope+scopeKey]',
      focusNotes: 'id, scope, scopeKey, [scope+scopeKey]',
      annualGoals: 'id, year, order',
      habits: 'id, order',
      habitLogs: 'id, habitId, date, [habitId+date]',
    });
    this.version(7).stores({
      goals: 'id, parentId, level, order',
      categories: 'id, order',
      timeBlocks: 'id, date, categoryId, goalId, todoId',
      retrospectives: 'id, type, dateOrWeek, [type+dateOrWeek]',
      settings: 'key',
      syncMeta: 'key',
      authTokens: 'key',
      snapshots: 'id, createdAt',
      todos: 'id, scope, scopeKey, parentGoalId, categoryId, done, order, [scope+scopeKey]',
      focusNotes: 'id, scope, scopeKey, [scope+scopeKey]',
      annualGoals: 'id, year, order',
      habits: 'id, order',
      habitLogs: 'id, habitId, date, [habitId+date]',
      routines: 'id, dayOfWeek, order',
    });
    this.version(8).stores({
      goals: 'id, parentId, level, order',
      categories: 'id, order',
      timeBlocks: 'id, date, categoryId, goalId, todoId',
      retrospectives: 'id, type, dateOrWeek, [type+dateOrWeek]',
      settings: 'key',
      syncMeta: 'key',
      authTokens: 'key',
      snapshots: 'id, createdAt',
      todos: 'id, scope, scopeKey, parentGoalId, categoryId, done, order, [scope+scopeKey]',
      focusNotes: 'id, scope, scopeKey, [scope+scopeKey]',
      annualGoals: 'id, year, order',
      habits: 'id, order',
      habitLogs: 'id, habitId, date, [habitId+date]',
      routines: 'id, dayOfWeek, order',
      books: 'id, year, order, finishedAt',
    });
    this.version(9).stores({
      goals: 'id, parentId, level, order',
      categories: 'id, order',
      timeBlocks: 'id, date, categoryId, goalId, todoId',
      retrospectives: 'id, type, dateOrWeek, [type+dateOrWeek]',
      settings: 'key',
      syncMeta: 'key',
      authTokens: 'key',
      snapshots: 'id, createdAt',
      todos: 'id, scope, scopeKey, parentGoalId, categoryId, status, order, [scope+scopeKey]',
      focusNotes: 'id, scope, scopeKey, [scope+scopeKey]',
      annualGoals: 'id, year, order',
      habits: 'id, order',
      habitLogs: 'id, habitId, date, [habitId+date]',
      routines: 'id, dayOfWeek, order',
      books: 'id, year, order, finishedAt',
    }).upgrade(async tx => {
      await tx.table('todos').toCollection().modify((t: { done?: boolean; status?: string }) => {
        if (t.status) return;
        t.status = t.done === true ? 'done' : 'pending';
        delete t.done;
      });
    });
  }
}

export const db = new BinderDb();

const dirtyListeners: (() => void)[] = [];

export const onDirty = (fn: () => void) => {
  dirtyListeners.push(fn);
  return () => {
    const idx = dirtyListeners.indexOf(fn);
    if (idx >= 0) dirtyListeners.splice(idx, 1);
  };
};

export const markDirty = async () => {
  const existing = await db.syncMeta.get('main');
  await db.syncMeta.put({
    key: 'main',
    dirty: true,
    lastSyncedAt: existing?.lastSyncedAt ?? null,
    deviceId: existing?.deviceId ?? crypto.randomUUID(),
  });
  dirtyListeners.forEach(fn => fn());
};
