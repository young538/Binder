import { NextResponse } from 'next/server';
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
  const db = getDb();
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
    db.select().from(goals).all(),
    db.select().from(categories).all(),
    db.select().from(timeBlocks).all(),
    db.select().from(retrospectives).all(),
    db.select().from(todos).all(),
    db.select().from(focusNotes).all(),
    db.select().from(annualGoals).all(),
    db.select().from(habits).all(),
    db.select().from(habitLogs).all(),
    db.select().from(books).all(),
    db.select().from(settings).get(),
  ]);

  let settingsOut = null;
  if (settingsRow) {
    const { key: _k, ...rest } = settingsRow;
    void _k;
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
