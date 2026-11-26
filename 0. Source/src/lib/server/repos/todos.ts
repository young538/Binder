import 'server-only';
import { and, asc, between, eq, inArray, isNotNull, isNull, lte, max, sql } from 'drizzle-orm';
import { goals, googleCalendarConnections, googleTaskDeletions, projects, todos } from '../db/schema';
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
      completedAt?: string;
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
        const actions = new TodoActions(tx, this.userId, now);
        const updated = actions.update(existing.id, {
          ...input,
          repeatRule: input.scope === 'day' ? existing.repeatRule : null,
          parentGoalId: existing.parentGoalId ?? inheritedGoalId ?? null,
        });
        if (!updated) throw new Error('Google task disappeared during sync');
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
        completedAt: input.status === 'done' ? input.completedAt ?? timestamp : null,
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

  pendingGoogleDeletions(email: string) {
    return this.database.select().from(googleTaskDeletions)
      .where(and(eq(googleTaskDeletions.userId, this.userId), eq(googleTaskDeletions.googleEmail, email))).all();
  }

  googleDeletionReady(job: typeof googleTaskDeletions.$inferSelect, now: string): boolean {
    return !!this.database.select({ id: googleTaskDeletions.todoId }).from(googleTaskDeletions).where(and(
      eq(googleTaskDeletions.userId, this.userId), eq(googleTaskDeletions.googleEmail, job.googleEmail),
      eq(googleTaskDeletions.listId, job.listId), eq(googleTaskDeletions.taskId, job.taskId),
      eq(googleTaskDeletions.notBefore, job.notBefore), lte(googleTaskDeletions.notBefore, now),
    )).get();
  }

  completeGoogleDeletion(job: typeof googleTaskDeletions.$inferSelect): void {
    this.database.transaction(tx => {
      const removed = tx.delete(googleTaskDeletions).where(and(eq(googleTaskDeletions.userId, this.userId),
        eq(googleTaskDeletions.googleEmail, job.googleEmail), eq(googleTaskDeletions.listId, job.listId),
        eq(googleTaskDeletions.taskId, job.taskId), eq(googleTaskDeletions.notBefore, job.notBefore))).run();
      if (removed.changes) tx.update(googleCalendarConnections).set({ taskDeletionRevision: sql`task_deletion_revision + 1` })
        .where(eq(googleCalendarConnections.userId, this.userId)).run();
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
