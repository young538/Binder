import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { binderNotes, lifeEvents, projects, timeBlocks, todos } from '../db/schema';
import type { Project } from '@/lib/types';
import { sortProjectTodos, type ProjectOverviewResponse } from '@/lib/projects';
import { listProjectSummaries, listTodosByProject } from './projectOverview';
import { newId } from '@/lib/utils/id';
import { stripUndefined } from '../db/patch';
import type { BinderDatabase } from '../db/connection';

type NewProject = Omit<Project, 'id' | 'userId' | 'completedAt' | 'createdAt' | 'updatedAt'>;
type ProjectPatch = Partial<NewProject>;

/** User-scoped project operations; unlinks connected TODOs atomically on deletion. */
export class ProjectRepository {
  constructor(
    private readonly database: BinderDatabase,
    private readonly userId: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(): Promise<Project[]> {
    const rows = this.database
      .select()
      .from(projects)
      .where(eq(projects.userId, this.userId))
      .orderBy(asc(projects.order), asc(projects.createdAt), asc(projects.id))
      .all();
    return rows as Project[];
  }

  async create(data: NewProject): Promise<Project> {
    const timestamp = this.now().toISOString();
    const row: Project = {
      ...data,
      id: newId(),
      userId: this.userId,
      completedAt: data.status === 'done' ? timestamp : null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.database.insert(projects).values(row).run();
    return row;
  }

  async update(id: string, patch: ProjectPatch): Promise<Project | null> {
    return this.database.transaction(tx => {
      const predicate = and(eq(projects.userId, this.userId), eq(projects.id, id));
      const existing = tx.select().from(projects).where(predicate).get() as Project | undefined;
      if (!existing) return null;
      const timestamp = this.now().toISOString();
      const row: Project = { ...existing, ...stripUndefined(patch), updatedAt: timestamp };
      if (row.status !== existing.status) {
        row.completedAt = row.status === 'done' ? timestamp : null;
      }
      tx.update(projects).set(row).where(predicate).run();
      return row;
    }, { behavior: 'immediate' });
  }

  async delete(id: string): Promise<void> {
    const timestamp = this.now().toISOString();
    this.database.transaction(tx => {
      tx.update(todos)
        .set({ projectId: null, updatedAt: timestamp })
        .where(and(eq(todos.userId, this.userId), eq(todos.projectId, id)))
        .run();
      tx.update(timeBlocks)
        .set({ projectId: null, updatedAt: timestamp })
        .where(and(eq(timeBlocks.userId, this.userId), eq(timeBlocks.projectId, id)))
        .run();
      tx.update(binderNotes)
        .set({ projectId: null, updatedAt: timestamp })
        .where(and(eq(binderNotes.userId, this.userId), eq(binderNotes.projectId, id)))
        .run();
      tx.update(lifeEvents)
        .set({ projectId: null, updatedAt: timestamp })
        .where(and(eq(lifeEvents.userId, this.userId), eq(lifeEvents.projectId, id)))
        .run();
      tx.delete(projects)
        .where(and(eq(projects.userId, this.userId), eq(projects.id, id)))
        .run();
    }, { behavior: 'immediate' });
  }

  overview(): ProjectOverviewResponse {
    return this.database.transaction(tx => {
      const summaries = listProjectSummaries(tx, this.userId);
      const todosByProject = listTodosByProject(tx, this.userId);
      return { projects: summaries.map(summary => ({
        ...summary, todos: sortProjectTodos(todosByProject.get(summary.project.id) ?? []),
      })) };
    });
  }
}
