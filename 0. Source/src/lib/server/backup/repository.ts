import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import type { BackupCollection, ImportMode } from '@/lib/backup';
import { ValidationError } from '@/lib/validation/mutations';
import { usedByPen } from '@/lib/injections';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import type { DatabaseSession } from '../db/connection';
import * as schema from '../db/schema';
import { actualAdjustments, automaticMonthlyActuals, preserveAnnualActualBaseline, projectAnnualGoal, syncAnnualTargets } from '../repos/annualGoalAggregates';

const tables = {
  goals: schema.goals, categories: schema.categories, projects: schema.projects,
  injectionPens: schema.injectionPens, injectionEntries: schema.injectionEntries,
  people: schema.people, metrics: schema.metrics, metricEntries: schema.metricEntries,
  dailyCheckins: schema.dailyCheckins, notes: schema.binderNotes, lifeEvents: schema.lifeEvents,
  subscriptions: schema.subscriptions, financeTransactions: schema.financeTransactions, financeBudgets: schema.financeBudgets,
  timeBlocks: schema.timeBlocks, retrospectives: schema.retrospectives, todos: schema.todos,
  focusNotes: schema.focusNotes, annualGoals: schema.annualGoals, habits: schema.habits,
  habitLogs: schema.habitLogs, books: schema.books, weeklyTemplates: schema.weeklyTemplates,
} satisfies Record<BackupCollection, unknown>;

export interface BackupLookup {
  recoveryCategoryId(): string | undefined;
  ownerOf(collection: BackupCollection, id: string): string | undefined;
}

/** All backup SQL is scoped to one user and the supplied transaction. */
export class UserBackupRepository implements BackupLookup {
  constructor(private readonly db: DatabaseSession, private readonly userId: string) {}

  ownerOf(collection: BackupCollection, id: string): string | undefined {
    const table = tables[collection];
    return this.db.select({ userId: table.userId }).from(table).where(eq(table.id, id)).get()?.userId;
  }

  recoveryCategoryId(): string | undefined {
    const { categories } = schema;
    return this.db.select({ id: categories.id }).from(categories)
      .where(and(eq(categories.userId, this.userId), eq(categories.name, '기타')))
      .orderBy(asc(categories.order), asc(categories.id)).get()?.id;
  }

  private list<K extends BackupCollection>(collection: K): (typeof tables)[K]['$inferSelect'][] {
    const table = tables[collection];
    // Drizzle loses the key/row correlation when selecting a mapped table.
    return this.db.select().from(table).where(eq(table.userId, this.userId)).all() as (typeof tables)[K]['$inferSelect'][];
  }

  exportData() {
    const settings = this.db.select().from(schema.settings).where(eq(schema.settings.userId, this.userId)).get();
    const todos = this.list('todos');
    const todoIds = new Set(todos.map(todo => todo.id));
    const timeBlocks = this.list('timeBlocks').map(block =>
      block.todoId && !todoIds.has(block.todoId) ? { ...block, todoId: null } : block);
    const settingsOut = settings ? {
      firstDayOfWeek: settings.firstDayOfWeek, gridMinutes: settings.gridMinutes,
      dayStartHour: settings.dayStartHour, dayEndHour: settings.dayEndHour, theme: settings.theme,
      financeCycleStartDay: settings.financeCycleStartDay ?? DEFAULT_SETTINGS.financeCycleStartDay,
    } : null;
    return {
      goals: this.list('goals'), categories: this.list('categories'), projects: this.list('projects'),
      injectionPens: this.list('injectionPens'), injectionEntries: this.list('injectionEntries'),
      people: this.list('people'), metrics: this.list('metrics'), metricEntries: this.list('metricEntries'),
      dailyCheckins: this.list('dailyCheckins'), notes: this.list('notes'), lifeEvents: this.list('lifeEvents'),
      subscriptions: this.list('subscriptions'),
      financeTransactions: this.list('financeTransactions'),
      financeBudgets: this.list('financeBudgets'),
      timeBlocks, retrospectives: this.list('retrospectives'),
      todos, focusNotes: this.list('focusNotes'),
      annualGoals: this.list('annualGoals').map(goal => ({
        ...projectAnnualGoal(this.db, goal),
        monthlyActualAdjustments: actualAdjustments(goal, automaticMonthlyActuals(this.db, goal)),
      })),
      habits: this.list('habits'), habitLogs: this.list('habitLogs'), books: this.list('books'),
      weeklyTemplates: this.list('weeklyTemplates'),
      settings: settingsOut,
    };
  }

