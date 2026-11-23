import 'server-only';
import { and, asc, between, eq, inArray, isNotNull, isNull, max } from 'drizzle-orm';
import { getDb } from '../db/client';
import { goals, projects, todos } from '../db/schema';
import { Todo, TodoScope, TodoStatus } from '@/lib/types';
import { TodoActions } from '../todos/actions';
import type { TodoDeleteResult, TodoRolloverResult } from '@/lib/todos/contracts';
import type { BinderDatabase } from '../db/connection';
import { newId } from '@/lib/utils/id';

/** User-scoped todos operations; accepts an isolated database for tests. */
export class TodoRepository {
  constructor(private readonly database: BinderDatabase, private readonly userId: string) { }

  async list(filters?: {
    scope?: TodoScope;
    scopeKey?: string;
    parentGoalId?: string;
    projectId?: string;
  }): Promise<Todo[]> {
    const userId = this.userId;
    const db = this.database;
    const conds = [eq(todos.userId, userId)];
    if (filters?.scope) conds.push(eq(todos.scope, filters.scope));
    if (filters?.scopeKey) conds.push(eq(todos.scopeKey, filters.scopeKey));
    if (filters?.parentGoalId) conds.push(eq(todos.parentGoalId, filters.parentGoalId));
    if (filters?.projectId) conds.push(eq(todos.projectId, filters.projectId));
    const rows = await db
      .select()
      .from(todos)
      .where(and(...conds))
      .orderBy(asc(todos.order))
      .all();
    return rows as Todo[];
  }

  async listDaysInRange(startDate: string, endDate: string): Promise<Todo[]> {
    const userId = this.userId;
    const db = this.database;
    const rows = await db
      .select()
      .from(todos)
      .where(
        and(
          eq(todos.userId, userId),
          eq(todos.scope, 'day'),
          between(todos.scopeKey, startDate, endDate)
        )
      )
      .orderBy(asc(todos.scopeKey), asc(todos.order))
      .all();
    return rows as Todo[];
  }

  async create(data: Omit<Todo, 'id' | 'userId' | 'createdAt' | 'updatedAt'>, requestKey?: string): Promise<Todo> {
    return new TodoActions(this.database, this.userId).create(data, requestKey);
  }

  async update(id: string, patch: Partial<Omit<Todo, 'id' | 'userId' | 'createdAt'>>): Promise<Todo | null> {
    return new TodoActions(this.database, this.userId).update(id, patch);
  }

  async delete(id: string): Promise<TodoDeleteResult> {
    return new TodoActions(this.database, this.userId).remove(id);
  }

  async restore(id: string): Promise<Todo> {
    return new TodoActions(this.database, this.userId).restore(id);
  }

  async rollover(date: string, ids: string[]): Promise<TodoRolloverResult> {
    return new TodoActions(this.database, this.userId).rollover(date, ids);
  }

  async setStatus(id: string, status: TodoStatus): Promise<Todo | null> {
    return this.update(id, { status });
  }

  async toggleDone(id: string): Promise<Todo | null> {
    return new TodoActions(this.database, this.userId).update(id, {}, true);
  }

  getById(id: string): Todo | null {
    const row = this.database
      .select()
      .from(todos)
      .where(and(eq(todos.userId, this.userId), eq(todos.id, id)))
      .get();
    return (row as Todo | undefined) ?? null;
  }

  listSyncedByTaskList(taskListId: string): Todo[] {
    return this.database
      .select()
      .from(todos)
      .where(
        and(
          eq(todos.userId, this.userId),
          eq(todos.googleTaskListId, taskListId),
          isNotNull(todos.googleTaskId),
        ),
      )
      .orderBy(asc(todos.order), asc(todos.id))
      .all() as Todo[];
  }

  listUnpushedForGoogleTasks(): Todo[] {
    return this.database
      .select()
      .from(todos)
      .where(
        and(
          eq(todos.userId, this.userId),
          isNull(todos.googleTaskId),
          inArray(todos.scope, ['inbox', 'day']),
          inArray(todos.status, ['pending', 'postponed']),
        ),
      )
      .orderBy(asc(todos.scope), asc(todos.scopeKey), asc(todos.order), asc(todos.id))
      .all() as Todo[];
  }

  setGoogleTaskLink(
    id: string,
    link: {
      googleTaskListId: string | null;
      googleTaskId: string | null;
      googleTaskUpdatedAt: string | null;
    },
  ): Todo | null {
    const predicate = and(eq(todos.userId, this.userId), eq(todos.id, id));
    const existing = this.database.select().from(todos).where(predicate).get() as Todo | undefined;
    if (!existing) return null;
    // Do not advance updatedAt here so subsequent delta syncs don't misread link storage as a newer local edit.
    return this.database
      .update(todos)
      .set({
        googleTaskListId: link.googleTaskListId,
        googleTaskId: link.googleTaskId,
        googleTaskUpdatedAt: link.googleTaskUpdatedAt,
      })
      .where(predicate)
      .returning()
      .get() as Todo;
  }

