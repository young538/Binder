import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { SqliteBackup, verifyBackup } from './lib/sqlite-backup.mjs';

const directory = path.resolve(process.env.BACKUP_DIR ?? './backups');
try {
  const command = process.argv[2] ?? 'once';
  if (command === 'status') {
    const status = JSON.parse(await readFile(path.join(directory, 'backup-status.json'), 'utf8'));
    if (status.error || !status.lastSuccess || Date.now() - Date.parse(status.lastSuccess) > 26 * 3600000) throw new Error('No recent successful backup');
    if (typeof status.filename !== 'string' || path.basename(status.filename) !== status.filename) throw new Error('Invalid backup filename');
    await access(path.join(directory, status.filename));
    console.log(JSON.stringify({ lastSuccess: status.lastSuccess, filename: status.filename }));
  } else if (command === 'verify') {
    if (!process.argv[3]) throw new Error('Usage: node scripts/backup.mjs verify <backup.sqlite>');
    const filename = path.resolve(process.argv[3]);
    const manifest = JSON.parse(await readFile(`${filename}.json`, 'utf8'));
    console.log(JSON.stringify(await verifyBackup(filename, manifest.sha256)));
  } else if (command === 'once') {
    const backup = new SqliteBackup({ source: process.env.DB_PATH ?? './data/binder.sqlite', directory, retentionDays: Number(process.env.BACKUP_RETENTION_DAYS ?? 30) });
    console.log(JSON.stringify(await backup.run()));
  } else throw new Error('Commands: once | status | verify <backup.sqlite>');
} catch (error) { console.error(error.message); process.exitCode = 1; }
