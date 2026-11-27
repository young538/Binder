import 'server-only';
import { newId } from '@/lib/utils/id';
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
  // Legacy repairs below must not change the caller's document.
  const data = structuredClone(raw.data);
  const exportVersion = timestamp(data.generatedAt) && typeof data.version === 'number' &&
    Number.isInteger(data.version) && data.version >= 1 ? data.version : Infinity;
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
      if (name === 'injectionPens') {
        if (fields.isExample !== undefined && typeof fields.isExample !== 'boolean') fail('Invalid isExample');
        delete fields.isExample;
      }
      if (name === 'projects') {
        if (fields.completedAt !== undefined && fields.completedAt !== null && !timestamp(fields.completedAt)) fail('Invalid completedAt');
        delete fields.completedAt;
      }
      if (name === 'todos') {
        if (fields.completedAt !== undefined && fields.completedAt !== null && !timestamp(fields.completedAt)) fail('Invalid completedAt');
        if (fields.repeatGenerated !== undefined && typeof fields.repeatGenerated !== 'boolean') fail('Invalid repeatGenerated');
        if (fields.googleTaskListId !== undefined && fields.googleTaskListId !== null && typeof fields.googleTaskListId !== 'string') fail('Invalid googleTaskListId');
        if (fields.googleTaskId !== undefined && fields.googleTaskId !== null && typeof fields.googleTaskId !== 'string') fail('Invalid googleTaskId');
        if (fields.googleTaskUpdatedAt !== undefined && fields.googleTaskUpdatedAt !== null && !timestamp(fields.googleTaskUpdatedAt)) fail('Invalid googleTaskUpdatedAt');
        delete fields.completedAt;
        delete fields.repeatGenerated;
        delete fields.googleTaskListId;
        delete fields.googleTaskId;
        delete fields.googleTaskUpdatedAt;
      }
      if (name === 'financeTransactions') {
        if (fields.externalHash !== undefined && fields.externalHash !== null && typeof fields.externalHash !== 'string') fail('Invalid externalHash');
        delete fields.externalHash;
      }
      if (name === 'lifeEvents') {
        if (fields.googleCalendarId !== undefined && fields.googleCalendarId !== null && typeof fields.googleCalendarId !== 'string') fail('Invalid googleCalendarId');
        if (fields.googleEventId !== undefined && fields.googleEventId !== null && typeof fields.googleEventId !== 'string') fail('Invalid googleEventId');
        if (fields.googleUpdatedAt !== undefined && fields.googleUpdatedAt !== null && !timestamp(fields.googleUpdatedAt)) fail('Invalid googleUpdatedAt');
        delete fields.googleCalendarId;
        delete fields.googleEventId;
        delete fields.googleUpdatedAt;
      }
      validateFields(name, fields);
      validateRelationships(name, fields);
      const owner = lookup.ownerOf(name, id);
      if (owner !== undefined && owner !== userId) fail(`Invalid ${name} id`);
    }
  }
  const mode = raw.mode;
  let recoveredCategory: string | undefined;
  function recoveryCategoryId(): string {
    if (recoveredCategory) return recoveredCategory;
    const categories = (data.categories ??= []) as Record<string, unknown>[];
    const imported = categories.find(category => category.name === '기타');
    recoveredCategory = imported?.id as string | undefined;
    if (!recoveredCategory && mode === 'merge') recoveredCategory = lookup.recoveryCategoryId();
    if (!recoveredCategory) {
      recoveredCategory = newId();
      categories.push({ id: recoveredCategory, name: '기타', color: '#9ca3af', order: categories.length });
    }
    return recoveredCategory;
  }
  function validateReference(name: Name, row: Record<string, unknown>, field: string, target: Name) {
    const id = row[field];
    if (typeof id !== 'string' || ids.get(target)?.has(id)) return;
    const owner = lookup.ownerOf(target, id);
    if (mode === 'merge' && owner === userId) return;
    if (target === 'categories' && exportVersion <= 17 && (owner === undefined || owner === userId)) {
      row[field] = name === 'timeBlocks' || name === 'weeklyTemplates' ? recoveryCategoryId() : null;
      return;
    }
    const legacyOrphan = (target === 'subscriptions' && exportVersion <= 17) ||
      (target === 'goals' && exportVersion <= 16) ||
      (name === 'timeBlocks' && field === 'todoId' && exportVersion <= 15);
    if (legacyOrphan && (owner === undefined || owner === userId)) {
      row[field] = null;
      return;
    }
    fail(`Invalid reference: ${name}.${field}`);
  }

  for (const name of names) {
    const rows = data[name] as Record<string, unknown>[] | undefined;
    for (const row of rows ?? []) {
      if (name === 'weeklyTemplates') {
        for (const block of row.blocks as Record<string, unknown>[]) {
          validateReference(name, block, 'categoryId', 'categories');
          validateReference(name, block, 'goalId', 'goals');
        }
      }
      for (const [field, target] of Object.entries(referenceFields[name] ?? {})) {
        validateReference(name, row, field, target);
      }
    }
  }
  if (data.settings !== undefined && data.settings !== null) {
    validateFields('settings', data.settings);
    validateRelationships('settings', data.settings as Record<string, unknown>);
  }
  if (Array.isArray(data.timeBlocks)) linkLegacyActuals(data.timeBlocks);
  return { mode: raw.mode, data } as ImportBody;
}

function linkLegacyActuals(blocks: Record<string, unknown>[]): void {
  if (!blocks.some(block => block.kind === 'actual' && !Object.hasOwn(block, 'sourcePlanId'))) return;
  const linked = new Set(blocks.map(block => block.sourcePlanId));
  const key = (block: Record<string, unknown>) => JSON.stringify([
    block.date, block.startMin, block.endMin, block.text, block.categoryId, block.goalId, block.projectId, block.todoId,
  ]);
  const ordered = [...blocks].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) ||
    String(a.id).localeCompare(String(b.id)));
  const available = new Map<string, unknown[]>();
  for (const block of ordered) {
    if (block.kind !== 'plan' || linked.has(block.id)) continue;
    const signature = key(block);
    const group = available.get(signature) ?? [];
    group.push(block.id);
    available.set(signature, group);
  }
  for (const actual of ordered) {
    if (actual.kind === 'actual' && !Object.hasOwn(actual, 'sourcePlanId')) {
      actual.sourcePlanId = available.get(key(actual))?.shift() ?? null;
    }
  }
}
