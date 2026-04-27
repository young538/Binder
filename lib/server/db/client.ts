import 'server-only';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import fs from 'node:fs';
import * as schema from './schema';
import { ulid } from 'ulid';

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'binder.sqlite');
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

const ensureSeed = (db: ReturnType<typeof drizzle<typeof schema>>) => {
  const existing = db.select().from(schema.categories).all();
  if (existing.length > 0) return;
  const rows = DEFAULT_CATEGORIES.map((c, i) => ({ id: ulid(), order: i, ...c }));
  db.insert(schema.categories).values(rows).run();
};

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: Database.Database | null = null;

export const getDb = () => {
  if (_db) return _db;
  ensureDir(DB_PATH);
  _sqlite = new Database(DB_PATH);
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
