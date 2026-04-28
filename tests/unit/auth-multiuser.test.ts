import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { eq } from 'drizzle-orm';

const TMP_DB = path.join(process.cwd(), 'tmp-test', `auth-${Date.now()}.sqlite`);

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
  if (fs.existsSync(TMP_DB)) fs.rmSync(TMP_DB);
  const wal = `${TMP_DB}-wal`; if (fs.existsSync(wal)) fs.rmSync(wal);
  const shm = `${TMP_DB}-shm`; if (fs.existsSync(shm)) fs.rmSync(shm);
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
