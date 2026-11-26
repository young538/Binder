import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import type { Person } from '@/lib/types';
import { newId } from '@/lib/utils/id';
import type { BinderDatabase } from '../db/connection';
import { stripUndefined } from '../db/patch';
import { lifeEvents, people } from '../db/schema';

type NewPerson = Omit<Person, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
type PersonPatch = Partial<NewPerson>;

/** User-scoped personal CRM; unlinks lifeEvents.personId atomically when deleted. */
export class PersonRepository {
  constructor(
    private readonly database: BinderDatabase,
    private readonly userId: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  list(): Person[] {
    return this.database
      .select()
      .from(people)
      .where(eq(people.userId, this.userId))
      .orderBy(asc(people.order), asc(people.createdAt), asc(people.id))
      .all() as Person[];
  }

  create(data: NewPerson): Person {
    const timestamp = this.now().toISOString();
    const row: Person = {
      ...data,
      id: newId(),
      userId: this.userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.database.insert(people).values(row).run();
    return row;
  }

  update(id: string, patch: PersonPatch): Person | null {
    const predicate = and(eq(people.userId, this.userId), eq(people.id, id));
    const timestamp = this.now().toISOString();
    const updated = this.database
      .update(people)
      .set({ ...stripUndefined(patch), updatedAt: timestamp })
      .where(predicate)
      .returning()
      .get();
    return (updated as Person | undefined) ?? null;
  }

  delete(id: string): void {
    const timestamp = this.now().toISOString();
    this.database.transaction(tx => {
      tx.update(lifeEvents)
        .set({ personId: null, updatedAt: timestamp })
        .where(and(eq(lifeEvents.userId, this.userId), eq(lifeEvents.personId, id)))
        .run();
      tx.delete(people)
        .where(and(eq(people.userId, this.userId), eq(people.id, id)))
        .run();
    }, { behavior: 'immediate' });
  }
}
