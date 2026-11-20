import 'server-only';
import { createHash } from 'node:crypto';
import { and, asc, between, eq } from 'drizzle-orm';
import type { BinderDatabase } from '../db/connection';
import { categories, goals, timeBlocks, weeklyTemplates } from '../db/schema';
import { DomainError } from '../errors';
import { newId } from '@/lib/utils/id';
import { weekDates, toIsoDate } from '@/lib/utils/date';
import type { WeeklyTemplate, WeeklyTemplateBlock } from '@/lib/types';

export class WeeklyTemplateRepository {
  constructor(private readonly db: BinderDatabase, private readonly userId: string) {}

  list(): WeeklyTemplate[] {
    return this.db.select().from(weeklyTemplates).where(eq(weeklyTemplates.userId, this.userId)).orderBy(asc(weeklyTemplates.createdAt)).all();
  }

  create(name: string, sourceWeek: string): WeeklyTemplate {
    const dates = weekDates(sourceWeek).map(toIsoDate);
    return this.db.transaction(tx => {
      const plans = tx.select().from(timeBlocks).where(and(eq(timeBlocks.userId, this.userId), eq(timeBlocks.kind, 'plan'),
        between(timeBlocks.date, dates[0], dates[6]))).orderBy(asc(timeBlocks.date), asc(timeBlocks.startMin), asc(timeBlocks.id)).all();
      if (!plans.length || plans.length > 500) throw new DomainError('계획 시간블록이 1~500개 있는 주를 선택해 주세요.', 400);
      const blocks: WeeklyTemplateBlock[] = plans.map(block => ({
        dayOffset: dates.indexOf(block.date), startMin: block.startMin, endMin: block.endMin,
        text: block.text, categoryId: block.categoryId, goalId: block.goalId,
      }));
      const timestamp = new Date().toISOString();
      const row = { id: newId(), userId: this.userId, name: name.trim(), blocks, createdAt: timestamp, updatedAt: timestamp };
      for (const block of blocks) {
        if (!tx.select().from(categories).where(and(eq(categories.userId, this.userId), eq(categories.id, block.categoryId))).get()) {
          throw new DomainError('삭제된 카테고리가 있는 계획을 먼저 수정해 주세요.', 400);
        }
        if (block.goalId && !tx.select().from(goals).where(and(eq(goals.userId, this.userId), eq(goals.id, block.goalId))).get()) block.goalId = null;
      }
      tx.insert(weeklyTemplates).values(row).run();
      return row;
    }, { behavior: 'immediate' });
  }

  apply(id: string, week: string): { added: number; skipped: number } {
    const dates = weekDates(week).map(toIsoDate);
    return this.db.transaction(tx => {
      const template = tx.select().from(weeklyTemplates).where(and(eq(weeklyTemplates.userId, this.userId), eq(weeklyTemplates.id, id))).get();
      if (!template) throw new DomainError('템플릿을 찾을 수 없습니다.', 404);
      const timestamp = new Date().toISOString();
      let added = 0;
      template.blocks.forEach((block, index) => {
        if (!tx.select().from(categories).where(and(eq(categories.id, block.categoryId), eq(categories.userId, this.userId))).get()) {
          throw new DomainError('템플릿의 카테고리가 삭제되었습니다. 원본 주를 수정하고 템플릿을 다시 저장해 주세요.', 400);
        }
        const goalId = block.goalId && tx.select().from(goals).where(and(eq(goals.id, block.goalId), eq(goals.userId, this.userId))).get() ? block.goalId : null;
        const blockId = `template_${createHash('sha256').update(JSON.stringify([this.userId, id, week, index])).digest('hex')}`;
        const result = tx.insert(timeBlocks).values({
          id: blockId, userId: this.userId, date: dates[block.dayOffset], startMin: block.startMin, endMin: block.endMin,
          text: block.text, kind: 'plan', categoryId: block.categoryId, goalId, todoId: null, createdAt: timestamp, updatedAt: timestamp,
        }).onConflictDoNothing().run();
        added += result.changes;
      });
      return { added, skipped: template.blocks.length - added };
    }, { behavior: 'immediate' });
  }

  delete(id: string): void {
    this.db.delete(weeklyTemplates).where(and(eq(weeklyTemplates.id, id), eq(weeklyTemplates.userId, this.userId))).run();
  }
}
