import 'server-only';
import { getDb } from './db/client';
import { BACKUP_COLLECTIONS, type BackupCollection, type ImportBody } from '@/lib/backup';
import { UserBackupRepository, type BackupLookup } from './backup/repository';
export type { ImportBody } from '@/lib/backup';
import { referenceFields, validateFields, validateRelationships, ValidationError } from '@/lib/validation/mutations';

const names = BACKUP_COLLECTIONS;
type Name = BackupCollection;
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (message: string): never => { throw new ValidationError(message); };
const timestamp = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));

/** Validate the entire backup before replace mode can delete anything. */
export function validateImport(
  raw: unknown, userId: string, lookup: BackupLookup = new UserBackupRepository(getDb(), userId),
): ImportBody {
  if (!object(raw) || Object.keys(raw).some(key => !['mode', 'data'].includes(key))) return fail('Invalid import body');
  if (raw.mode !== 'merge' && raw.mode !== 'replace') return fail('Invalid import mode');
  if (!object(raw.data)) return fail('data must be an object');
  const data = raw.data;
  if (Object.keys(data).some(key => ![...names, 'settings', 'version', 'updatedAt', 'generatedAt'].includes(key))) fail('Unknown import collection');
  const ids = new Map<Name, Set<string>>();
  for (const name of names) {
    const rows = data[name];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) return fail(`${name} must be an array`);
    const seen = new Set<string>();
    ids.set(name, seen);
    for (const rawRow of rows) {
      if (!object(rawRow)) return fail(`Invalid ${name} row`);
      const { id, userId: importedUserId, createdAt, updatedAt, ...fields } = rawRow;
      if (typeof id !== 'string' || !id.trim() || seen.has(id)) return fail(`Invalid or duplicate ${name} id`);
      seen.add(id);
      if (importedUserId !== undefined && typeof importedUserId !== 'string') fail('Invalid imported userId');
      if (name !== 'categories' && name !== 'focusNotes' && !timestamp(createdAt)) fail('Invalid createdAt');
      if (name !== 'categories' && name !== 'habitLogs' && !timestamp(updatedAt)) fail('Invalid updatedAt');
      if ((name === 'categories' && (createdAt !== undefined || updatedAt !== undefined)) || (name === 'habitLogs' && updatedAt !== undefined) || (name === 'focusNotes' && createdAt !== undefined)) fail('Unknown timestamp field');
      // SQLite represents absent optional fields as null in exported rows.
      for (const key of name === 'todos' ? ['priority'] : name === 'retrospectives' ? ['rating', 'freeText'] : name === 'habits' ? ['schedule'] : []) {
        if (fields[key] === null) delete fields[key];
      }
      if (name === 'annualGoals' && Object.hasOwn(fields, 'monthlyActualAdjustments')) {
        const adjustments = fields.monthlyActualAdjustments;
        if (adjustments !== null && (!Array.isArray(adjustments) || adjustments.length !== 12 || adjustments.some(v => v !== null && (typeof v !== 'number' || !Number.isFinite(v))))) fail('Invalid monthlyActualAdjustments');
        delete fields.monthlyActualAdjustments;
      }
      validateFields(name, fields);
      validateRelationships(name, fields);
      const owner = lookup.ownerOf(name, id);
      if (owner !== undefined && owner !== userId) fail(`Invalid ${name} id`);
    }
  }
  for (const name of names) {
    const rows = data[name] as Record<string, unknown>[] | undefined;
    for (const row of rows ?? []) {
      for (const [field, target] of Object.entries(referenceFields[name] ?? {})) {
        const id = row[field];
        if (typeof id !== 'string' || ids.get(target)?.has(id)) continue;
        const owner = raw.mode === 'merge' ? lookup.ownerOf(target, id) : undefined;
        if (owner !== userId) fail(`Invalid reference: ${name}.${field}`);
      }
    }
  }
  if (data.settings !== undefined && data.settings !== null) {
    validateFields('settings', data.settings);
    validateRelationships('settings', data.settings as Record<string, unknown>);
  }
  return raw as unknown as ImportBody;
}
