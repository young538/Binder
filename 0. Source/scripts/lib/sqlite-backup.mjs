import Database from 'better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const managed = /^binder-auto-(\d{13})-[a-f0-9-]{36}\.sqlite$/;
const digest = async file => createHash('sha256').update(await readFile(file)).digest('hex');
const quote = name => `"${name.replaceAll('"', '""')}"`;
function inspect(db) {
  if (db.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('SQLite integrity check failed');
  return Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
    .map(({ name }) => [name, db.prepare(`SELECT count(*) AS count FROM ${quote(name)}`).get().count]));
}
async function removeDatabase(file) {
  for (const suffix of ['', '-wal', '-shm']) await rm(`${file}${suffix}`, { force: true });
}
export async function writeJson(file, value) {
  const temporary = `${file}.${randomUUID()}.partial`;
  try { await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 }); await rename(temporary, file); }
  finally { await rm(temporary, { force: true }); }
}

/** Restore into an isolated temporary database, then verify both reads and writes. */
export async function verifyBackup(file, expectedHash) {
  const sha256 = await digest(file);
  if (expectedHash && sha256 !== expectedHash) throw new Error('Backup checksum mismatch');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'binder-restore-'));
  const restored = path.join(dir, 'restored.sqlite');
  let db;
  try {
    await copyFile(file, restored);
    if (await digest(restored) !== sha256) throw new Error('Restored copy checksum mismatch');
    db = new Database(restored, { fileMustExist: true });
    const tables = inspect(db);
    const probe = quote(`__restore_probe_${randomUUID()}`);
    db.exec(`CREATE TABLE ${probe} (value TEXT NOT NULL); INSERT INTO ${probe} VALUES ('restore-ok');`);
    if (db.prepare(`SELECT value FROM ${probe}`).get().value !== 'restore-ok') throw new Error('Restored database is not writable');
    db.exec(`DROP TABLE ${probe}`);
    return { sha256, tables, restoreVerified: true };
  } finally {
    db?.close(); await removeDatabase(restored); await rmdir(dir);
  }
}

/** Owns backup creation and retention; never deletes manually named deployment backups. */
export class SqliteBackup {
  constructor({ source, directory, retentionDays = 30, now = () => new Date() }) {
    if (!Number.isSafeInteger(retentionDays) || retentionDays < 1) throw new Error('BACKUP_RETENTION_DAYS must be a positive integer');
    this.source = path.resolve(source); this.directory = path.resolve(directory); this.retentionDays = retentionDays; this.now = now;
  }
  async run() {
    await mkdir(this.directory, { recursive: true });
    const created = this.now();
    const filename = `binder-auto-${created.getTime()}-${randomUUID()}.sqlite`;
    const destination = path.join(this.directory, filename);
    const partial = `${destination}.partial`;
    let db;
    try {
      db = new Database(this.source, { readonly: true, fileMustExist: true });
      await db.backup(partial);
      db.close(); db = undefined;
      const verified = await verifyBackup(partial);
      await rename(partial, destination);
      const manifest = { filename, createdAt: created.toISOString(), ...verified };
      await writeJson(`${destination}.json`, manifest);
      await this.prune(created);
      return manifest;
    } finally { db?.close(); await removeDatabase(partial); }
  }
  async prune(now) {
    const cutoff = now.getTime() - this.retentionDays * 86400000;
    for (const name of await readdir(this.directory)) {
      const match = managed.exec(name);
      if (match && Number(match[1]) < cutoff) {
        const target = path.join(this.directory, name);
        await rm(target, { force: true }); await rm(`${target}.json`, { force: true });
      }
    }
  }
}

export function backupDue(now, lastSuccess, timeZone, hour) {
  const local = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
  const parts = date => Object.fromEntries(local.formatToParts(date).map(part => [part.type, part.value]));
  if (!lastSuccess) return true;
  const current = parts(now); const prior = parts(new Date(lastSuccess));
  const date = value => `${value.year}-${value.month}-${value.day}`;
  return now.getTime() - Date.parse(lastSuccess) >= 86400000 || (date(current) !== date(prior) && Number(current.hour) >= hour);
}
