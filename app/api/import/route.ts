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

// Force userId on every row, ignoring whatever the import file claims.
// This prevents account-takeover via crafted import files.
const stamp = <T extends object>(rows: unknown[] | undefined, userId: string): T[] =>
  (rows ?? []).map(r => ({ ...(r as object), userId })) as T[];

export async function POST(req: Request) {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const body = (await req.json()) as ImportBody;
  const { mode, data } = body;
  if (!mode || !data) {
    return NextResponse.json({ error: 'mode and data required' }, { status: 400 });
  }
  const db = getDb();
  const uid = session.userId;

  if (mode === 'replace') {
    // Only wipe THIS user's rows — never touch other users' data.
    await db.delete(habitLogs).where(eq(habitLogs.userId, uid)).run();
    await db.delete(habits).where(eq(habits.userId, uid)).run();
    await db.delete(annualGoals).where(eq(annualGoals.userId, uid)).run();
    await db.delete(todos).where(eq(todos.userId, uid)).run();
    await db.delete(focusNotes).where(eq(focusNotes.userId, uid)).run();
    await db.delete(retrospectives).where(eq(retrospectives.userId, uid)).run();
    await db.delete(timeBlocks).where(eq(timeBlocks.userId, uid)).run();
    await db.delete(books).where(eq(books.userId, uid)).run();
    await db.delete(categories).where(eq(categories.userId, uid)).run();
    await db.delete(goals).where(eq(goals.userId, uid)).run();
  }

  const counts: Record<string, number> = {};
  if (data.goals?.length) {
    const rows = stamp(data.goals, uid);
    await db.insert(goals).values(rows as never[]).onConflictDoNothing().run();
    counts.goals = rows.length;
  }
  if (data.categories?.length) {
    const rows = stamp(data.categories, uid);
    await db.insert(categories).values(rows as never[]).onConflictDoNothing().run();
    counts.categories = rows.length;
  }
  if (data.timeBlocks?.length) {
    const rows = stamp(data.timeBlocks, uid);
    await db.insert(timeBlocks).values(rows as never[]).onConflictDoNothing().run();
    counts.timeBlocks = rows.length;
  }
  if (data.retrospectives?.length) {
    const rows = stamp(data.retrospectives, uid);
    await db.insert(retrospectives).values(rows as never[]).onConflictDoNothing().run();
    counts.retrospectives = rows.length;
  }
  if (data.todos?.length) {
    const rows = stamp(data.todos, uid);
    await db.insert(todos).values(rows as never[]).onConflictDoNothing().run();
    counts.todos = rows.length;
  }
  if (data.focusNotes?.length) {
    const rows = stamp(data.focusNotes, uid);
    await db.insert(focusNotes).values(rows as never[]).onConflictDoNothing().run();
    counts.focusNotes = rows.length;
  }
  if (data.annualGoals?.length) {
    const rows = stamp(data.annualGoals, uid);
    await db.insert(annualGoals).values(rows as never[]).onConflictDoNothing().run();
    counts.annualGoals = rows.length;
  }
  if (data.habits?.length) {
    const rows = stamp(data.habits, uid);
    await db.insert(habits).values(rows as never[]).onConflictDoNothing().run();
    counts.habits = rows.length;
  }
  if (data.habitLogs?.length) {
    const rows = stamp(data.habitLogs, uid);
    await db.insert(habitLogs).values(rows as never[]).onConflictDoNothing().run();
    counts.habitLogs = rows.length;
  }
  if (data.books?.length) {
    const rows = stamp(data.books, uid);
    await db.insert(books).values(rows as never[]).onConflictDoNothing().run();
    counts.books = rows.length;
  }
  if (data.settings) {
    const row = { ...data.settings, userId: uid };
    await db
      .insert(settings)
      .values(row as never)
      .onConflictDoUpdate({
        target: settings.userId,
        set: row as never,
      })
      .run();
    counts.settings = 1;
  }

  return NextResponse.json({ ok: true, mode, counts });
}
