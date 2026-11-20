import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { Project, ProjectStatus, TimeBlock, Todo } from './types';

export interface ProjectOverviewItem {
  project: Project;
  todos: Todo[];
  totalTodos: number;
  doneTodos: number;
  activeTodos: number;
  actualMinutes: number;
  needsNextAction: boolean;
}

export interface ProjectOverviewResponse {
  projects: ProjectOverviewItem[];
}

const STATUS_RANK: Record<Todo['status'], number> = {
  pending: 0,
  postponed: 1,
  delegated: 2,
  done: 3,
  cancelled: 4,
};

export function sortProjectTodos(items: Todo[]): Todo[] {
  return [...items].sort((a, b) => {
    const statusDiff = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (statusDiff !== 0) return statusDiff;
    if (a.scope !== b.scope) {
      if (a.scope === 'day') return -1;
      if (b.scope === 'day') return 1;
    }
    if (a.scopeKey !== b.scopeKey) return a.scopeKey.localeCompare(b.scopeKey);
    if (a.order !== b.order) return a.order - b.order;
    return a.id.localeCompare(b.id);
  });
}

export function buildProjectOverview(
  projects: Project[],
  todos: Todo[],
  blocks: TimeBlock[],
): ProjectOverviewItem[] {
  const todosByProject = new Map<string, Todo[]>();
  for (const todo of todos) {
    if (!todo.projectId) continue;
    const list = todosByProject.get(todo.projectId);
    if (list) list.push(todo);
    else todosByProject.set(todo.projectId, [todo]);
  }

  const actualByTodo = new Map<string, number>();
  const actualByProject = new Map<string, number>();
  for (const block of blocks) {
    if (block.kind !== 'actual') continue;
    const dur = Math.max(0, block.endMin - block.startMin);
    if (block.projectId) {
      actualByProject.set(block.projectId, (actualByProject.get(block.projectId) ?? 0) + dur);
    } else if (block.todoId) {
      actualByTodo.set(block.todoId, (actualByTodo.get(block.todoId) ?? 0) + dur);
    }
  }

  return projects.map(project => {
    const projectTodos = sortProjectTodos(todosByProject.get(project.id) ?? []);
    const activeCount = projectTodos.filter(t => t.status === 'pending' || t.status === 'postponed').length;
    const doneCount = projectTodos.filter(t => t.status === 'done').length;
    const countableTotal = projectTodos.filter(t => t.status !== 'cancelled').length;
    const todoMinutes = projectTodos.reduce((sum, t) => sum + (actualByTodo.get(t.id) ?? 0), 0);
    const actualMinutes = (actualByProject.get(project.id) ?? 0) + todoMinutes;
    return {
      project,
      todos: projectTodos,
      totalTodos: countableTotal,
      doneTodos: doneCount,
      activeTodos: activeCount,
      actualMinutes,
      needsNextAction: project.status === 'active' && activeCount === 0,
    };
  });
}

export interface DeadlineInfo {
  label: string;
  daysLeft: number;
  overdue: boolean;
  urgent: boolean;
}

export function describeDeadline(
  deadline: string | null | undefined,
  today: string,
  status: ProjectStatus,
): DeadlineInfo | null {
  if (!deadline) return null;
  const daysLeft = differenceInCalendarDays(parseISO(deadline), parseISO(today));
  if (status === 'done') {
    return { label: `마감 ${deadline}`, daysLeft, overdue: false, urgent: false };
  }
  if (daysLeft < 0) {
    return { label: `${Math.abs(daysLeft)}일 지남`, daysLeft, overdue: true, urgent: true };
  }
  if (daysLeft === 0) {
    return { label: 'D-Day', daysLeft: 0, overdue: false, urgent: true };
  }
  return {
    label: `D-${daysLeft}`,
    daysLeft,
    overdue: false,
    urgent: daysLeft <= 7,
  };
}
