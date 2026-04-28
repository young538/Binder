import 'server-only';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import path from 'node:path';
import fs from 'node:fs';
import * as schema from './schema';
import { ulid } from 'ulid';
import { PENDING_ADMIN_USER_ID } from './constants';

// Re-export for backwards compatibility (tests import from this module).
export { PENDING_ADMIN_USER_ID };

const getDbPath = () => process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'binder.sqlite');
const MIGRATIONS_DIR = path.join(process.cwd(), 'drizzle');

const ensureDir = (filePath: string) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const DEFAULT_CATEGORIES = [
  { name: '주원씽', color: '#f4cccc' },
  { name: '부원씽', color: '#fce5cd' },
  { name: '강의',   color: '#fff2cc' },
  { name: '개인',   color: '#d9ead3' },
  { name: '성장',   color: '#c9daf8' },
  { name: '사람',   color: '#d9d2e9' },
  { name: '재미',   color: '#ead1dc' },
  { name: '낭비',   color: '#d9d9d9' },
];

/**
 * Idempotently seed the 8 default categories for a given user.
 * Early-returns if any category row already exists for that userId.
 * Exported so future code paths (CLI user creation in Task 8, etc.) can call
 * it directly when adding users at runtime.
 */
export const ensureCategoriesForUser = (userId: string) => {
  if (!_db) throw new Error('ensureCategoriesForUser: db not initialized');
  const existing = _db.select().from(schema.categories).where(eq(schema.categories.userId, userId)).get();
  if (existing) return;
  const rows = DEFAULT_CATEGORIES.map((c, i) => ({
    id: ulid(),
    userId,
    order: i,
    ...c,
  }));
  _db.insert(schema.categories).values(rows).run();
};

const ensureSeed = (db: ReturnType<typeof drizzle<typeof schema>>) => {
  // Find the admin user; if none, skip seeding (CLI path will seed users
  // explicitly and call ensureCategoriesForUser per user).
  const adminUsername = process.env.APP_USERNAME ?? 'admin';
  const admin = db.select().from(schema.users).where(eq(schema.users.username, adminUsername)).get();
  if (!admin) return;
  ensureCategoriesForUser(admin.id);
};

const ensureAdminUser = (db: ReturnType<typeof drizzle<typeof schema>>) => {
  const username = process.env.APP_USERNAME ?? 'admin';
  const hash = process.env.APP_PASSWORD_HASH;
  if (!hash) return; // no env-based admin; runtime expects an existing user

  const existing = db.select().from(schema.users).where(eq(schema.users.username, username)).get();
  if (existing) return;

  const now = new Date().toISOString();
  db.insert(schema.users).values({
    id: ulid(),
    username,
    passwordHash: hash,
    createdAt: now,
    updatedAt: now,
  }).run();
};

const DOMAIN_TABLES = [
  'goals', 'categories', 'todos', 'focus_notes',
  'annual_goals', 'habits', 'habit_logs', 'books',
  'retrospectives', 'time_blocks', 'settings',
] as const;

const backfillUserId = (db: ReturnType<typeof drizzle<typeof schema>>) => {
  const adminUsername = process.env.APP_USERNAME ?? 'admin';
  const admin = db.select().from(schema.users).where(eq(schema.users.username, adminUsername)).get();
  if (!admin) return; // no admin → leave sentinel rows in place; they'll be claimed when an admin is created

  // Migration 0003 added user_id NOT NULL DEFAULT 'pending-admin' so existing
  // rows on a populated DB get a placeholder value. Swap the placeholder to
  // the real admin ULID here.
  if (!_sqlite) throw new Error('backfillUserId: sqlite handle missing');
  for (const t of DOMAIN_TABLES) {
    _sqlite.prepare(`UPDATE ${t} SET user_id = ? WHERE user_id = ?`).run(admin.id, PENDING_ADMIN_USER_ID);
  }
};

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: Database.Database | null = null;

export const getDb = () => {
  if (_db) return _db;
  const dbPath = getDbPath();
  ensureDir(dbPath);
  _sqlite = new Database(dbPath);
  _sqlite.pragma('journal_mode = WAL');
  _sqlite.pragma('foreign_keys = ON');
  _db = drizzle(_sqlite, { schema });

  if (fs.existsSync(MIGRATIONS_DIR)) {
    try {
      migrate(_db, { migrationsFolder: MIGRATIONS_DIR });
    } catch (err) {
      console.error('Migration failed:', err);
      throw err;
    }
  }

  ensureAdminUser(_db);
  backfillUserId(_db);
  ensureSeed(_db);

  return _db;
};

export const closeDb = () => {
  if (_sqlite) {
    _sqlite.close();
    _sqlite = null;
    _db = null;
  }
};

export { schema };
