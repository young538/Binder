import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { eq } from 'drizzle-orm';
import { PENDING_ADMIN_USER_ID } from '@/lib/server/db/client';

const TMP_DB = path.join(process.cwd(), 'tmp-test', `auth-${Date.now()}.sqlite`);

/**
 * Replays the pre-multi-user state of the DB (migrations 0000+0001+0002 applied,
 * one legacy category row seeded, __drizzle_migrations marked so the next
 * getDb() call only runs migration 0003). Used by populated-DB integration
 * tests to simulate "old single-user DB upgraded to multi-user".
 */
async function seedPopulatedDb(dbPath: string) {
  const Database = (await import('better-sqlite3')).default;
  const fs2 = await import('node:fs');
  const path0 = (await import('node:path')).default;
  const crypto = await import('node:crypto');
  const migrationsDir = path0.join(process.cwd(), 'drizzle');
  const sql0000 = fs2.readFileSync(path0.join(migrationsDir, '0000_petite_joshua_kane.sql'), 'utf8');
  const sql0001 = fs2.readFileSync(path0.join(migrationsDir, '0001_demonic_screwball.sql'), 'utf8');
  const sql0002 = fs2.readFileSync(path0.join(migrationsDir, '0002_multi_user_schema.sql'), 'utf8');
  fs2.mkdirSync(path0.dirname(dbPath), { recursive: true });
  const handle = new Database(dbPath);
  handle.pragma('journal_mode = WAL');
  for (const sqlText of [sql0000, sql0001, sql0002]) {
    for (const stmt of sqlText.split('--> statement-breakpoint')) {
      const trimmed = stmt.trim();
      if (trimmed) handle.exec(trimmed);
    }
  }
  // Seed a category row directly
  handle.prepare('INSERT INTO categories (id, name, color, "order") VALUES (?, ?, ?, ?)')
    .run('cat-old-1', 'legacy', '#aaaaaa', 0);
  // Mark migrations 0000–0002 as already applied so drizzle's migrator picks
  // up only 0003 on the next getDb() call. drizzle-orm uses __drizzle_migrations
  // (id, hash, created_at) and only runs migrations whose `folderMillis` (from
  // _journal.json `when`) is greater than the most recent stored `created_at`.
  handle.exec('CREATE TABLE IF NOT EXISTS __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)');
  const journal = JSON.parse(fs2.readFileSync(path0.join(migrationsDir, 'meta', '_journal.json'), 'utf8'));
  for (const tag of ['0000_petite_joshua_kane', '0001_demonic_screwball', '0002_multi_user_schema']) {
    const entry = journal.entries.find((e: { tag: string; when: number }) => e.tag === tag);
    if (!entry) throw new Error(`missing journal entry ${tag}`);
    const sqlContent = fs2.readFileSync(path0.join(migrationsDir, `${tag}.sql`), 'utf8');
    const hash = crypto.createHash('sha256').update(sqlContent).digest('hex');
    handle.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run(hash, entry.when);
  }
  handle.close();
}

function cleanupDb(dbPath: string) {
  if (fs.existsSync(dbPath)) fs.rmSync(dbPath);
  const wal = `${dbPath}-wal`; if (fs.existsSync(wal)) fs.rmSync(wal);
  const shm = `${dbPath}-shm`; if (fs.existsSync(shm)) fs.rmSync(shm);
}

beforeEach(() => {
  process.env.DB_PATH = TMP_DB;
  process.env.APP_USERNAME = 'testadmin';
  // argon2id hash for the literal string "young7983*"
  process.env.APP_PASSWORD_HASH = '$argon2id$v=19$m=19456,t=2,p=1$ELJM/O1oWAJSXPLxq1u5Iw$tY7ll9XvXaPDF4NFzgfRdGN8SCXMlDd2Z2Uc/g2h/5A';
  process.env.SESSION_SECRET = 'a'.repeat(64);
});
afterEach(async () => {
  const { closeDb } = await import('@/lib/server/db/client');
  closeDb();
  cleanupDb(TMP_DB);
});

describe('admin user seeding', () => {
  it('seeds admin user with id, username, hash on first boot', async () => {
    const { getDb, schema } = await import('@/lib/server/db/client');
    const db = getDb();
    const rows = await db.select().from(schema.users).where(eq(schema.users.username, 'testadmin')).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/); // ULID format
    expect(rows[0].passwordHash).toContain('argon2id');
  });

  it('does not duplicate admin user on second boot', async () => {
    const { getDb, schema, closeDb } = await import('@/lib/server/db/client');
    getDb();
    closeDb();
    getDb();
    const db = getDb();
    const rows = await db.select().from(schema.users).where(eq(schema.users.username, 'testadmin')).all();
    expect(rows).toHaveLength(1);
  });
});

import { verifyCredentials } from '@/lib/server/auth';

