import 'server-only';
import {
  googleTaskToTodoFields,
  isTodoEligibleForGoogleTasks,
  resolveTargetTaskListId,
  todoToGoogleTaskBody,
  type GoogleTaskResource,
} from '@/lib/googleTasks';
import type { GoogleTasksSyncResult, Todo } from '@/lib/types';
import { UserRepositories } from '../repos';
import { GoogleApiError, GoogleCalendarApiClient } from './client';
import { getGoogleOAuthConfig, type GoogleOAuthConfig } from './config';
import { ensureGoogleAccessToken, GoogleSyncNotConnectedError } from './syncService';

const OLD_COMPLETED_CUTOFF_MS = 30 * 24 * 60 * 60 * 1000;

function formatTasksError(err: unknown): string {
  if (err instanceof GoogleApiError && err.status === 403) {
    return "Google Tasks 권한이 필요합니다. 설정에서 '계정 다시 연결'을 눌러 한 번 승인해 주세요.";
  }
  const raw = err instanceof Error ? err.message : 'Google Tasks 동기화에 실패했습니다.';
  if (raw.includes('insufficient') || raw.includes('Tasks API')) {
    return "Google Tasks 권한이 필요합니다. 설정에서 '계정 다시 연결'을 눌러 한 번 승인해 주세요.";
  }
  return raw;
}

function todoFieldsMatchRemote(
  existing: Todo,
  remoteFields: ReturnType<typeof googleTaskToTodoFields>,
): boolean {
  const existingNote = existing.note?.trim() || null;
  const normalizedExistingStatus = existing.status === 'done' ? 'done' : 'pending';
  const normalizedRemoteStatus = remoteFields.status === 'done' ? 'done' : 'pending';
  return (
    existing.title === remoteFields.title &&
    existingNote === remoteFields.note &&
    normalizedExistingStatus === normalizedRemoteStatus &&
    existing.scope === remoteFields.scope &&
    existing.scopeKey === remoteFields.scopeKey &&
    (existing.projectId ?? null) === remoteFields.projectId
  );
}

function shouldSkipOldCompletedUnseen(task: GoogleTaskResource, nowMs: number): boolean {
  if (task.status !== 'completed') return false;
  const ts = Date.parse(task.completed ?? task.updated ?? '');
  if (!Number.isFinite(ts)) return false;
  return nowMs - ts > OLD_COMPLETED_CUTOFF_MS;
}

