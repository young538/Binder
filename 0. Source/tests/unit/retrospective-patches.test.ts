// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { DatabaseConnection } from '@/lib/server/db/connection';
import { retrospectives } from '@/lib/server/db/schema';
import { RetrospectiveRepository } from '@/lib/server/repos/retrospectives';

let connection: DatabaseConnection;
const repo = (userId = 'owner') => new RetrospectiveRepository(connection.get(), userId);
beforeEach(() => {
  connection = new DatabaseConnection({ filename: () => ':memory:', migrationsFolder: path.resolve('drizzle') });
});
afterEach(() => connection.close());

describe('retrospective partial writes', () => {
  it('preserves reading, reflection, rating, and free text across independent edits', async () => {
    await repo().upsert('daily', '2026-09-09', {
      template: { good: 'good', bad: 'bad', nextStep: 'next' }, rating: 4, freeText: 'memo',
    });
    await repo().upsert('daily', '2026-09-09', { template: { reading: 'book' } });
    await repo().upsert('daily', '2026-09-09', { template: { good: '' } });
    expect(await repo().get('daily', '2026-09-09')).toMatchObject({
      template: { good: '', bad: 'bad', nextStep: 'next', reading: 'book' }, rating: 4, freeText: 'memo',
    });
  });

  it('concurrent first writes create one complete record and keep user scopes separate', async () => {
    await Promise.all([
      repo().upsert('daily', '2026-09-09', { template: { reading: 'book' } }),
      repo().upsert('daily', '2026-09-09', { template: { good: 'reflection' } }),
    ]);
    expect(connection.get().select().from(retrospectives).all()).toHaveLength(1);
    expect(await repo().get('daily', '2026-09-09')).toMatchObject({
      template: { reading: 'book', good: 'reflection' },
    });
    expect(await repo('another-user').get('daily', '2026-09-09')).toBeNull();
  });
});
