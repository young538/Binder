import 'server-only';
import { createHash } from 'node:crypto';
import { and, asc, eq, inArray, lte, max, sql } from 'drizzle-orm';
import { addDays, format, parseISO } from 'date-fns';
import type { Todo } from '@/lib/types';
import { TODO_UNDO_MS, type TodoDeleteResult, type TodoRolloverResult } from '@/lib/todos/contracts';
import { isDate } from '@/lib/validation/mutations';
import { newId } from '@/lib/utils/id';
import { nextRepeatDate } from '@/lib/todos/planning';
import { stripUndefined } from '../db/patch';
import type { BinderDatabase } from '../db/connection';
import { categories, goals, todos, todoCreateRequests, todoTrash } from '../db/schema';
import { DomainError } from '../errors';

type NewTodo = Omit<Todo, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

/** Atomic TODO operations preserve identities, ownership and retry semantics. */
export class TodoActions {
  constructor(private readonly db: BinderDatabase, private readonly userId: string, private readonly now = () => new Date()) {}

  create(data: NewTodo, requestKey?: string): Todo {
    if (requestKey !== undefined && !/^[A-Za-z0-9_-]{8,128}$/.test(requestKey)) {
      throw new DomainError('올바른 요청 ID가 필요합니다.', 400);
    }
    const canonical = JSON.stringify(Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b))));
    const payloadHash = createHash('sha256').update(canonical).digest('hex');
    return this.db.transaction(tx => {
      if (requestKey) {
        const prior = tx.select().from(todoCreateRequests).where(and(
          eq(todoCreateRequests.userId, this.userId), eq(todoCreateRequests.requestKey, requestKey),
        )).get();
        if (prior) {
          if (prior.payloadHash !== payloadHash) throw new DomainError('이미 사용한 요청 ID로 다른 내용을 저장할 수 없습니다.', 409);
          return prior.response;
        }
      }
      const timestamp = this.now().toISOString();
      // A reflection action has an explicit origin; ordinary same-title TODOs remain independent.
      const linked = data.sourceRetro ? tx.select().from(todos).where(and(
        eq(todos.userId, this.userId), eq(todos.title, data.title), eq(todos.scope, data.scope), eq(todos.scopeKey, data.scopeKey),
        sql`json_extract(${todos.sourceRetro}, '$.type') = ${data.sourceRetro.type}`,
        sql`json_extract(${todos.sourceRetro}, '$.dateOrWeek') = ${data.sourceRetro.dateOrWeek}`,
      )).get() as Todo | undefined : undefined;
      const row: Todo = linked ?? { ...data, id: newId(), userId: this.userId, createdAt: timestamp, updatedAt: timestamp,
        completedAt: data.status === 'done' ? timestamp : null, repeatGenerated: false };
      if (!linked) tx.insert(todos).values(row).run();
      if (requestKey) tx.insert(todoCreateRequests).values({
        userId: this.userId, requestKey, payloadHash, response: row, createdAt: timestamp,
      }).run();
      return row;
    }, { behavior: 'immediate' });
  }

  update(id: string, patch: Partial<NewTodo>, toggle = false): Todo | null {
    return this.db.transaction(tx => {
      const predicate = and(eq(todos.userId, this.userId), eq(todos.id, id));
      const existing = tx.select().from(todos).where(predicate).get() as Todo | undefined;
      if (!existing) return null;
      const timestamp = this.now().toISOString();
      const row = { ...existing, ...stripUndefined(patch), updatedAt: timestamp };
      if (toggle) row.status = existing.status === 'done' ? 'pending' : 'done';
      if (row.status !== existing.status) row.completedAt = row.status === 'done' ? timestamp : null;
      if (row.status === 'done' && existing.status !== 'done' && row.repeatRule && !existing.repeatGenerated) {
        const completedDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(this.now());
        const date = nextRepeatDate(row.scopeKey, row.repeatRule, completedDate);
        if (!isDate(date)) throw new DomainError('다음 반복 날짜를 만들 수 없습니다.', 400);
        const last = tx.select({ order: max(todos.order) }).from(todos).where(and(
          eq(todos.userId, this.userId), eq(todos.scope, 'day'), eq(todos.scopeKey, date),
        )).get()?.order ?? -1;
        const next: Todo = { ...row, id: newId(), scope: 'day', scopeKey: date, status: 'pending', order: last + 1,
          repeatGenerated: false, completedAt: null, createdAt: timestamp };
        // Deleting a linked goal/category must not copy a dangling reference forward.
        if (next.categoryId && !tx.select().from(categories).where(and(eq(categories.id, next.categoryId), eq(categories.userId, this.userId))).get()) next.categoryId = null;
        if (next.parentGoalId && !tx.select().from(goals).where(and(eq(goals.id, next.parentGoalId), eq(goals.userId, this.userId))).get()) next.parentGoalId = null;
        tx.insert(todos).values(next).run();
        row.repeatGenerated = true;
      }
      tx.update(todos).set(row).where(predicate).run();
      return row;
    }, { behavior: 'immediate' });
  }

  remove(id: string): TodoDeleteResult {
    return this.db.transaction(tx => {
      const timestamp = this.now();
      tx.delete(todoTrash).where(lte(todoTrash.expiresAt, timestamp.toISOString())).run();
      const predicate = and(eq(todos.userId, this.userId), eq(todos.id, id));
      const row = tx.select().from(todos).where(predicate).get() as Todo | undefined;
      if (!row) {
        // A retry after a lost DELETE response can still offer the same undo.
        const prior = tx.select().from(todoTrash).where(and(eq(todoTrash.userId, this.userId), eq(todoTrash.id, id))).get();
        return prior ? { ok: true, undo: { id, expiresAt: prior.expiresAt } } : { ok: true };
      }
      const expiresAt = new Date(timestamp.getTime() + TODO_UNDO_MS).toISOString();
      tx.insert(todoTrash).values({ id, userId: this.userId, snapshot: row, expiresAt }).run();
      tx.delete(todos).where(predicate).run();
      return { ok: true, undo: { id, expiresAt } };
    }, { behavior: 'immediate' });
  }

  restore(id: string): Todo {
    return this.db.transaction(tx => {
      const predicate = and(eq(todoTrash.userId, this.userId), eq(todoTrash.id, id));
      const deleted = tx.select().from(todoTrash).where(predicate).get();
      if (!deleted) {
        const restored = tx.select().from(todos).where(and(eq(todos.userId, this.userId), eq(todos.id, id))).get();
        if (restored) return restored as Todo;
        throw new DomainError('복원할 할 일을 찾을 수 없습니다.', 404);
      }
      if (deleted.expiresAt <= this.now().toISOString()) throw new DomainError('삭제 취소 시간이 지났습니다.', 410);
      if (tx.select({ id: todos.id }).from(todos).where(eq(todos.id, id)).get()) throw new DomainError('같은 ID의 할 일이 이미 있습니다.', 409);
      const row = { ...deleted.snapshot, updatedAt: this.now().toISOString() };
      // A category/goal may have been deleted while the undo was available.
      if (row.categoryId && !tx.select({ id: categories.id }).from(categories).where(and(eq(categories.id, row.categoryId), eq(categories.userId, this.userId))).get()) row.categoryId = null;
      if (row.parentGoalId && !tx.select({ id: goals.id }).from(goals).where(and(eq(goals.id, row.parentGoalId), eq(goals.userId, this.userId))).get()) row.parentGoalId = null;
      tx.insert(todos).values(row).run();
      tx.delete(todoTrash).where(predicate).run();
      return row;
    }, { behavior: 'immediate' });
  }

  rollover(date: string, ids: string[]): TodoRolloverResult {
    if (!isDate(date) || !ids.length || ids.length > 500 || ids.some(id => typeof id !== 'string' || !id)) throw new DomainError('이월할 날짜와 할 일을 확인해 주세요.', 400);
    const target = format(addDays(parseISO(date), 1), 'yyyy-MM-dd');
    if (!isDate(target)) throw new DomainError('다음 날짜로 이동할 수 없습니다.', 400);
    return this.db.transaction(tx => {
      const selected = tx.select().from(todos).where(and(
        eq(todos.userId, this.userId), eq(todos.scope, 'day'), eq(todos.scopeKey, date),
        inArray(todos.status, ['pending', 'postponed']), inArray(todos.id, [...new Set(ids)]),
      )).orderBy(asc(todos.order), asc(todos.id)).all();
      const last = tx.select({ order: max(todos.order) }).from(todos).where(and(
        eq(todos.userId, this.userId), eq(todos.scope, 'day'), eq(todos.scopeKey, target),
      )).get()?.order ?? -1;
      selected.forEach((row, index) => tx.update(todos).set({ scopeKey: target, order: last + index + 1, updatedAt: this.now().toISOString() })
        .where(and(eq(todos.userId, this.userId), eq(todos.id, row.id))).run());
      return { moved: selected.length, date: target };
    }, { behavior: 'immediate' });
  }
}