  clear(): void {
    // Do not let undo restore rows removed by a later full replacement.
    this.db.delete(schema.todoTrash).where(eq(schema.todoTrash.userId, this.userId)).run();
    const order: BackupCollection[] = [
      'injectionEntries', 'injectionPens', 'metricEntries', 'metrics', 'financeTransactions', 'financeBudgets', 'lifeEvents', 'subscriptions', 'people', 'notes', 'dailyCheckins',
      'habitLogs', 'habits', 'annualGoals', 'todos', 'projects', 'focusNotes',
      'retrospectives', 'timeBlocks', 'books', 'weeklyTemplates', 'categories', 'goals',
    ];
    for (const name of order) {
      const table = tables[name];
      this.db.delete(table).where(eq(table.userId, this.userId)).run();
    }
  }

  insert(collection: BackupCollection, rows: Record<string, unknown>[], mode: ImportMode): void {
    const table = tables[collection];
    // Called only after complete runtime validation, including cross-user ID checks.
    const incoming = collection === 'todos' && rows.some(row => row.googleTaskId) ? this.prepareImportedTodos(rows) : rows;
    const batchSize = 100;
    for (let offset = 0; offset < incoming.length; offset += batchSize) {
      const batch = incoming.slice(offset, offset + batchSize);
      const values = batch.map(row => ({ ...row, userId: this.userId })) as typeof table.$inferInsert[];
      const insert = this.db.insert(table).values(values);
      if (mode === 'merge') {
        insert.onConflictDoNothing(collection === 'timeBlocks' ? { target: table.id } : undefined).run();
        continue;
      }

      const inserted = insert.onConflictDoNothing().returning({ id: table.id }).all();
      if (inserted.length !== batch.length) {
        const ids = new Set(inserted.map(row => row.id));
        const index = batch.findIndex(row => !ids.has(String(row.id)));
        const date = batch[index].date;
        const location = `${collection} ${offset + index + 1}번째 기록${date ? ` (${date})` : ''}`;
        throw new ValidationError(`${location}이 중복되어 덮어쓰기를 취소했습니다.`);
      }
    }
  }

  checkInjectionInventory(imported: Record<string, unknown>[]): void {
    const incoming = new Map(imported.map(pen => [pen.id, pen]));
    const used = usedByPen(this.list('injectionEntries'));
    for (const pen of this.list('injectionPens')) {
      const source = incoming.get(pen.id);
      if (source && (source.isExample ?? false) !== pen.isExample) throw new ValidationError('예시와 내 기록의 펜 ID가 충돌합니다.');
      if (source && source.drug !== pen.drug) throw new ValidationError('같은 펜 ID에 서로 다른 약물이 지정됐습니다.');
      if ((used.get(pen.id) ?? 0) > pen.capacityMcg) throw new ValidationError('주사 기록 합계가 펜 총량을 초과합니다.');
    }
  }

  checkPlanLinks(): void {
    const blocks = this.list('timeBlocks');
    const plans = new Map(blocks.filter(block => block.kind === 'plan').map(plan => [plan.id, plan.date]));
    for (const actual of blocks) {
      if (actual.sourcePlanId && (actual.kind !== 'actual' || plans.get(actual.sourcePlanId) !== actual.date)) {
        throw new ValidationError('Invalid reference: timeBlocks.sourcePlanId');
      }
    }
  }

  private prepareImportedTodos(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    const current = this.db.select({
      id: schema.todos.id, list: schema.todos.googleTaskListId, task: schema.todos.googleTaskId,
    }).from(schema.todos).where(eq(schema.todos.userId, this.userId)).all();
    const existingIds = new Set(current.map(row => row.id));
    const links = new Set(current.filter(row => row.list && row.task).map(row => JSON.stringify([row.list, row.task])));
    // Older exports can include the same remote identifier on a generated occurrence.
    const ordered = [...rows].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) ||
      String(a.id).localeCompare(String(b.id)));
    return ordered.map(row => {
      if (existingIds.has(String(row.id)) || !row.googleTaskListId || !row.googleTaskId) return row;
      const key = JSON.stringify([row.googleTaskListId, row.googleTaskId]);
      if (links.has(key)) return { ...row, googleTaskId: null, googleTaskListId: null, googleTaskUpdatedAt: null };
      links.add(key);
      return row;
    });
  }

  saveSettings(values: Record<string, unknown>): void {
    const row = { ...DEFAULT_SETTINGS, ...values, userId: this.userId } as typeof schema.settings.$inferInsert;
    this.db.insert(schema.settings).values(row)
      .onConflictDoUpdate({ target: schema.settings.userId, set: row }).run();
  }

  preserveActuals(): void {
    for (const goal of this.list('annualGoals')) preserveAnnualActualBaseline(this.db, this.userId, goal.id);
  }

  reconcileAnnualGoals(): void {
    const linked = new Set(this.list('habits').map(habit => habit.annualGoalId));
    for (const goal of this.list('annualGoals')) {
      preserveAnnualActualBaseline(this.db, this.userId, goal.id);
      if (linked.has(goal.id)) syncAnnualTargets(this.db, this.userId, goal.id);
    }
  }
}
