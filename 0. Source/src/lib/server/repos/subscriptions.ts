import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import type { Subscription } from '@/lib/types';
import { newId } from '@/lib/utils/id';
import type { BinderDatabase } from '../db/connection';
import { stripUndefined } from '../db/patch';
import { financeTransactions, subscriptions } from '../db/schema';

type NewSubscription = Omit<Subscription, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
type SubscriptionPatch = Partial<NewSubscription>;

/** User-scoped recurring subscriptions and fixed expense tracking. */
export class SubscriptionRepository {
  constructor(
    private readonly database: BinderDatabase,
    private readonly userId: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  list(): Subscription[] {
    return this.database
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, this.userId))
      .orderBy(asc(subscriptions.order), asc(subscriptions.name), asc(subscriptions.id))
      .all() as Subscription[];
  }

  create(data: NewSubscription): Subscription {
    const timestamp = this.now().toISOString();
    const row: Subscription = {
      ...data,
      id: newId(),
      userId: this.userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.database.insert(subscriptions).values(row).run();
    return row;
  }

  update(id: string, patch: SubscriptionPatch): Subscription | null {
    const predicate = and(eq(subscriptions.userId, this.userId), eq(subscriptions.id, id));
    const existing = this.database
      .select()
      .from(subscriptions)
      .where(predicate)
      .get() as Subscription | undefined;
    if (!existing) return null;
    const timestamp = this.now().toISOString();
    return this.database
      .update(subscriptions)
      .set({ ...stripUndefined(patch), updatedAt: timestamp })
      .where(predicate)
      .returning()
      .get() as Subscription;
  }

  delete(id: string): void {
    this.database.transaction(tx => {
      tx.update(financeTransactions).set({ subscriptionId: null, updatedAt: this.now().toISOString() })
        .where(and(eq(financeTransactions.userId, this.userId), eq(financeTransactions.subscriptionId, id))).run();
      tx.delete(subscriptions).where(and(eq(subscriptions.userId, this.userId), eq(subscriptions.id, id))).run();
    }, { behavior: 'immediate' });
  }
}
