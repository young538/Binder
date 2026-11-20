import 'server-only';
import { and, asc, desc, eq, isNotNull, lte } from 'drizzle-orm';
import type { BinderNote, NoteKind } from '@/lib/types';
import { newId } from '@/lib/utils/id';
import type { BinderDatabase } from '../db/connection';
import { stripUndefined } from '../db/patch';
import { binderNotes } from '../db/schema';

type NewNote = Omit<BinderNote, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
type NotePatch = Partial<NewNote>;

/** User-scoped permanent notes (principles, decisions, insights, references). */
export class NoteRepository {
  constructor(
    private readonly database: BinderDatabase,
    private readonly userId: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  list(filters?: { kind?: NoteKind; goalId?: string; projectId?: string }): BinderNote[] {
    const conditions = [eq(binderNotes.userId, this.userId)];
    if (filters?.kind) conditions.push(eq(binderNotes.kind, filters.kind));
    if (filters?.goalId) conditions.push(eq(binderNotes.goalId, filters.goalId));
    if (filters?.projectId) conditions.push(eq(binderNotes.projectId, filters.projectId));

    return this.database
      .select()
      .from(binderNotes)
      .where(and(...conditions))
      .orderBy(desc(binderNotes.pinned), desc(binderNotes.updatedAt), asc(binderNotes.id))
      .all() as BinderNote[];
  }

  listDueDecisions(today: string): BinderNote[] {
    const rows = this.database
      .select()
      .from(binderNotes)
      .where(
        and(
          eq(binderNotes.userId, this.userId),
          eq(binderNotes.kind, 'decision'),
          isNotNull(binderNotes.reviewDate),
          lte(binderNotes.reviewDate, today),
        ),
      )
      .orderBy(asc(binderNotes.reviewDate), asc(binderNotes.id))
      .all() as BinderNote[];

    return rows.filter(row => !row.decisionOutcome || !row.decisionOutcome.trim());
  }

  create(data: NewNote): BinderNote {
    const timestamp = this.now().toISOString();
    const row: BinderNote = {
      ...data,
      id: newId(),
      userId: this.userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.database.insert(binderNotes).values(row).run();
    return row;
  }

  update(id: string, patch: NotePatch): BinderNote | null {
    const predicate = and(eq(binderNotes.userId, this.userId), eq(binderNotes.id, id));
    const existing = this.database.select().from(binderNotes).where(predicate).get() as BinderNote | undefined;
    if (!existing) return null;
    const timestamp = this.now().toISOString();
    return this.database
      .update(binderNotes)
      .set({ ...stripUndefined(patch), updatedAt: timestamp })
      .where(predicate)
      .returning()
      .get() as BinderNote;
  }

  delete(id: string): void {
    this.database
      .delete(binderNotes)
      .where(and(eq(binderNotes.userId, this.userId), eq(binderNotes.id, id)))
      .run();
  }
}
