import 'server-only';
import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import type { DatabaseSession } from './connection';
import * as schema from './schema';
import { PENDING_ADMIN_USER_ID } from './constants';

const DEFAULT_CATEGORIES = [
  { name: '주원씽', color: '#f4cccc' },
  { name: '부원씽', color: '#fce5cd' },
  { name: '강의', color: '#fff2cc' },
  { name: '개인', color: '#d9ead3' },
  { name: '성장', color: '#c9daf8' },
  { name: '사람', color: '#d9d2e9' },
  { name: '재미', color: '#ead1dc' },
  { name: '낭비', color: '#d9d9d9' },
];

export function ensureUserCategories(db: DatabaseSession, userId: string): void {
  if (db.select().from(schema.categories).where(eq(schema.categories.userId, userId)).get()) return;
  db.insert(schema.categories).values(DEFAULT_CATEGORIES.map((category, order) => ({
    ...category, id: ulid(), userId, order,
  }))).run();
}

/** Runs inside the connection's initialization transaction. */
export function initializeUsers(
  db: DatabaseSession,
  credentials: { username: string; passwordHash?: string },
): void {
  let admin = db.select().from(schema.users).where(eq(schema.users.username, credentials.username)).get();
  if (!admin && credentials.passwordHash) {
    const now = new Date().toISOString();
    admin = db.insert(schema.users).values({
      id: ulid(), username: credentials.username, passwordHash: credentials.passwordHash,
      createdAt: now, updatedAt: now,
    }).returning().get();
  }
  if (!admin) return;
  const domainTables = [
    schema.goals, schema.categories, schema.todos, schema.focusNotes,
    schema.annualGoals, schema.habits, schema.habitLogs, schema.books,
    schema.retrospectives, schema.timeBlocks, schema.settings,
  ];
  for (const table of domainTables) {
    db.update(table).set({ userId: admin.id }).where(eq(table.userId, PENDING_ADMIN_USER_ID)).run();
  }
  ensureUserCategories(db, admin.id);
}
