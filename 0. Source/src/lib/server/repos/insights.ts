import 'server-only';
import { and, asc, between, eq } from 'drizzle-orm';
import { addDays, parseISO } from 'date-fns';
import type { BinderDatabase } from '../db/connection';
import * as schema from '../db/schema';
import type { Goal, Habit, HabitLog, TimeBlock, Todo } from '@/lib/types';
import {
  normalizeBookTitle,
  parseReadingEntry,
  type BookHistory,
  type BookLinkDailyResult,
  type BookReadingStats,
  type ReadingSummary,
  type UnlinkedReadingGroup,
} from '@/lib/reading';
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

  readingSummary(): ReadingSummary {
    const rows = this.db
      .select({ date: schema.retrospectives.dateOrWeek, template: schema.retrospectives.template })
      .from(schema.retrospectives)
      .where(and(eq(schema.retrospectives.userId, this.userId), eq(schema.retrospectives.type, 'daily')))
      .orderBy(asc(schema.retrospectives.dateOrWeek))
      .all();

    const byBookId: Record<string, BookReadingStats> = {};
    const datesByBookId = new Map<string, Set<string>>();
    const unlinkedMap = new Map<string, {
      normalizedTitle: string;
      title: string;
      rawTitles: Set<string>;
      dates: Set<string>;
      totalPages: number;
      lastReadDate: string;
    }>();

    for (const row of rows) {
      const readingRaw = row.template?.reading;
      if (typeof readingRaw !== 'string' || readingRaw.trim() === '') continue;
      const entry = parseReadingEntry(readingRaw, 0);

      if (entry.bookId) {
        let stats = byBookId[entry.bookId];
        if (!stats) {
          stats = { bookId: entry.bookId, totalPages: 0, readingDays: 0, lastReadDate: null };
          byBookId[entry.bookId] = stats;
        }
        let dateSet = datesByBookId.get(entry.bookId);
        if (!dateSet) {
          dateSet = new Set();
          datesByBookId.set(entry.bookId, dateSet);
        }
        dateSet.add(row.date);
        stats.totalPages += entry.pages;
        stats.readingDays = dateSet.size;
        if (!stats.lastReadDate || row.date > stats.lastReadDate) {
          stats.lastReadDate = row.date;
        }
        continue;
      }

      const trimmedTitle = entry.bookTitle.trim();
      if (!trimmedTitle) continue;
      const normalized = normalizeBookTitle(trimmedTitle);
      if (!normalized) continue;

      let group = unlinkedMap.get(normalized);
      if (!group) {
        group = {
          normalizedTitle: normalized,
          title: trimmedTitle,
          rawTitles: new Set([trimmedTitle]),
          dates: new Set([row.date]),
          totalPages: entry.pages,
          lastReadDate: row.date,
        };
        unlinkedMap.set(normalized, group);
      } else {
        if (row.date >= group.lastReadDate) {
          group.title = trimmedTitle;
          group.lastReadDate = row.date;
        }
        group.rawTitles.add(trimmedTitle);
        group.dates.add(row.date);
        group.totalPages += entry.pages;
      }
    }

    const unlinkedGroups: UnlinkedReadingGroup[] = [...unlinkedMap.values()]
      .map(group => {
        const dates = [...group.dates].sort();
        return {
          normalizedTitle: group.normalizedTitle,
          title: group.title,
          rawTitles: [...group.rawTitles],
          dates,
          totalPages: group.totalPages,
          readingDays: dates.length,
          lastReadDate: group.lastReadDate,
        };
      })
      .sort((a, b) => b.lastReadDate.localeCompare(a.lastReadDate) || a.title.localeCompare(b.title));

    return { byBookId, unlinkedGroups };
  }

  linkDailyReadings(bookId: string, options: { dates?: string[]; matchTitle?: string }): BookLinkDailyResult {
    return this.db.transaction(tx => {
      const book = tx
        .select()
        .from(schema.books)
        .where(and(eq(schema.books.id, bookId), eq(schema.books.userId, this.userId)))
        .get();
      if (!book) throw new DomainError('책을 찾을 수 없습니다.', 404);

      const rows = tx
        .select({
          id: schema.retrospectives.id,
          date: schema.retrospectives.dateOrWeek,
          template: schema.retrospectives.template,
        })
        .from(schema.retrospectives)
        .where(and(eq(schema.retrospectives.userId, this.userId), eq(schema.retrospectives.type, 'daily')))
        .orderBy(asc(schema.retrospectives.dateOrWeek))
        .all();

      const dateSet = new Set(options.dates ?? []);
      const normalizedTarget = options.matchTitle ? normalizeBookTitle(options.matchTitle) : '';
      const now = new Date().toISOString();
      const linkedDates: string[] = [];

      for (const row of rows) {
        const readingRaw = row.template?.reading;
        if (typeof readingRaw !== 'string' || readingRaw.trim() === '') continue;
        const entry = parseReadingEntry(readingRaw, 0);
        if (entry.bookId) continue;

        const matchesDate = dateSet.has(row.date);
        const matchesTitle =
          normalizedTarget !== '' &&
          entry.bookTitle.trim() !== '' &&
          normalizeBookTitle(entry.bookTitle) === normalizedTarget;

        if (!matchesDate && !matchesTitle) continue;

        tx.update(schema.retrospectives)
          .set({
            template: {
              ...row.template,
              reading: JSON.stringify({
                ...entry,
                bookId: book.id,
                bookTitle: book.title.trim() || entry.bookTitle,
              }),
            },
            updatedAt: now,
          })
          .where(and(eq(schema.retrospectives.userId, this.userId), eq(schema.retrospectives.id, row.id)))
          .run();
        linkedDates.push(row.date);
      }

      return {
        bookId: book.id,
        linkedCount: linkedDates.length,
        linkedDates,
      };
    }, { behavior: 'immediate' });
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
