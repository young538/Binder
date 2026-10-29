// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { DatabaseConnection } from '@/lib/server/db/connection';
import { initializeUsers } from '@/lib/server/db/bootstrap';
import { categories, users } from '@/lib/server/db/schema';

const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'binder-connection-'));
const filename = path.join(folder, 'test.sqlite');
const connections: DatabaseConnection[] = [];
const migrationsFolder = path.join(process.cwd(), 'drizzle');
afterEach(() => {
  connections.forEach(connection => connection.close());
  connections.length = 0;
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(filename + suffix, { force: true });
});

describe('database connection lifecycle', () => {
  it('rolls back a failed bootstrap, releases the handle, and retries initialization', () => {
    let attempts = 0;
    const connection = new DatabaseConnection({ filename: () => filename, migrationsFolder, initialize: db => {
      initializeUsers(db, { username: 'admin', passwordHash: 'test-only' });
      if (++attempts === 1) throw new Error('bootstrap interrupted');
    } });
    connections.push(connection);
    expect(() => connection.get()).toThrow('bootstrap interrupted');
    const inspect = new Database(filename, { readonly: true });
    expect(inspect.prepare('SELECT count(*) AS n FROM users').get()).toEqual({ n: 0 });
    inspect.close();
    const database = connection.get();
    expect(database.select().from(users).all()).toHaveLength(1);
    expect(database.select().from(categories).all()).toHaveLength(8);
    expect(connection.get()).toBe(database);
    expect(attempts).toBe(2);
    connection.close();
    expect(connection.get()).not.toBe(database);
    expect(connection.get().select().from(users).all()).toHaveLength(1);
  });

  it('does not cache a partially migrated database after missing migrations', () => {
    const options = { filename: () => filename, migrationsFolder: path.join(folder, 'missing') };
    const connection = new DatabaseConnection(options);
    connections.push(connection);
    expect(() => connection.get()).toThrow();
    options.migrationsFolder = migrationsFolder;
    expect(connection.get().select().from(users).all()).toEqual([]);
  });
});
