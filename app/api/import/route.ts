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

  let body: ImportBody;
  try {
    body = (await req.json()) as ImportBody;
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 본문' }, { status: 400 });
  }
  const { mode, data } = body;
  if (!mode || !data) {
    return NextResponse.json({ error: 'mode and data required' }, { status: 400 });
  }
  const db = getDb();
  const uid = session.userId;

  // 모든 변경을 단일 트랜잭션으로 묶음 — 중간 실패 시 전체 rollback,
  // "반쯤 삭제된" 데이터 손실을 방지한다 (better-sqlite3 의 transaction 은 sync).
  const counts: Record<string, number> = {};
  try {
    db.transaction((tx) => {
      if (mode === 'replace') {
        tx.delete(habitLogs).where(eq(habitLogs.userId, uid)).run();
        tx.delete(habits).where(eq(habits.userId, uid)).run();
        tx.delete(annualGoals).where(eq(annualGoals.userId, uid)).run();
        tx.delete(todos).where(eq(todos.userId, uid)).run();
        tx.delete(focusNotes).where(eq(focusNotes.userId, uid)).run();
        tx.delete(retrospectives).where(eq(retrospectives.userId, uid)).run();
        tx.delete(timeBlocks).where(eq(timeBlocks.userId, uid)).run();
        tx.delete(books).where(eq(books.userId, uid)).run();
        tx.delete(categories).where(eq(categories.userId, uid)).run();
        tx.delete(goals).where(eq(goals.userId, uid)).run();
      }

      if (data.goals?.length) {
        const rows = stamp(data.goals, uid);
        tx.insert(goals).values(rows as never[]).onConflictDoNothing().run();
        counts.goals = rows.length;
      }
      if (data.categories?.length) {
        const rows = stamp(data.categories, uid);
        tx.insert(categories).values(rows as never[]).onConflictDoNothing().run();
        counts.categories = rows.length;
      }
      if (data.timeBlocks?.length) {
        const rows = stamp(data.timeBlocks, uid);
        tx.insert(timeBlocks).values(rows as never[]).onConflictDoNothing().run();
        counts.timeBlocks = rows.length;
      }
      if (data.retrospectives?.length) {
        const rows = stamp(data.retrospectives, uid);
        tx.insert(retrospectives).values(rows as never[]).onConflictDoNothing().run();
        counts.retrospectives = rows.length;
      }
      if (data.todos?.length) {
        const rows = stamp(data.todos, uid);
        tx.insert(todos).values(rows as never[]).onConflictDoNothing().run();
        counts.todos = rows.length;
      }
      if (data.focusNotes?.length) {
        const rows = stamp(data.focusNotes, uid);
        tx.insert(focusNotes).values(rows as never[]).onConflictDoNothing().run();
        counts.focusNotes = rows.length;
      }
      if (data.annualGoals?.length) {
        const rows = stamp(data.annualGoals, uid);
        tx.insert(annualGoals).values(rows as never[]).onConflictDoNothing().run();
        counts.annualGoals = rows.length;
      }
      if (data.habits?.length) {
        const rows = stamp(data.habits, uid);
        tx.insert(habits).values(rows as never[]).onConflictDoNothing().run();
        counts.habits = rows.length;
      }
      if (data.habitLogs?.length) {
        const rows = stamp(data.habitLogs, uid);
        tx.insert(habitLogs).values(rows as never[]).onConflictDoNothing().run();
        counts.habitLogs = rows.length;
      }
      if (data.books?.length) {
        const rows = stamp(data.books, uid);
        tx.insert(books).values(rows as never[]).onConflictDoNothing().run();
        counts.books = rows.length;
      }
      if (data.settings) {
        const row = { ...data.settings, userId: uid };
        tx.insert(settings)
          .values(row as never)
          .onConflictDoUpdate({
            target: settings.userId,
            set: row as never,
          })
          .run();
        counts.settings = 1;
      }
    });
  } catch (err) {
    console.error('[POST /api/import] transaction failed', err);
    return NextResponse.json(
      { error: '가져오기 중 오류가 발생해 모든 변경이 롤백되었습니다' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, mode, counts });
}
