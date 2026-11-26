// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
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
  it('upgrades populated planning data without losing ambiguous or independent records', () => {
    const db = new Database(':memory:');
    try {
      const files = fs.readdirSync(migrationsFolder).filter(file => file.endsWith('.sql')).sort();
      for (const file of files.filter(file => file < '0016')) db.exec(fs.readFileSync(path.join(migrationsFolder, file), 'utf8'));
      const block = db.prepare(`INSERT INTO time_blocks
        (id, user_id, date, start_min, end_min, text, kind, category_id, created_at, updated_at)
        VALUES (?, ?, '2026-11-20', 540, 600, 'Review', ?, 'work', '2026-11-20', '2026-11-20')`);
      for (const [id, kind] of [['p1', 'plan'], ['p2', 'plan'], ['a1', 'actual'], ['a2', 'actual'], ['a3', 'actual']]) {
        block.run(id, 'owner', kind);
      }
      block.run('other', 'other-owner', 'plan');
      const todo = db.prepare(`INSERT INTO todos
        (id, user_id, title, scope, scope_key, status, "order", google_task_list_id, google_task_id, created_at, updated_at)
        VALUES (?, 'owner', 'Read', 'day', '2026-11-20', 'pending', 0, 'list', 'remote', ?, 'now')`);
      todo.run('original', '2026-11-20');
      todo.run('repeat', '2026-11-21');
      db.exec(fs.readFileSync(path.join(migrationsFolder, '0016_plan-confirmation.sql'), 'utf8'));
      expect(db.prepare("SELECT source_plan_id FROM time_blocks WHERE kind='actual' ORDER BY id").pluck().all())
        .toEqual(['p1', 'p2', null]);
      expect(db.prepare('SELECT google_task_id FROM todos ORDER BY created_at').pluck().all()).toEqual(['remote', null]);
    } finally {
      db.close();
    }
  });

  it('upgrades stale goal links while preserving template order and valid links', () => {
    const db = new Database(':memory:');
    try {
      const files = fs.readdirSync(migrationsFolder).filter(file => file.endsWith('.sql')).sort();
      for (const file of files.filter(file => file < '0017')) db.exec(fs.readFileSync(path.join(migrationsFolder, file), 'utf8'));
      db.exec(`INSERT INTO goals (id,user_id,title,level,"order",created_at,updated_at,parent_id)
        VALUES ('keep','a','A','mandalartCore',0,'now','now','gone'), ('foreign','b','B','oneThing',0,'now','now',NULL)`);
      const blocks = ['foreign', 'keep', 'gone'].map((goalId, i) => ({ goalId, text: String(i), categoryId: 'work' }));
      db.prepare('INSERT INTO weekly_templates (id,user_id,name,blocks,created_at,updated_at) VALUES (?,?,?,?,?,?)')
        .run('t', 'a', 'Template', JSON.stringify(blocks), 'now', 'now');
      db.exec(fs.readFileSync(path.join(migrationsFolder, '0017_goal-integrity-and-calendar-deletions.sql'), 'utf8'));
      expect(db.prepare("SELECT parent_id FROM goals WHERE id='keep'").pluck().get()).toBeNull();
      expect(JSON.parse(db.prepare("SELECT blocks FROM weekly_templates WHERE id='t'").pluck().get() as string))
        .toEqual([{ text: '0', categoryId: 'work' }, blocks[1], { text: '2', categoryId: 'work' }]);
    } finally {
      db.close();
    }
  });

  it('repairs pre-v18 category links per owner and preserves expenses and template order', () => {
    const db = new Database(':memory:');
    try {
      const scripts = fs.readdirSync(migrationsFolder).filter(file => file.endsWith('.sql')).sort();
      for (const file of scripts.filter(file => file < '0018')) db.exec(fs.readFileSync(path.join(migrationsFolder, file), 'utf8'));
      db.exec(`INSERT INTO categories(id,user_id,name,color,"order") VALUES ('existing','a','기타','#123456',0)`);
      const insertBlock = db.prepare(`INSERT INTO time_blocks
        (id,user_id,category_id,date,start_min,end_min,text,kind,created_at,updated_at)
        VALUES (?,?,?,'2026-11-26',60,90,'work','plan','now','now')`);
      insertBlock.run('a-block', 'a', 'gone');
      insertBlock.run('b-block', 'b', 'existing');
      const blocks = [{ text: 'keep', categoryId: 'existing' }, { text: 'repair', categoryId: 'gone' }];
      db.prepare('INSERT INTO weekly_templates (id,user_id,name,blocks,created_at,updated_at) VALUES (?,?,?,?,?,?)')
        .run('template', 'a', 'week', JSON.stringify(blocks), 'now', 'now');
      db.exec(`INSERT INTO finance_transactions(id,user_id,date,kind,amount,category,merchant,subscription_id,created_at,updated_at)
        VALUES ('tx','a','2026-11-26','expense',2500,'food','shop','gone','now','now')`);
      db.exec(fs.readFileSync(path.join(migrationsFolder, '0018_durable-sync-and-reference-repair.sql'), 'utf8'));
      const migrated = db.prepare('SELECT c.id, c.name, c.user_id FROM time_blocks AS b JOIN categories AS c ON c.id = b.category_id ORDER BY b.id').all();
      expect(migrated).toEqual([{ id: 'existing', name: '기타', user_id: 'a' }, { id: expect.any(String), name: '기타', user_id: 'b' }]);
      expect(JSON.parse(db.prepare('SELECT blocks FROM weekly_templates').pluck().get() as string))
        .toEqual(blocks.map(block => ({ ...block, categoryId: 'existing' })));
      expect(db.prepare('SELECT amount,subscription_id FROM finance_transactions').get()).toEqual({ amount: 2500, subscription_id: null });
    } finally {
      db.close();
    }
  });

  it('deletes only the selected account from every table with a user_id column', () => {
    const app = new DatabaseConnection({ filename: () => filename, migrationsFolder });
    app.get();
    app.close();
    const db = new Database(filename);
    try {
      const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type='table'").pluck().all() as string[];
      const owned = tables.filter(name => db.prepare('SELECT 1 FROM pragma_table_info(?) WHERE name=?').get(name, 'user_id'));
      db.transaction(() => {
        db.pragma('defer_foreign_keys = ON');
        for (const uid of ['a', 'b']) {
          db.prepare('INSERT INTO users VALUES (?,?,?,?,?)').run(uid, uid, 'fixture', 'now', 'now');
          for (const table of owned) {
            const columns = db.prepare('SELECT name,type FROM pragma_table_info(?) WHERE name=? OR pk OR ("notnull" AND dflt_value IS NULL)')
              .all(table, 'user_id') as { name: string; type: string }[];
            const values = columns.map(({ name, type }) => {
              if (name === 'user_id') return uid;
              if (name === 'local_id') return uid + '-life_events';
              return type.toLowerCase() === 'text' ? uid + '-' + table : 1;
            });
            db.prepare(`INSERT INTO "${table}" (${columns.map(c => '"' + c.name + '"').join(',')})
              VALUES (${columns.map(() => '?').join(',')})`).run(...values);
          }
        }
      })();
      const remaining = new Map(owned.map(table => [
        table, db.prepare(`SELECT * FROM "${table}" WHERE user_id = ?`).all('b'),
      ]));
      execFileSync(process.execPath, ['scripts/users.mjs', 'delete', 'a'], { env: { ...process.env, DB_PATH: filename } });
      for (const table of owned) {
        expect(db.prepare(`SELECT * FROM "${table}"`).all(), table).toEqual(remaining.get(table));
      }
      expect(db.prepare('SELECT id FROM users').pluck().all()).toEqual(['b']);
    } finally {
      db.close();
    }
  });

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
