// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { changeUserPassword, verifyCredentials } from '@/lib/server/auth';
import { AuthRateLimiter, extractClientIp, formatRetryAfter } from '@/lib/server/authRateLimit';
import { closeDb, getDb, schema } from '@/lib/server/db/client';
import { validateFields, validateRelationships, ValidationError } from '@/lib/validation/mutations';

const dbPath = path.join(process.cwd(), 'tmp-test', `auth-security-${process.pid}.sqlite`);
// argon2id hash for "young7983*"
const INITIAL_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$ELJM/O1oWAJSXPLxq1u5Iw$tY7ll9XvXaPDF4NFzgfRdGN8SCXMlDd2Z2Uc/g2h/5A';

describe('AuthRateLimiter & IP extraction', () => {
  it('blocks on 6th failure per (ip, key), clears per-key on success, and enforces per-ip cap', () => {
    let nowMs = 1_000_000;
    const limiter = new AuthRateLimiter(
      { windowMs: 15 * 60 * 1000, maxPerKey: 5, maxPerIp: 8 },
      () => nowMs,
    );

    for (let i = 0; i < 5; i++) {
      expect(limiter.check('203.0.113.10', 'alice')).toEqual({ allowed: true });
      limiter.recordFailure('203.0.113.10', 'alice');
      nowMs += 1_000;
    }

    const blocked = limiter.check('203.0.113.10', 'alice');
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSec).toBeGreaterThan(800);
      expect(formatRetryAfter(blocked.retryAfterSec)).toBe('약 15분');
    }

    // Different username from same IP is still allowed until maxPerIp is reached.
    expect(limiter.check('203.0.113.10', 'bob')).toEqual({ allowed: true });

    // Login success clears per-key counter for alice, while preserving IP failure count.
    limiter.recordSuccess('203.0.113.10', 'alice');
    expect(limiter.check('203.0.113.10', 'alice')).toEqual({ allowed: true });

    // 3 more failures for bob push IP failures from 5 -> 8, tripping maxPerIp for any user.
    for (let i = 0; i < 3; i++) {
      limiter.recordFailure('203.0.113.10', 'bob');
    }
    const ipBlocked = limiter.check('203.0.113.10', 'charlie');
    expect(ipBlocked.allowed).toBe(false);

    // Different IP remains unaffected.
    expect(limiter.check('203.0.113.99', 'alice')).toEqual({ allowed: true });

    // Sliding window expires cleanly after 15 minutes.
    nowMs += 15 * 60 * 1000 + 1;
    expect(limiter.check('203.0.113.10', 'charlie')).toEqual({ allowed: true });
  });

  it('extracts right-most proxy hop from x-forwarded-for or falls back cleanly', () => {
    expect(
      extractClientIp({ headers: new Headers({ 'x-forwarded-for': '198.51.100.1, 203.0.113.5' }) }),
    ).toBe('203.0.113.5');
    expect(extractClientIp({ headers: new Headers({ 'x-real-ip': '198.51.100.7' }) })).toBe('198.51.100.7');
    expect(extractClientIp({ headers: new Headers() })).toBe('local');
  });
});

describe('changePassword & retroCoach validation + changeUserPassword', () => {
  beforeEach(() => {
    process.env.DB_PATH = dbPath;
    process.env.APP_USERNAME = 'admin';
    process.env.APP_PASSWORD_HASH = INITIAL_HASH;
    process.env.SESSION_SECRET = 'a'.repeat(64);
    getDb();
  });

  afterEach(() => {
    closeDb();
    for (const suffix of ['', '-wal', '-shm']) {
      fs.rmSync(`${dbPath}${suffix}`, { force: true });
    }
  });

  it('rejects short/identical passwords and invalid retroCoach periods', () => {
    expect(() => validateFields('changePassword', { currentPassword: 'old', newPassword: 'short' })).toThrow(
      ValidationError,
    );
    expect(() =>
      validateRelationships('changePassword', { currentPassword: 'samePassword1', newPassword: 'samePassword1' }),
    ).toThrow(ValidationError);
    expect(() => validateRelationships('retroCoach', { mode: 'weekly', period: '2026-W99' })).toThrow(
      ValidationError,
    );
    expect(() => validateRelationships('retroCoach', { mode: 'monthly', period: '2026-13' })).toThrow(
      ValidationError,
    );
  });

  it('verifies current password with 400 on mismatch and updates argon2id hash cleanly', async () => {
    const db = getDb();
    const admin = db.select().from(schema.users).where(eq(schema.users.username, 'admin')).get()!;

    const bad = await changeUserPassword(admin.id, 'wrong-password', 'newSecretPass99*', db);
    expect(bad).toEqual({
      ok: false,
      error: '현재 비밀번호가 올바르지 않아요.',
      status: 400,
    });

    const ok = await changeUserPassword(admin.id, 'young7983*', 'newSecretPass99*', db);
    expect(ok).toEqual({ ok: true });

    expect(await verifyCredentials('admin', 'young7983*')).toBeNull();
    const verifiedNew = await verifyCredentials('admin', 'newSecretPass99*');
    expect(verifiedNew?.userId).toBe(admin.id);
    expect(verifiedNew?.username).toBe('admin');

    const updatedRow = db.select().from(schema.users).where(eq(schema.users.id, admin.id)).get()!;
    expect(updatedRow.passwordHash).toContain('$argon2id$');
  });
});