describe('verifyCredentials', () => {
  it('returns userId for correct username + password', async () => {
    process.env.APP_USERNAME = 'testadmin';
    process.env.APP_PASSWORD_HASH = '$argon2id$v=19$m=19456,t=2,p=1$ELJM/O1oWAJSXPLxq1u5Iw$tY7ll9XvXaPDF4NFzgfRdGN8SCXMlDd2Z2Uc/g2h/5A';
    process.env.SESSION_SECRET = 'a'.repeat(64);
    const { getDb } = await import('@/lib/server/db/client');
    getDb();
    const result = await verifyCredentials('testadmin', 'young7983*');
    expect(result).toMatchObject({ userId: expect.any(String), username: 'testadmin' });
  });

  it('returns null for wrong password', async () => {
    process.env.APP_USERNAME = 'testadmin';
    process.env.APP_PASSWORD_HASH = '$argon2id$v=19$m=19456,t=2,p=1$ELJM/O1oWAJSXPLxq1u5Iw$tY7ll9XvXaPDF4NFzgfRdGN8SCXMlDd2Z2Uc/g2h/5A';
    process.env.SESSION_SECRET = 'a'.repeat(64);
    const { getDb } = await import('@/lib/server/db/client');
    getDb();
    const result = await verifyCredentials('testadmin', 'wrong-password');
    expect(result).toBeNull();
  });

  it('returns null for unknown username', async () => {
    process.env.SESSION_SECRET = 'a'.repeat(64);
    const { getDb } = await import('@/lib/server/db/client');
    getDb();
    const result = await verifyCredentials('nobody', 'whatever');
    expect(result).toBeNull();
  });
});

describe('backfill userId on existing rows', () => {
  it('every category row has user_id after migration + admin seeding', async () => {
    process.env.APP_USERNAME = 'testadmin';
    process.env.APP_PASSWORD_HASH = '$argon2id$v=19$m=19456,t=2,p=1$ELJM/O1oWAJSXPLxq1u5Iw$tY7ll9XvXaPDF4NFzgfRdGN8SCXMlDd2Z2Uc/g2h/5A';
    process.env.SESSION_SECRET = 'a'.repeat(64);
    const { getDb, schema } = await import('@/lib/server/db/client');
    const db = getDb();
    // ensureSeed already inserted 8 default categories during getDb()
    const cats = await db.select().from(schema.categories).all();
    expect(cats.length).toBeGreaterThan(0);
    for (const c of cats) {
      expect(c.userId).not.toBeNull();
      expect(c.userId).toEqual(expect.any(String));
    }
  });

  it('migration succeeds and backfills user_id on a non-empty pre-existing DB', async () => {
    // Phase 1: simulate an old single-user DB by writing the original (pre-multi-user) schema and seeding rows BEFORE multi-user migrations run.
    process.env.APP_USERNAME = 'testadmin';
    process.env.APP_PASSWORD_HASH = '$argon2id$v=19$m=19456,t=2,p=1$ELJM/O1oWAJSXPLxq1u5Iw$tY7ll9XvXaPDF4NFzgfRdGN8SCXMlDd2Z2Uc/g2h/5A';
    process.env.SESSION_SECRET = 'a'.repeat(64);
    // Use a unique DB path for this test to avoid polluting other tests
    const TMP_DB_2 = path.join(process.cwd(), 'tmp-test', `populated-${Date.now()}.sqlite`);
    process.env.DB_PATH = TMP_DB_2;

    await seedPopulatedDb(TMP_DB_2);

    try {
      // Phase 2: getDb() now triggers migrate() which applies 0003. Migration must succeed and backfill must run.
      const { getDb, schema, closeDb } = await import('@/lib/server/db/client');
      const db = getDb();
      const cats = await db.select().from(schema.categories).where(eq(schema.categories.id, 'cat-old-1')).all();
      expect(cats).toHaveLength(1);
      expect(cats[0].userId).not.toBe(PENDING_ADMIN_USER_ID);
      expect(cats[0].userId).toEqual(expect.any(String));
      closeDb();
    } finally {
      cleanupDb(TMP_DB_2);
    }
  });

  it('leaves sentinel in place when no admin is configured', async () => {
    // Skip env-based admin entirely
    delete process.env.APP_USERNAME;
    delete process.env.APP_PASSWORD_HASH;
    process.env.SESSION_SECRET = 'a'.repeat(64);

    const TMP_DB_3 = path.join(process.cwd(), 'tmp-test', `noadmin-${Date.now()}.sqlite`);
    process.env.DB_PATH = TMP_DB_3;

    await seedPopulatedDb(TMP_DB_3);

    try {
      // getDb() runs 0003 (sentinel populated), ensureAdminUser no-ops (no env),
      // backfillUserId no-ops (no admin row), ensureSeed no-ops (no admin to own seeds).
      const { getDb, schema, closeDb } = await import('@/lib/server/db/client');
      const db = getDb();
      const cats = await db.select().from(schema.categories).where(eq(schema.categories.id, 'cat-old-1')).all();
      expect(cats).toHaveLength(1);
      expect(cats[0].userId).toBe(PENDING_ADMIN_USER_ID);
      closeDb();
    } finally {
      cleanupDb(TMP_DB_3);
    }
  });
});
