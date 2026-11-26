import 'server-only';
import { createHash } from 'node:crypto';
import { and, asc, between, eq, inArray } from 'drizzle-orm';
import type { BinderDatabase, DatabaseSession } from '../db/connection';
import { categories, goals, timeBlocks, weeklyTemplates } from '../db/schema';
import { DomainError } from '../errors';
import { newId } from '@/lib/utils/id';
import { weekDates, toIsoDate } from '@/lib/utils/date';
import type { WeeklyTemplate, WeeklyTemplateBlock } from '@/lib/types';

function resolveTemplateBlocks(tx: DatabaseSession, userId: string, blocks: WeeklyTemplateBlock[], missingCategory: string) {
  const categoryIds = [...new Set(blocks.map(block => block.categoryId))];
  const goalIds = [...new Set(blocks.flatMap(block => block.goalId ? [block.goalId] : []))];
  const ownedCategories = tx.select({ id: categories.id }).from(categories)
    .where(and(eq(categories.userId, userId), inArray(categories.id, categoryIds))).all();
  if (ownedCategories.length !== categoryIds.length) throw new DomainError(missingCategory, 400);

  const ownedGoals = new Set(goalIds.length ? tx.select({ id: goals.id }).from(goals)
    .where(and(eq(goals.userId, userId), inArray(goals.id, goalIds))).all().map(goal => goal.id) : []);
  return blocks.map(block => ({ ...block, goalId: block.goalId && ownedGoals.has(block.goalId) ? block.goalId : null }));
}

export class WeeklyTemplateRepository {
  constructor(private readonly db: BinderDatabase, private readonly userId: string) {}

  list(): WeeklyTemplate[] {
    return this.db.select().from(weeklyTemplates).where(eq(weeklyTemplates.userId, this.userId)).orderBy(asc(weeklyTemplates.createdAt)).all();
  }

  create(name: string, sourceWeek: string): WeeklyTemplate {
    const dates = weekDates(sourceWeek).map(toIsoDate);
    return this.db.transaction(tx => {
      const plans = tx.select().from(timeBlocks).where(and(eq(timeBlocks.userId, this.userId), eq(timeBlocks.kind, 'plan'),
        between(timeBlocks.date, dates[0], dates[6]))).orderBy(asc(timeBlocks.date), asc(timeBlocks.startMin), asc(timeBlocks.id)).limit(501).all();
      if (!plans.length || plans.length > 500) throw new DomainError('계획 시간블록이 1~500개 있는 주를 선택해 주세요.', 400);
      const blocks: WeeklyTemplateBlock[] = plans.map(block => ({
        dayOffset: dates.indexOf(block.date), startMin: block.startMin, endMin: block.endMin,
        text: block.text, categoryId: block.categoryId, goalId: block.goalId,
      }));
      const timestamp = new Date().toISOString();
      const row = {
        id: newId(), userId: this.userId, name: name.trim(), createdAt: timestamp, updatedAt: timestamp,
        blocks: resolveTemplateBlocks(tx, this.userId, blocks, '삭제된 카테고리가 있는 계획을 먼저 수정해 주세요.'),
      };
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
      const blocks = resolveTemplateBlocks(tx, this.userId, template.blocks,
        '템플릿의 카테고리가 삭제되었습니다. 원본 주를 수정하고 템플릿을 다시 저장해 주세요.');
      const plans = blocks.map((block, index) => {
        const blockId = `template_${createHash('sha256').update(JSON.stringify([this.userId, id, week, index])).digest('hex')}`;
        return {
          id: blockId, userId: this.userId, date: dates[block.dayOffset], startMin: block.startMin, endMin: block.endMin,
          text: block.text, kind: 'plan', categoryId: block.categoryId, goalId: block.goalId, todoId: null, createdAt: timestamp, updatedAt: timestamp,
        };
      });
      let added = 0;
      for (let i = 0; i < plans.length; i += 100) {
        added += tx.insert(timeBlocks).values(plans.slice(i, i + 100))
          .onConflictDoNothing({ target: timeBlocks.id }).run().changes;
      }
      return { added, skipped: template.blocks.length - added };
    }, { behavior: 'immediate' });
  }

  delete(id: string): void {
    this.db.delete(weeklyTemplates).where(and(eq(weeklyTemplates.id, id), eq(weeklyTemplates.userId, this.userId))).run();
  }
}
