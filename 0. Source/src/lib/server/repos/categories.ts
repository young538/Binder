import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { categories, habits, projects, timeBlocks, todos, weeklyTemplates } from '../db/schema';
import { DomainError } from '../errors';
import { Category } from '@/lib/types';
import { newId } from '@/lib/utils/id';
import type { BinderDatabase } from '../db/connection';

/** User-scoped categories operations; accepts an isolated database for tests. */
export class CategoryRepository {
  constructor(private readonly database: BinderDatabase, private readonly userId: string) { }

  async list(): Promise<Category[]> {
    const userId = this.userId;
    const db = this.database;
    const rows = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId))
      .orderBy(asc(categories.order))
      .all();
    return rows as Category[];
  }

  async create(data: Omit<Category, 'id' | 'userId'>): Promise<Category> {
    const userId = this.userId;
    const db = this.database;
    const row: Category = { ...data, id: newId(), userId };
    await db.insert(categories).values(row).run();
    return row;
  }

  async update(id: string, patch: Partial<Omit<Category, 'id' | 'userId'>>): Promise<Category | null> {
    const userId = this.userId;
    const db = this.database;
    await db
      .update(categories)
      .set(patch)
      .where(and(eq(categories.userId, userId), eq(categories.id, id)))
      .run();
    const row = await db
      .select()
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.id, id)))
      .get();
    return (row as Category | undefined) ?? null;
  }

  async delete(id: string, replacementId?: string | null): Promise<void> {
    const userId = this.userId;
    this.database.transaction(tx => {
      const owned = (categoryId: string) => and(eq(categories.userId, userId), eq(categories.id, categoryId));
      if (!tx.select().from(categories).where(owned(id)).get()) return;
      if (replacementId && (replacementId === id || !tx.select().from(categories).where(owned(replacementId)).get())) {
        throw new DomainError('내 카테고리에서 다른 항목을 선택해 주세요.', 400);
      }
      const updatedAt = new Date().toISOString();
      const linkedBlocks = and(eq(timeBlocks.userId, userId), eq(timeBlocks.categoryId, id));
      const templates = tx.select().from(weeklyTemplates).where(eq(weeklyTemplates.userId, userId))
        .all().filter(t => t.blocks.some(block => block.categoryId === id));
      if (templates.length || tx.select({ id: timeBlocks.id }).from(timeBlocks).where(linkedBlocks).get()) {
        if (!replacementId) throw new DomainError('시간표 또는 주간 템플릿에 쓰인 카테고리입니다. 옮길 카테고리를 선택해 주세요.', 409);
        tx.update(timeBlocks).set({ categoryId: replacementId, updatedAt }).where(linkedBlocks).run();
        for (const template of templates) {
          const blocks = template.blocks.map(block => block.categoryId === id ? { ...block, categoryId: replacementId } : block);
          tx.update(weeklyTemplates).set({ blocks, updatedAt }).where(eq(weeklyTemplates.id, template.id)).run();
        }
      }
      for (const table of [todos, projects, habits]) {
        tx.update(table).set({ categoryId: replacementId ?? null, updatedAt })
          .where(and(eq(table.userId, userId), eq(table.categoryId, id))).run();
      }
      tx.delete(categories).where(owned(id)).run();
    }, { behavior: 'immediate' });
  }
}
