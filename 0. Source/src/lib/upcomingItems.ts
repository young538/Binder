import { describeEventDday, nextAnnualOccurrence } from './lifeEvents';
import { describeBillingDday, formatCurrency } from './subscriptions';
import type { LifeEvent, Person, Subscription } from './types';

interface UpcomingItem {
  id: string;
  title: string;
  kind: LifeEvent['kind'] | 'birthday' | 'subscription';
  date: string;
  daysLeft: number;
  label: string;
  isGoogle: boolean;
  personId?: string;
  subscriptionId?: string;
}

export function upcomingItemsFor(
  date: string, daysAhead: number,
  events: LifeEvent[], people: Person[], subscriptions: Subscription[],
  billingTitle: (name: string, price: string) => string,
): UpcomingItem[] {
  const items: UpcomingItem[] = [];
  const inWindow = (days: number) => days >= 0 && days <= daysAhead;
  for (const event of events) {
    const { targetDate, daysLeft, label } = describeEventDday(event, date);
    if (inWindow(daysLeft)) items.push({
      id: event.id, title: event.title, kind: event.kind, date: targetDate,
      daysLeft, label, isGoogle: Boolean(event.googleEventId), personId: event.personId ?? undefined,
    });
  }
  for (const person of people) {
    if (!person.birthday) continue;
    const next = nextAnnualOccurrence(person.birthday.slice(5, 10), date);
    if (inWindow(next.daysLeft)) items.push({
      id: `bday:${person.id}`, title: `${person.name} 생일`, kind: 'birthday', date: next.date,
      daysLeft: next.daysLeft, label: next.daysLeft === 0 ? '오늘' : `D-${next.daysLeft}`,
      isGoogle: false, personId: person.id,
    });
  }
  for (const sub of subscriptions) {
    if (sub.status !== 'active' || !sub.nextBillingDate) continue;
    const { daysLeft, label } = describeBillingDday(sub.nextBillingDate, date);
    if (inWindow(daysLeft)) items.push({
      id: `sub:${sub.id}`, title: billingTitle(sub.name, formatCurrency(sub.amount, sub.currency)),
      kind: 'subscription', date: sub.nextBillingDate, daysLeft, label, isGoogle: false, subscriptionId: sub.id,
    });
  }
  return items.sort((a, b) =>
    a.daysLeft - b.daysLeft || a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}
