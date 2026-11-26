import 'server-only';
import { and, asc, eq, inArray, max, ne, or } from 'drizzle-orm';
import type { DatabaseSession } from '../db/connection';
import { todos } from '../db/schema';

interface TodoMove {
  ids?: string[];
  destination: { day: string } | 'inbox';
  sourceDay?: string;
  orderByScopeKey?: boolean;
}

/** Appends selected open TODOs inside the caller's write transaction. */
export function moveActiveTodos(tx: DatabaseSession, userId: string, move: TodoMove, timestamp: string): number {
  if (!move.ids?.length) return 0;
  const scope = move.destination === 'inbox' ? 'inbox' : 'day';
  const scopeKey = move.destination === 'inbox' ? 'inbox' : move.destination.day;
  const owner = eq(todos.userId, userId);
  const order = move.orderByScopeKey ? [asc(todos.scopeKey), asc(todos.order), asc(todos.id)] : [asc(todos.order), asc(todos.id)];
  const selected = tx.select({ id: todos.id }).from(todos).where(and(
    owner, inArray(todos.id, move.ids), inArray(todos.status, ['pending', 'postponed']),
    move.sourceDay ? and(eq(todos.scope, 'day'), eq(todos.scopeKey, move.sourceDay)) : undefined,
    or(ne(todos.scope, scope), ne(todos.scopeKey, scopeKey)),
  )).orderBy(...order).all();
  if (!selected.length) return 0;

  const last = tx.select({ order: max(todos.order) }).from(todos)
    .where(and(owner, eq(todos.scope, scope), eq(todos.scopeKey, scopeKey))).get()?.order ?? -1;
  selected.forEach(({ id }, index) => {
    tx.update(todos).set({
      scope, scopeKey, order: last + index + 1, updatedAt: timestamp,
      ...(scope === 'inbox' ? { repeatRule: null } : {}),
    }).where(and(owner, eq(todos.id, id))).run();
  });
  return selected.length;
}
