// @vitest-environment node
import { afterEach, beforeEach, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SqliteBackup, backupDue, verifyBackup } from '../../scripts/lib/sqlite-backup.mjs';

let dir: string; let source: string; let db: Database.Database;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'binder-backup-test-'));
  source = path.join(dir, 'live.sqlite');
  db = new Database(source); db.pragma('journal_mode=WAL');
  db.exec("CREATE TABLE notes (id INTEGER PRIMARY KEY, text TEXT); INSERT INTO notes VALUES (1, '한글 WAL');");
});
afterEach(async () => {
  db.close();
  // The target is the exact directory returned by mkdtemp under the system temp directory.
  if (!dir.startsWith(path.join(os.tmpdir(), 'binder-backup-test-'))) throw new Error('Unexpected test directory');
  await rm(dir, { recursive: true, force: true });
});

it('backs up live WAL contents and verifies a separate writable restoration without changing the source', async () => {
  const result = await new SqliteBackup({ source, directory: path.join(dir, 'backups') }).run();
  expect(result.restoreVerified).toBe(true);
  expect(result.tables.notes).toBe(1);
  const filename = path.join(dir, 'backups', result.filename);
  expect(await verifyBackup(filename, result.sha256)).toEqual({ sha256: result.sha256, tables: result.tables, restoreVerified: true });
  const restored = new Database(filename, { readonly: true });
  try { expect(restored.prepare('SELECT text FROM notes').get()).toEqual({ text: '한글 WAL' }); } finally { restored.close(); }
  expect(db.prepare("SELECT name FROM sqlite_master WHERE name LIKE '__restore_probe_%'").all()).toHaveLength(0);
  expect(db.prepare('SELECT count(*) AS count FROM notes').get()).toEqual({ count: 1 });
});

it('prunes only expired managed backups, after a new backup is verified', async () => {
  const directory = path.join(dir, 'backups');
  const old = new Date('2026-01-01T00:00:00Z');
  const prior = await new SqliteBackup({ source, directory, now: () => old }).run();
  await writeFile(path.join(directory, 'binder-before-deploy.sqlite'), 'manual');
  await new SqliteBackup({ source, directory, now: () => new Date('2026-03-01T00:00:00Z') }).run();
  const files = await readdir(directory);
  expect(files).not.toContain(prior.filename);
  expect(files).toContain('binder-before-deploy.sqlite');
  const snapshot = files.sort();
  await expect(new SqliteBackup({ source: path.join(dir, 'missing.sqlite'), directory }).run()).rejects.toThrow();
  expect((await readdir(directory)).sort()).toEqual(snapshot);
});

it('detects corruption and checksum mismatch', async () => {
  const result = await new SqliteBackup({ source, directory: dir }).run();
  const filename = path.join(dir, result.filename);
  await expect(verifyBackup(filename, 'wrong')).rejects.toThrow('checksum');
  await writeFile(filename, 'corrupt');
  await expect(verifyBackup(filename)).rejects.toThrow();
  expect(JSON.parse(await readFile(`${filename}.json`, 'utf8')).sha256).toBe(result.sha256);
});

it('schedules at 03:00 Seoul time, runs on first startup and catches missed days', () => {
  expect(backupDue(new Date('2026-10-29T00:00:00Z'), undefined, 'Asia/Seoul', 3)).toBe(true);
  const prior = '2026-10-28T18:00:00Z';
  expect(backupDue(new Date('2026-10-29T17:59:00Z'), prior, 'Asia/Seoul', 3)).toBe(false);
  expect(backupDue(new Date('2026-10-29T18:00:00Z'), prior, 'Asia/Seoul', 3)).toBe(true);
  expect(backupDue(new Date('2026-10-31T00:00:00Z'), prior, 'Asia/Seoul', 3)).toBe(true);
});
