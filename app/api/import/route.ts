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

interface ImportBody {
  mode: 'merge' | 'replace';
  data: {
    goals?: unknown[];
    categories?: unknown[];
    timeBlocks?: unknown[];
    retrospectives?: unknown[];
    todos?: unknown[];
    focusNotes?: unknown[];
    annualGoals?: unknown[];
    habits?: unknown[];
    habitLogs?: unknown[];
    books?: unknown[];
    settings?: Record<string, unknown> | null;
  };
}

export async function POST(req: Request) {
  const body = (await req.json()) as ImportBody;
  const { mode, data } = body;
  if (!mode || !data) {
    return NextResponse.json({ error: 'mode and data required' }, { status: 400 });
  }
  const db = getDb();

  if (mode === 'replace') {
    await db.delete(habitLogs).run();
    await db.delete(habits).run();
    await db.delete(annualGoals).run();
    await db.delete(todos).run();
    await db.delete(focusNotes).run();
    await db.delete(retrospectives).run();
    await db.delete(timeBlocks).run();
    await db.delete(books).run();
    await db.delete(categories).run();
    await db.delete(goals).run();
  }

  const counts: Record<string, number> = {};
  if (data.goals?.length) {
    await db.insert(goals).values(data.goals as never[]).onConflictDoNothing().run();
    counts.goals = data.goals.length;
  }
  if (data.categories?.length) {
    await db.insert(categories).values(data.categories as never[]).onConflictDoNothing().run();
    counts.categories = data.categories.length;
  }
  if (data.timeBlocks?.length) {
    await db.insert(timeBlocks).values(data.timeBlocks as never[]).onConflictDoNothing().run();
    counts.timeBlocks = data.timeBlocks.length;
  }
  if (data.retrospectives?.length) {
    await db.insert(retrospectives).values(data.retrospectives as never[]).onConflictDoNothing().run();
    counts.retrospectives = data.retrospectives.length;
  }
  if (data.todos?.length) {
    await db.insert(todos).values(data.todos as never[]).onConflictDoNothing().run();
    counts.todos = data.todos.length;
  }
  if (data.focusNotes?.length) {
    await db.insert(focusNotes).values(data.focusNotes as never[]).onConflictDoNothing().run();
    counts.focusNotes = data.focusNotes.length;
  }
  if (data.annualGoals?.length) {
    await db.insert(annualGoals).values(data.annualGoals as never[]).onConflictDoNothing().run();
    counts.annualGoals = data.annualGoals.length;
  }
  if (data.habits?.length) {
    await db.insert(habits).values(data.habits as never[]).onConflictDoNothing().run();
    counts.habits = data.habits.length;
  }
  if (data.habitLogs?.length) {
    await db.insert(habitLogs).values(data.habitLogs as never[]).onConflictDoNothing().run();
    counts.habitLogs = data.habitLogs.length;
  }
  if (data.books?.length) {
    await db.insert(books).values(data.books as never[]).onConflictDoNothing().run();
    counts.books = data.books.length;
  }
  if (data.settings) {
    await db
      .insert(settings)
      .values(data.settings as never)
      .onConflictDoUpdate({
        target: settings.userId,
        set: data.settings as never,
      })
      .run();
    counts.settings = 1;
  }

  return NextResponse.json({ ok: true, mode, counts });
}
