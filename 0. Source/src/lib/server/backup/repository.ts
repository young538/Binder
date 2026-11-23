import 'server-only';
import { eq } from 'drizzle-orm';
import type { BackupCollection } from '@/lib/backup';
import type { DatabaseSession } from '../db/connection';
import * as schema from '../db/schema';
import { actualAdjustments, automaticMonthlyActuals, preserveAnnualActualBaseline, projectAnnualGoal, syncAnnualTargets } from '../repos/annualGoalAggregates';

const tables = {
  goals: schema.goals, categories: schema.categories, projects: schema.projects,
  people: schema.people, metrics: schema.metrics, metricEntries: schema.metricEntries,
  dailyCheckins: schema.dailyCheckins, notes: schema.binderNotes, lifeEvents: schema.lifeEvents,
  subscriptions: schema.subscriptions, financeTransactions: schema.financeTransactions, financeBudgets: schema.financeBudgets,
  timeBlocks: schema.timeBlocks, retrospectives: schema.retrospectives, todos: schema.todos,
  focusNotes: schema.focusNotes, annualGoals: schema.annualGoals, habits: schema.habits,
  habitLogs: schema.habitLogs, books: schema.books, weeklyTemplates: schema.weeklyTemplates,
} satisfies Record<BackupCollection, unknown>;

export interface BackupLookup {
  ownerOf(collection: BackupCollection, id: string): string | undefined;
}

/** All backup SQL is scoped to one user and the supplied transaction. */
export class UserBackupRepository implements BackupLookup {
  constructor(private readonly db: DatabaseSession, private readonly userId: string) {}

  ownerOf(collection: BackupCollection, id: string): string | undefined {
    const table = tables[collection];
    return this.db.select({ userId: table.userId }).from(table).where(eq(table.id, id)).get()?.userId;
  }

  private list<K extends BackupCollection>(collection: K): (typeof tables)[K]['$inferSelect'][] {
    const table = tables[collection];
    // Drizzle loses the key/row correlation when selecting a mapped table.
    return this.db.select().from(table).where(eq(table.userId, this.userId)).all() as (typeof tables)[K]['$inferSelect'][];
  }

  exportData() {
    const settings = this.db.select().from(schema.settings).where(eq(schema.settings.userId, this.userId)).get();
    const settingsOut = settings ? {
      firstDayOfWeek: settings.firstDayOfWeek, gridMinutes: settings.gridMinutes,
      dayStartHour: settings.dayStartHour, dayEndHour: settings.dayEndHour, theme: settings.theme,
    } : null;
    return {
      goals: this.list('goals'), categories: this.list('categories'), projects: this.list('projects'),
      people: this.list('people'), metrics: this.list('metrics'), metricEntries: this.list('metricEntries'),
      dailyCheckins: this.list('dailyCheckins'), notes: this.list('notes'), lifeEvents: this.list('lifeEvents'),
      subscriptions: this.list('subscriptions'),
      financeTransactions: this.list('financeTransactions'),
      financeBudgets: this.list('financeBudgets'),
      timeBlocks: this.list('timeBlocks'), retrospectives: this.list('retrospectives'),
      todos: this.list('todos'), focusNotes: this.list('focusNotes'),
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
      'metricEntries', 'metrics', 'financeTransactions', 'financeBudgets', 'lifeEvents', 'subscriptions', 'people', 'notes', 'dailyCheckins',
      'habitLogs', 'habits', 'annualGoals', 'todos', 'projects', 'focusNotes',
      'retrospectives', 'timeBlocks', 'books', 'weeklyTemplates', 'categories', 'goals',
    ];
    for (const name of order) {
      const table = tables[name];
      this.db.delete(table).where(eq(table.userId, this.userId)).run();
    }
  }

  insert(collection: BackupCollection, rows: Record<string, unknown>[]): void {
    const table = tables[collection];
    // Called only after complete runtime validation, including cross-user ID checks.
    const stamped = rows.map(row => ({ ...row, userId: this.userId }));
    this.db.insert(table).values(stamped as typeof table.$inferInsert[]).onConflictDoNothing().run();
  }

  saveSettings(values: Record<string, unknown>): void {
    const row = { ...values, userId: this.userId } as typeof schema.settings.$inferInsert;
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