  upsertFromGoogleTask(
    input: {
      googleTaskListId: string;
      googleTaskId: string;
      googleTaskUpdatedAt: string | null;
      title: string;
      note: string | null;
      status: TodoStatus;
      scope: 'inbox' | 'day';
      scopeKey: string;
      projectId: string | null;
    },
    now: () => Date = () => new Date(),
  ): { action: 'created' | 'updated'; todo: Todo } {
    return this.database.transaction(tx => {
      const existing = tx
        .select()
        .from(todos)
        .where(
          and(
            eq(todos.userId, this.userId),
            eq(todos.googleTaskListId, input.googleTaskListId),
            eq(todos.googleTaskId, input.googleTaskId),
          ),
        )
        .get() as Todo | undefined;

      const timestamp = now().toISOString();

      let inheritedGoalId: string | null | undefined;
      if (input.projectId) {
        const proj = tx
          .select({ goalId: projects.goalId })
          .from(projects)
          .where(and(eq(projects.userId, this.userId), eq(projects.id, input.projectId)))
          .get();
        if (proj?.goalId) {
          const g = tx
            .select({ id: goals.id })
            .from(goals)
            .where(and(eq(goals.userId, this.userId), eq(goals.id, proj.goalId)))
            .get();
          if (g) inheritedGoalId = proj.goalId;
        }
      }

      if (existing) {
        const nextStatus = input.status;
        const completedAt =
          nextStatus === 'done' ? (existing.completedAt ?? timestamp) : null;
        const nextParentGoalId =
          existing.parentGoalId ?? (inheritedGoalId !== undefined ? inheritedGoalId : null);

        const updated = tx
          .update(todos)
          .set({
            title: input.title,
            note: input.note,
            status: nextStatus,
            scope: input.scope,
            scopeKey: input.scopeKey,
            projectId: input.projectId,
            parentGoalId: nextParentGoalId,
            completedAt,
            googleTaskUpdatedAt: input.googleTaskUpdatedAt,
            updatedAt: timestamp,
          })
          .where(and(eq(todos.userId, this.userId), eq(todos.id, existing.id)))
          .returning()
          .get() as Todo;
        return { action: 'updated', todo: updated };
      }

      const lastOrder =
        tx
          .select({ order: max(todos.order) })
          .from(todos)
          .where(
            and(
              eq(todos.userId, this.userId),
              eq(todos.scope, input.scope),
              eq(todos.scopeKey, input.scopeKey),
            ),
          )
          .get()?.order ?? -1;

      const inserted: Todo = {
        id: newId(),
        userId: this.userId,
        title: input.title,
        scope: input.scope,
        scopeKey: input.scopeKey,
        status: input.status,
        order: lastOrder + 1,
        parentGoalId: inheritedGoalId ?? null,
        projectId: input.projectId,
        priority: null,
        categoryId: null,
        note: input.note,
        repeatRule: null,
        sourceRetro: null,
        completedAt: input.status === 'done' ? timestamp : null,
        repeatGenerated: false,
        googleTaskListId: input.googleTaskListId,
        googleTaskId: input.googleTaskId,
        googleTaskUpdatedAt: input.googleTaskUpdatedAt,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      tx.insert(todos).values(inserted).run();
      return { action: 'created', todo: inserted };
    }, { behavior: 'immediate' });
  }

  deleteGoogleSyncedTodo(id: string): void {
    this.database
      .delete(todos)
      .where(
        and(
          eq(todos.userId, this.userId),
          eq(todos.id, id),
          isNotNull(todos.googleTaskId),
        ),
      )
      .run();
  }

  deleteGoogleSyncedTodos(): number {
    const res = this.database
      .delete(todos)
      .where(and(eq(todos.userId, this.userId), isNotNull(todos.googleTaskId)))
      .run();
    return res.changes;
  }
}

// Compatibility functions for existing callers. New services can inject the repository.
export const listTodos = async (userId: string, filters?: {
  scope?: TodoScope;
  scopeKey?: string;
  parentGoalId?: string;
}): Promise<Todo[]> =>
  new TodoRepository(getDb(), userId).list(filters);

export const listDayTodosInRange = async (userId: string, startDate: string, endDate: string): Promise<Todo[]> =>
  new TodoRepository(getDb(), userId).listDaysInRange(startDate, endDate);

export const createTodo = async (userId: string, data: Omit<Todo, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Todo> =>
  new TodoRepository(getDb(), userId).create(data);

export const updateTodo = async (userId: string, id: string, patch: Partial<Omit<Todo, 'id' | 'userId' | 'createdAt'>>): Promise<Todo | null> =>
  new TodoRepository(getDb(), userId).update(id, patch);

export const deleteTodo = async (userId: string, id: string): Promise<void> => {
  await new TodoRepository(getDb(), userId).delete(id);
};

export const setTodoStatus = async (userId: string, id: string, status: TodoStatus): Promise<Todo | null> =>
  new TodoRepository(getDb(), userId).setStatus(id, status);

export const toggleTodoDone = async (userId: string, id: string): Promise<Todo | null> =>
  new TodoRepository(getDb(), userId).toggleDone(id);
