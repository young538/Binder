import 'server-only';
import { and, asc, between, eq } from 'drizzle-orm';
import { addDays, parseISO } from 'date-fns';
import type { BinderDatabase } from '../db/connection';
import * as schema from '../db/schema';
import type { Goal, Habit, HabitLog, TimeBlock, Todo } from '@/lib/types';
import { parseReadingEntry, type BookHistory } from '@/lib/reading';
import { reviewGoals } from '@/lib/planning/insights';
import { toIsoDate } from '@/lib/utils/date';
import { DomainError } from '../errors';

export class InsightsRepository {
  constructor(private readonly db: BinderDatabase, private readonly userId: string) {}

  bookHistory(id: string): BookHistory {
    const book = this.db.select().from(schema.books).where(and(eq(schema.books.id, id), eq(schema.books.userId, this.userId))).get();
    if (!book) throw new DomainError('책을 찾을 수 없습니다.', 404);
    const rows = this.db.select({ date: schema.retrospectives.dateOrWeek, template: schema.retrospectives.template })
      .from(schema.retrospectives).where(and(eq(schema.retrospectives.userId, this.userId), eq(schema.retrospectives.type, 'daily')))
      .orderBy(asc(schema.retrospectives.dateOrWeek)).all();
    const entries = rows.map(row => ({ ...parseReadingEntry(row.template.reading, 0), date: row.date })).filter(entry => entry.bookId === id);
    return { bookId: id, title: book.title, entries, totalPages: entries.reduce((sum, entry) => sum + entry.pages, 0), readingDays: new Set(entries.map(entry => entry.date)).size };
  }

  goalReview(end: string) {
    const start = toIsoDate(addDays(parseISO(end), -13));
    return this.db.transaction(tx => {
      const goals = tx.select().from(schema.goals).where(eq(schema.goals.userId, this.userId)).orderBy(asc(schema.goals.order)).all() as Goal[];
      const todos = tx.select().from(schema.todos).where(eq(schema.todos.userId, this.userId)).all() as Todo[];
      const habits = tx.select().from(schema.habits).where(eq(schema.habits.userId, this.userId)).all() as Habit[];
      const logs = tx.select().from(schema.habitLogs).where(and(eq(schema.habitLogs.userId, this.userId), between(schema.habitLogs.date, start, end))).all() as HabitLog[];
      const blocks = tx.select().from(schema.timeBlocks).where(and(eq(schema.timeBlocks.userId, this.userId), between(schema.timeBlocks.date, start, end))).all() as TimeBlock[];
      return { start, end, goals: reviewGoals(goals, todos, habits, logs, blocks, start, end) };
    });
  }
}
