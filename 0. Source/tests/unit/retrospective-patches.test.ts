// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';

const dbPath = path.join(process.cwd(), 'tmp-test', `retro-patches-${Date.now()}.sqlite`);

beforeEach(() => {
  vi.stubEnv('DB_PATH', dbPath);
  vi.stubEnv('APP_USERNAME', 'test');
  vi.stubEnv('APP_PASSWORD_HASH', 'test-hash');
  vi.resetModules();
});

afterEach(async () => {
  const { closeDb } = await import('@/lib/server/db/client');
  closeDb();
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${dbPath}${suffix}`;
    if (fs.existsSync(file)) fs.rmSync(file);
  }
  vi.unstubAllEnvs();
});

describe('retrospective partial writes', () => {
  it('preserves reading, reflection, rating, and free text across independent edits', async () => {
    const { getDb, schema } = await import('@/lib/server/db/client');
    const { getUserRepositories } = await import('@/lib/server/repos');
    const user = getDb().select().from(schema.users).get()!;
    await getUserRepositories(user.id).retrospectives.upsert('daily', '2026-09-09', {
      template: { good: 'good', bad: 'bad', nextStep: 'next' }, rating: 4, freeText: 'memo',
    });
    await getUserRepositories(user.id).retrospectives.upsert('daily', '2026-09-09', { template: { reading: 'book' } });
    await getUserRepositories(user.id).retrospectives.upsert('daily', '2026-09-09', { template: { good: '' } });
    expect(await getUserRepositories(user.id).retrospectives.get('daily', '2026-09-09')).toMatchObject({
      template: { good: '', bad: 'bad', nextStep: 'next', reading: 'book' }, rating: 4, freeText: 'memo',
    });
  });

  it('concurrent first writes create one complete record and keep user scopes separate', async () => {
    const { getDb, schema } = await import('@/lib/server/db/client');
    const { getUserRepositories } = await import('@/lib/server/repos');
    const user = getDb().select().from(schema.users).get()!;
    await Promise.all([
      getUserRepositories(user.id).retrospectives.upsert('daily', '2026-09-09', { template: { reading: 'book' } }),
      getUserRepositories(user.id).retrospectives.upsert('daily', '2026-09-09', { template: { good: 'reflection' } }),
    ]);
    expect(getDb().select().from(schema.retrospectives).all()).toHaveLength(1);
    expect(await getUserRepositories(user.id).retrospectives.get('daily', '2026-09-09')).toMatchObject({
      template: { reading: 'book', good: 'reflection' },
    });
    expect(await getUserRepositories('another-user').retrospectives.get('daily', '2026-09-09')).toBeNull();
  });
});
