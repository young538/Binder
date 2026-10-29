import 'server-only';
import { and, eq } from 'drizzle-orm';
import { getDb } from './db/client';
import * as tables from './db/schema';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { type MutationKind, type MutationPayloads as Payloads, referenceFields, validateFields, validateRelationships, ValidationError } from '@/lib/validation/mutations';
export { isDate, referenceFields, validateFields, validateRelationships, ValidationError } from '@/lib/validation/mutations';
export type { MutationKind } from '@/lib/validation/mutations';

export function validateReferences(kind: MutationKind, value: Record<string, unknown>, userId: string) {
  for (const [field, name] of Object.entries(referenceFields[kind] ?? {})) {
    const id = value[field];
    if (typeof id !== 'string') continue;
    const table = tables[name];
    if (!getDb().select({ id: table.id }).from(table).where(and(eq(table.id, id), eq(table.userId, userId))).get()) {
      throw new ValidationError(`Invalid reference: ${field}`);
    }
  }
}

export async function readMutation<K extends MutationKind, P extends boolean = false>(
  req: Request, kind: K, userId: string, patch: P = false as P, id?: string,
): Promise<(P extends true ? Partial<Payloads[K]> : Payloads[K]) | Response> {
  let raw: unknown;
  try { raw = await req.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  try {
    const value = validateFields(kind, raw, patch);
    let existing: Record<string, unknown> | undefined;
    if (patch && id && (kind === 'timeBlocks' || kind === 'todos')) {
      const table = kind === 'timeBlocks' ? tables.timeBlocks : tables.todos;
      existing = getDb().select().from(table).where(and(eq(table.id, id), eq(table.userId, userId))).get();
      if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });
    }
    if (kind === 'settings') existing = getDb().select().from(tables.settings).where(eq(tables.settings.userId, userId)).get() ?? DEFAULT_SETTINGS;
    validateRelationships(kind, { ...existing, ...value });
    validateReferences(kind, value, userId);
    return value as P extends true ? Partial<Payloads[K]> : Payloads[K];
  } catch (error) {
    if (error instanceof ValidationError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
