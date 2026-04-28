import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireSession } from '@/lib/server/auth';
import { getDb } from '@/lib/server/db/client';
import {
  goals,
  categories,
  timeBlocks,
  retrospectives,
  todos,
  focusNotes,
  annualGoals,
  habits,
  habitLogs,
  books,
  settings,
} from '@/lib/server/db/schema';

export async function GET() {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const db = getDb();
  const uid = session.userId;
  const [
    goalsRows,
    categoriesRows,
    timeBlocksRows,
    retrospectivesRows,
    todosRows,
    focusNotesRows,
    annualGoalsRows,
    habitsRows,
    habitLogsRows,
    booksRows,
    settingsRow,
  ] = await Promise.all([
    db.select().from(goals).where(eq(goals.userId, uid)).all(),
    db.select().from(categories).where(eq(categories.userId, uid)).all(),
    db.select().from(timeBlocks).where(eq(timeBlocks.userId, uid)).all(),
    db.select().from(retrospectives).where(eq(retrospectives.userId, uid)).all(),
    db.select().from(todos).where(eq(todos.userId, uid)).all(),
    db.select().from(focusNotes).where(eq(focusNotes.userId, uid)).all(),
    db.select().from(annualGoals).where(eq(annualGoals.userId, uid)).all(),
    db.select().from(habits).where(eq(habits.userId, uid)).all(),
    db.select().from(habitLogs).where(eq(habitLogs.userId, uid)).all(),
    db.select().from(books).where(eq(books.userId, uid)).all(),
    db.select().from(settings).where(eq(settings.userId, uid)).get(),
  ]);

  let settingsOut = null;
  if (settingsRow) {
    const { userId: _u, ...rest } = settingsRow;
    void _u;
    settingsOut = rest;
  }

  return NextResponse.json({
    version: 10,
    generatedAt: new Date().toISOString(),
    goals: goalsRows,
    categories: categoriesRows,
    timeBlocks: timeBlocksRows,
    retrospectives: retrospectivesRows,
    todos: todosRows,
    focusNotes: focusNotesRows,
    annualGoals: annualGoalsRows,
    habits: habitsRows,
    habitLogs: habitLogsRows,
    books: booksRows,
    settings: settingsOut,
  });
}