export class GoogleTasksSyncService {
  constructor(
    private readonly repos: UserRepositories,
    private readonly apiClient: GoogleCalendarApiClient,
    private readonly config: GoogleOAuthConfig,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async syncNow(): Promise<GoogleTasksSyncResult> {
    const conn = this.repos.googleCalendar.get();
    if (!conn) throw new GoogleSyncNotConnectedError();

    try {
      const accessToken = await ensureGoogleAccessToken(
        this.repos,
        this.apiClient,
        this.config,
        conn,
        this.now,
      );
      const deletions = this.repos.todos.pendingGoogleDeletions(conn.googleEmail);
      let deleteFailure: Error | undefined;
      if (conn.tasksAutoPush) {
        for (const job of deletions) {
          if (!this.repos.todos.googleDeletionReady(job, this.now().toISOString())) continue;
          try {
            await this.apiClient.deleteTask(accessToken, job.listId, job.taskId);
            this.repos.todos.completeGoogleDeletion(job);
          } catch (error) {
            deleteFailure = error instanceof Error ? error : new Error('Google 할 일 삭제 동기화 실패');
          }
        }
      }
      const taskLists = await this.apiClient.listTaskLists(accessToken);
      if (taskLists.length > 0) {
        this.repos.googleCalendar.updateTaskListMeta(taskLists);
      }

      const refreshedConn = this.repos.googleCalendar.get() ?? conn;
      const effectiveMeta = taskLists.length > 0 ? taskLists : refreshedConn.tasksListMeta;
      const defaultList = effectiveMeta.find(l => l.isDefault) ?? effectiveMeta[0];

      const targetListIds =
        refreshedConn.tasksSelectedListIds.length > 0
          ? refreshedConn.tasksSelectedListIds
          : defaultList
            ? [defaultList.id]
            : [];

      const nowMs = this.now().getTime();
      const prevSyncMs = refreshedConn.tasksLastSyncedAt
        ? Date.parse(refreshedConn.tasksLastSyncedAt)
        : NaN;

      let pulledCreated = 0;
      let pulledUpdated = 0;
      let pulledDeleted = 0;
      let pushedCreated = 0;
      let pushedUpdated = 0;
      let listsSynced = 0;

      for (const listId of targetListIds) {
        const version = this.repos.googleCalendar.get();
        const checkVersion = () => {
          const latest = this.repos.googleCalendar.get();
          if (!version || latest?.googleEmail !== conn.googleEmail || latest.taskDeletionRevision !== version.taskDeletionRevision) {
            throw new Error('할 일 변경 중입니다. 다음 동기화에서 다시 조회합니다.');
          }
        };
        const remoteTasks = await this.apiClient.listTasks(accessToken, listId);
        checkVersion();
        const pending = this.repos.todos.pendingGoogleDeletions(conn.googleEmail);
        const deletedIds = new Set([...deletions, ...pending].filter(job => job.listId === listId).map(job => job.taskId));
        const existingRows = this.repos.todos.listSyncedByTaskList(listId);
        const byTaskId = new Map<string, Todo>();
        for (const row of existingRows) {
          if (row.googleTaskId) byTaskId.set(row.googleTaskId, row);
        }

        const seenIds = new Set(deletedIds);
        const mappedProjectId = refreshedConn.tasksProjectMap[listId] ?? null;

        for (const task of remoteTasks) {
          if (deletedIds.has(task.id)) continue;
          if (task.deleted) {
            seenIds.add(task.id);
            const existing = byTaskId.get(task.id);
            if (existing) {
              this.repos.todos.deleteGoogleSyncedTodo(existing.id);
              pulledDeleted++;
            }
            continue;
          }

          seenIds.add(task.id);
          const existing = byTaskId.get(task.id);

          if (!existing) {
            if (shouldSkipOldCompletedUnseen(task, nowMs)) continue;
            const fields = googleTaskToTodoFields(task, null, mappedProjectId);
            this.repos.todos.upsertFromGoogleTask(
              {
                googleTaskListId: listId,
                googleTaskId: task.id,
                ...fields,
              },
              this.now,
            );
            pulledCreated++;
            continue;
          }

          const remoteFields = googleTaskToTodoFields(task, existing, mappedProjectId);
          if (todoFieldsMatchRemote(existing, remoteFields)) {
            if (task.updated && task.updated !== existing.googleTaskUpdatedAt) {
              this.repos.todos.setGoogleTaskLink(existing.id, {
                googleTaskListId: listId,
                googleTaskId: task.id,
                googleTaskUpdatedAt: task.updated,
              });
            }
            continue;
          }

          const localUpdatedMs = Date.parse(existing.updatedAt);
          const remoteUpdatedMs = Date.parse(task.updated ?? '');
          const localChanged =
            Number.isFinite(localUpdatedMs) &&
            Number.isFinite(prevSyncMs) &&
            localUpdatedMs > prevSyncMs;
          const remoteChanged = Boolean(task.updated) && task.updated !== existing.googleTaskUpdatedAt;

          const pushLocal =
            refreshedConn.tasksAutoPush &&
            isTodoEligibleForGoogleTasks(existing) &&
            localChanged &&
            (!remoteChanged || !Number.isFinite(remoteUpdatedMs) || localUpdatedMs > remoteUpdatedMs);

          if (pushLocal) {
            const updatedRemote = await this.apiClient.updateTask(
              accessToken,
              listId,
              task.id,
              todoToGoogleTaskBody(existing),
            );
            checkVersion();
            this.repos.todos.setGoogleTaskLink(existing.id, {
              googleTaskListId: listId,
              googleTaskId: updatedRemote.id || task.id,
              googleTaskUpdatedAt: updatedRemote.updated ?? task.updated ?? null,
            });
            pushedUpdated++;
          } else {
            this.repos.todos.upsertFromGoogleTask(
              {
                googleTaskListId: listId,
                googleTaskId: task.id,
                ...remoteFields,
              },
              this.now,
            );
            pulledUpdated++;
          }
        }

        for (const existing of existingRows) {
          if (existing.googleTaskId && !seenIds.has(existing.googleTaskId)) {
            this.repos.todos.deleteGoogleSyncedTodo(existing.id);
            pulledDeleted++;
          }
        }

        listsSynced++;
      }

      if (refreshedConn.tasksAutoPush) {
        const unpushed = this.repos.todos.listUnpushedForGoogleTasks();
        for (const todo of unpushed) {
          const targetListId = resolveTargetTaskListId(todo, refreshedConn);
          if (!targetListId) continue;
          const created = await this.apiClient.createTask(
            accessToken,
            targetListId,
            todoToGoogleTaskBody(todo),
          );
          this.repos.todos.setGoogleTaskLink(todo.id, {
            googleTaskListId: targetListId,
            googleTaskId: created.id,
            googleTaskUpdatedAt: created.updated ?? null,
          });
          pushedCreated++;
        }
      }

      if (deleteFailure) throw deleteFailure;
      const syncedAt = this.now().toISOString();
      this.repos.googleCalendar.recordTasksSyncStatus({
        tasksLastSyncedAt: syncedAt,
        tasksLastSyncError: null,
      });

      return {
        pulledCreated,
        pulledUpdated,
        pulledDeleted,
        pushedCreated,
        pushedUpdated,
        listsSynced,
        syncedAt,
      };
    } catch (error) {
      const friendly = formatTasksError(error);
      this.repos.googleCalendar.recordTasksSyncStatus({ tasksLastSyncError: friendly });
      throw error;
    }
  }

  async pushCreatedTodo(todo: Todo): Promise<Todo> {
    if (!isTodoEligibleForGoogleTasks(todo) || todo.googleTaskId) return todo;
    const conn = this.repos.googleCalendar.get();
    if (!conn || !conn.tasksSyncEnabled || !conn.tasksAutoPush) return todo;

    const targetListId = resolveTargetTaskListId(todo, conn);
    if (!targetListId) return todo;

    try {
      const accessToken = await ensureGoogleAccessToken(
        this.repos,
        this.apiClient,
        this.config,
        conn,
        this.now,
      );
      const created = await this.apiClient.createTask(
        accessToken,
        targetListId,
        todoToGoogleTaskBody(todo),
      );
      const linked = this.repos.todos.setGoogleTaskLink(todo.id, {
        googleTaskListId: targetListId,
        googleTaskId: created.id,
        googleTaskUpdatedAt: created.updated ?? null,
      });
      this.repos.googleCalendar.recordTasksSyncStatus({ tasksLastSyncError: null });
      return linked ?? todo;
    } catch (error) {
      this.repos.googleCalendar.recordTasksSyncStatus({
        tasksLastSyncError: formatTasksError(error),
      });
      return todo;
    }
  }

  async pushUpdatedTodo(todo: Todo): Promise<Todo> {
    const conn = this.repos.googleCalendar.get();
    if (!conn || !conn.tasksSyncEnabled || !conn.tasksAutoPush) return todo;

    if (!isTodoEligibleForGoogleTasks(todo)) {
      if (todo.googleTaskListId && todo.googleTaskId) {
        try {
          const accessToken = await ensureGoogleAccessToken(
            this.repos,
            this.apiClient,
            this.config,
            conn,
            this.now,
          );
          await this.apiClient.deleteTask(accessToken, todo.googleTaskListId, todo.googleTaskId);
          const cleared = this.repos.todos.setGoogleTaskLink(todo.id, {
            googleTaskListId: null,
            googleTaskId: null,
            googleTaskUpdatedAt: null,
          });
          this.repos.googleCalendar.recordTasksSyncStatus({ tasksLastSyncError: null });
          return cleared ?? todo;
        } catch (error) {
          this.repos.googleCalendar.recordTasksSyncStatus({
            tasksLastSyncError: formatTasksError(error),
          });
        }
      }
      return todo;
    }

    if (!todo.googleTaskId || !todo.googleTaskListId) {
      return this.pushCreatedTodo(todo);
    }

    try {
      const accessToken = await ensureGoogleAccessToken(
        this.repos,
        this.apiClient,
        this.config,
        conn,
        this.now,
      );
      const targetListId = resolveTargetTaskListId(todo, conn) ?? todo.googleTaskListId;

      if (targetListId !== todo.googleTaskListId) {
        const oldListId = todo.googleTaskListId;
        const oldTaskId = todo.googleTaskId;
        const created = await this.apiClient.createTask(
          accessToken,
          targetListId,
          todoToGoogleTaskBody(todo),
        );
        const moved = this.repos.todos.setGoogleTaskLink(todo.id, {
          googleTaskListId: targetListId,
          googleTaskId: created.id,
          googleTaskUpdatedAt: created.updated ?? null,
        });
        await this.apiClient.deleteTask(accessToken, oldListId, oldTaskId).catch(() => {});
        this.repos.googleCalendar.recordTasksSyncStatus({ tasksLastSyncError: null });
        return moved ?? todo;
      }

      const updated = await this.apiClient.updateTask(
        accessToken,
        todo.googleTaskListId,
        todo.googleTaskId,
        todoToGoogleTaskBody(todo),
      );
      const linked = this.repos.todos.setGoogleTaskLink(todo.id, {
        googleTaskListId: todo.googleTaskListId,
        googleTaskId: updated.id || todo.googleTaskId,
        googleTaskUpdatedAt: updated.updated ?? todo.googleTaskUpdatedAt ?? null,
      });
      this.repos.googleCalendar.recordTasksSyncStatus({ tasksLastSyncError: null });
      return linked ?? todo;
    } catch (error) {
      this.repos.googleCalendar.recordTasksSyncStatus({
        tasksLastSyncError: formatTasksError(error),
      });
      return todo;
    }
  }

}

export function createGoogleTasksSyncService(
  repos: UserRepositories,
  req?: Request,
): GoogleTasksSyncService {
  return new GoogleTasksSyncService(
    repos,
    new GoogleCalendarApiClient(),
    getGoogleOAuthConfig(req),
  );
}
