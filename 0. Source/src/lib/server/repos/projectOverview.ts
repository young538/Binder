import 'server-only';
import { and, asc, eq, getTableColumns, inArray, ne, sql, type SQL } from 'drizzle-orm';
import type { Project, ProjectStatus, Todo } from '@/lib/types';
import type { DatabaseSession } from '../db/connection';
import { projects, timeBlocks, todos } from '../db/schema';

export function listProjectSummaries(db: DatabaseSession, userId: string, status?: ProjectStatus) {
  const scope = and(eq(projects.userId, userId), status ? eq(projects.status, status) : undefined);
  const rows = db.select({
    project: projects,
    totalTodos: sql<number>`count(*) filter (where ${ne(todos.status, 'cancelled')})`,
    doneTodos: sql<number>`count(*) filter (where ${eq(todos.status, 'done')})`,
    activeTodos: sql<number>`count(*) filter (where ${inArray(todos.status, ['pending', 'postponed'])})`,
  }).from(projects)
    .leftJoin(todos, and(eq(todos.projectId, projects.id), eq(todos.userId, userId)))
    .where(scope).groupBy(projects.id)
    .orderBy(asc(projects.order), asc(projects.createdAt), asc(projects.id)).all();

  // A block's explicit project takes precedence over its linked TODO's project.
  const blockProject = sql`coalesce(nullif(${timeBlocks.projectId}, ''), ${todos.projectId})`;
  const minutes = db.select({
    projectId: projects.id,
    minutes: sql<number>`sum(max(0, ${timeBlocks.endMin} - ${timeBlocks.startMin}))`,
  }).from(timeBlocks)
    .leftJoin(todos, and(eq(todos.id, timeBlocks.todoId), eq(todos.userId, userId)))
    .innerJoin(projects, eq(projects.id, blockProject))
    .where(and(scope, eq(timeBlocks.userId, userId), eq(timeBlocks.kind, 'actual')))
    .groupBy(projects.id).all();
  const minutesByProject = new Map(minutes.map(row => [row.projectId, row.minutes]));
  return rows.map(row => ({
    ...row, project: row.project as Project,
    actualMinutes: minutesByProject.get(row.project.id) ?? 0,
    needsNextAction: row.project.status === 'active' && row.activeTodos === 0,
  }));
}

export function listTodosByProject(db: DatabaseSession, userId: string, status?: ProjectStatus, todoFilter?: SQL) {
  const rows = db.select(getTableColumns(todos)).from(todos)
    .innerJoin(projects, eq(projects.id, todos.projectId))
    .where(and(eq(todos.userId, userId), eq(projects.userId, userId),
      status ? eq(projects.status, status) : undefined, todoFilter)).all() as Todo[];
  const byProject = new Map<string, Todo[]>();
  for (const todo of rows) {
    const id = todo.projectId!; // The inner join requires a project.
    const group = byProject.get(id);
    if (group) group.push(todo);
    else byProject.set(id, [todo]);
  }
  return byProject;
}
