import type { Todo, TodoStatus } from './types';
import { isDate } from './validation/mutations';

export interface GoogleTaskResource {
  id: string;
  title?: string;
  notes?: string;
  status?: 'needsAction' | 'completed';
  due?: string;
  completed?: string;
  updated?: string;
  deleted?: boolean;
  hidden?: boolean;
  parent?: string;
}

export interface GoogleTaskWriteBody {
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string | null;
}

export function googleDueToDate(due?: string | null): string | null {
  if (!due || typeof due !== 'string') return null;
  const candidate = due.trim().slice(0, 10);
  return isDate(candidate) ? candidate : null;
}

export function dateToGoogleDue(date: string): string {
  return `${date}T00:00:00.000Z`;
}

export function isTodoEligibleForGoogleTasks(
  todo: Pick<Todo, 'scope' | 'status'>,
): boolean {
  return (todo.scope === 'inbox' || todo.scope === 'day') && todo.status !== 'cancelled';
}

export function resolveTargetTaskListId(
  todo: Pick<Todo, 'projectId'>,
  conn: {
    tasksProjectMap: Record<string, string>;
    tasksDefaultListId: string | null;
    tasksSelectedListIds: string[];
  },
): string | null {
  if (todo.projectId) {
    const selectedSet = new Set(conn.tasksSelectedListIds);
    let fallbackMatch: string | null = null;
    for (const [listId, projectId] of Object.entries(conn.tasksProjectMap)) {
      if (projectId !== todo.projectId) continue;
      if (selectedSet.has(listId)) return listId;
      if (!fallbackMatch) fallbackMatch = listId;
    }
    if (fallbackMatch) return fallbackMatch;
  }
  return conn.tasksDefaultListId || conn.tasksSelectedListIds[0] || null;
}

export function todoToGoogleTaskBody(
  todo: Pick<Todo, 'title' | 'note' | 'status' | 'scope' | 'scopeKey'>,
): GoogleTaskWriteBody {
  const due =
    todo.scope === 'day' && isDate(todo.scopeKey) ? dateToGoogleDue(todo.scopeKey) : null;
  return {
    title: todo.title.trim() || '(제목 없음)',
    notes: todo.note ?? '',
    status: todo.status === 'done' ? 'completed' : 'needsAction',
    due,
  };
}

export function googleTaskToTodoFields(
  task: GoogleTaskResource,
  existing?: Pick<Todo, 'status' | 'projectId'> | null,
  mappedProjectId?: string | null,
): {
  title: string;
  note: string | null;
  status: TodoStatus;
  scope: 'inbox' | 'day';
  scopeKey: string;
  projectId: string | null;
  googleTaskUpdatedAt: string | null;
  completedAt?: string;
} {
  const dueDate = googleDueToDate(task.due);
  const scope: 'inbox' | 'day' = dueDate ? 'day' : 'inbox';
  const scopeKey = dueDate ?? 'inbox';

  let status: TodoStatus;
  if (task.status === 'completed') {
    status = 'done';
  } else if (existing?.status === 'postponed' || existing?.status === 'delegated') {
    status = existing.status;
  } else {
    status = 'pending';
  }

  const note = task.notes?.trim() ? task.notes.trim() : null;
  const projectId = mappedProjectId || existing?.projectId || null;

  return {
    title: task.title?.trim() || '(제목 없음)',
    note,
    status,
    scope,
    scopeKey,
    projectId,
    ...(status === 'done' && task.completed && Number.isFinite(Date.parse(task.completed))
      ? { completedAt: new Date(task.completed).toISOString() } : {}),
    googleTaskUpdatedAt: task.updated ?? null,
  };
}
