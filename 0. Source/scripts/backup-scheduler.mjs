import { access, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { SqliteBackup, backupDue, writeJson } from './lib/sqlite-backup.mjs';

const directory = path.resolve(process.env.BACKUP_DIR ?? './backups');
const timeZone = process.env.BACKUP_TIMEZONE ?? 'Asia/Seoul';
const hour = Number(process.env.BACKUP_HOUR ?? 3);
if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error('BACKUP_HOUR must be 0..23');
new Intl.DateTimeFormat('en', { timeZone }).format(new Date());
const backup = new SqliteBackup({ source: process.env.DB_PATH ?? './data/binder.sqlite', directory, retentionDays: Number(process.env.BACKUP_RETENTION_DAYS ?? 30) });
await mkdir(directory, { recursive: true });
const statusFile = path.join(directory, 'backup-status.json');
let status = {};
try {
  status = JSON.parse(await readFile(statusFile, 'utf8'));
  if (typeof status.filename !== 'string' || path.basename(status.filename) !== status.filename || !Number.isFinite(Date.parse(status.lastSuccess))) throw new Error('Invalid status');
  await access(path.join(directory, status.filename));
} catch { status = {}; }
const controller = new AbortController();
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => controller.abort());
while (!controller.signal.aborted) {
  if (status.error || backupDue(new Date(), status.lastSuccess, timeZone, hour)) {
    status.lastAttempt = new Date().toISOString();
    try {
      const result = await backup.run();
      status = { lastAttempt: status.lastAttempt, lastSuccess: result.createdAt, filename: result.filename };
      console.log(JSON.stringify({ event: 'backup-complete', ...status }));
    } catch (error) {
      status.error = error.message;
      console.error(JSON.stringify({ event: 'backup-failed', message: error.message }));
    }
    await writeJson(statusFile, status);
  }
  try { await sleep(status.error ? 300000 : 30000, undefined, { signal: controller.signal }); }
  catch (error) { if (error.name !== 'AbortError') throw error; }
}
