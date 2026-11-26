import 'server-only';
import { and, asc, desc, eq, isNull, lte, or, sql } from 'drizzle-orm';
import type { BinderNote, NoteKind } from '@/lib/types';
import { newId } from '@/lib/utils/id';
import type { BinderDatabase, DatabaseSession } from '../db/connection';
import { stripUndefined } from '../db/patch';
import { binderNotes } from '../db/schema';

type NewNote = Omit<BinderNote, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
type NotePatch = Partial<NewNote>;

// SQLite trim defaults to ASCII space. Imported notes can contain any JS trim whitespace.
const trimWhitespace = '\t\n\v\f\r \u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff';

export function dueDecisionFilter(userId: string, today: string) {
  return and(
    eq(binderNotes.userId, userId),
    eq(binderNotes.kind, 'decision'),
    lte(binderNotes.reviewDate, today),
    or(isNull(binderNotes.decisionOutcome), sql`trim(${binderNotes.decisionOutcome}, ${trimWhitespace}) = ''`),
  );
}

export function listDueDecisions(db: DatabaseSession, userId: string, today: string): BinderNote[] {
  return db.select().from(binderNotes).where(dueDecisionFilter(userId, today))
    .orderBy(asc(binderNotes.reviewDate), asc(binderNotes.id)).all() as BinderNote[];
}

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
    return listDueDecisions(this.database, this.userId, today);
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
    const timestamp = this.now().toISOString();
    const updated = this.database
      .update(binderNotes)
      .set({ ...stripUndefined(patch), updatedAt: timestamp })
      .where(predicate)
      .returning()
      .get();
    return (updated as BinderNote | undefined) ?? null;
  }

  delete(id: string): void {
    this.database
      .delete(binderNotes)
      .where(and(eq(binderNotes.userId, this.userId), eq(binderNotes.id, id)))
      .run();
  }
}
