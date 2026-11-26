import 'server-only';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { annualGoals, binderNotes, goals, habits, lifeEvents, metrics, projects, timeBlocks, todos, weeklyTemplates } from '../db/schema';
import { Goal } from '@/lib/types';
import { newId } from '@/lib/utils/id';
import { stripUndefined } from '../db/patch';
import type { BinderDatabase } from '../db/connection';

/** User-scoped goals operations; accepts an isolated database for tests. */
export class GoalRepository {
  constructor(private readonly database: BinderDatabase, private readonly userId: string) { }

  async list(): Promise<Goal[]> {
    const userId = this.userId;
    const db = this.database;
    const rows = await db.select().from(goals).where(eq(goals.userId, userId)).all();
    return rows as Goal[];
  }

  async create(data: Omit<Goal, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Goal> {
    const userId = this.userId;
    const db = this.database;
    const now = new Date().toISOString();
    const row: Goal = { ...data, id: newId(), userId, createdAt: now, updatedAt: now };
    await db.insert(goals).values(row).run();
    return row;
  }

  async update(id: string, patch: Partial<Omit<Goal, 'id' | 'userId' | 'createdAt'>>): Promise<Goal | null> {
    const userId = this.userId;
    const db = this.database;
    const row = db
      .update(goals)
      .set({ ...stripUndefined(patch), updatedAt: new Date().toISOString() })
      .where(and(eq(goals.userId, userId), eq(goals.id, id)))
      .returning()
      .get();
    return (row as Goal | undefined) ?? null;
  }

  async delete(id: string): Promise<void> {
    const userId = this.userId;
    this.database.transaction(tx => {
      // UNION also terminates for cycles in older imported goal trees.
      const subtree = sql`(WITH RECURSIVE descendants(id) AS (
        SELECT id FROM goals WHERE user_id = ${userId} AND id = ${id}
        UNION
        SELECT child.id FROM goals AS child JOIN descendants ON child.parent_id = descendants.id
        WHERE child.user_id = ${userId}
      ) SELECT id FROM descendants)`;
      const removed = new Set(tx.select({ id: goals.id }).from(goals)
        .where(inArray(goals.id, subtree)).all().map(row => row.id));
      if (!removed.size) return;

      const updatedAt = new Date().toISOString();
      for (const table of [annualGoals, habits, todos]) {
        tx.update(table).set({ parentGoalId: null, updatedAt })
          .where(and(eq(table.userId, userId), inArray(table.parentGoalId, subtree))).run();
      }
      for (const table of [projects, timeBlocks, metrics, binderNotes, lifeEvents]) {
        tx.update(table).set({ goalId: null, updatedAt })
          .where(and(eq(table.userId, userId), inArray(table.goalId, subtree))).run();
      }
      const templates = tx.select().from(weeklyTemplates).where(eq(weeklyTemplates.userId, userId)).all();
      for (const template of templates) {
        if (!template.blocks.some(block => block.goalId && removed.has(block.goalId))) continue;
        const blocks = template.blocks.map(block =>
          block.goalId && removed.has(block.goalId) ? { ...block, goalId: null } : block);
        tx.update(weeklyTemplates).set({ blocks, updatedAt }).where(eq(weeklyTemplates.id, template.id)).run();
      }
      tx.delete(goals).where(inArray(goals.id, subtree)).run();
    }, { behavior: 'immediate' });
  }
}
