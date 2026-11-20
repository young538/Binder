import { addDays, addMonths, addYears, differenceInCalendarDays, endOfMonth, parseISO } from 'date-fns';
import {
  SUBSCRIPTION_CURRENCY_SYMBOL,
  type BillingCycle,
  type Subscription,
  type SubscriptionCurrency,
} from './types';
import { toIsoDate } from './utils/date';

const CURRENCY_ORDER: SubscriptionCurrency[] = ['KRW', 'USD', 'JPY', 'EUR'];

export interface CurrencyTotal {
  currency: SubscriptionCurrency;
  amount: number;
}

export interface UpcomingSubscriptionItem {
  subscription: Subscription;
  nextBillingDate: string;
  daysLeft: number;
}

export interface SubscriptionSummary {
  activeCount: number;
  pausedCount: number;
  cancelledCount: number;
  monthlyByCurrency: CurrencyTotal[];
  yearlyByCurrency: CurrencyTotal[];
  upcomingWithin7Days: UpcomingSubscriptionItem[];
}

export function toMonthlyAmount(amount: number, cycle: BillingCycle): number {
  switch (cycle) {
    case 'monthly':
      return amount;
    case 'yearly':
      return amount / 12;
    case 'quarterly':
      return amount / 3;
    case 'weekly':
      return (amount * 52) / 12;
  }
}

export function toYearlyAmount(amount: number, cycle: BillingCycle): number {
  switch (cycle) {
    case 'monthly':
      return amount * 12;
    case 'yearly':
      return amount;
    case 'quarterly':
      return amount * 4;
    case 'weekly':
      return amount * 52;
  }
}

export function formatCurrency(amount: number, currency: SubscriptionCurrency): string {
  const symbol = SUBSCRIPTION_CURRENCY_SYMBOL[currency] ?? '';
  if (currency === 'KRW' || currency === 'JPY') {
    const rounded = Math.round(amount);
    return `${symbol}${rounded.toLocaleString('en-US')}`;
  }
  const rounded = Math.round(amount * 100) / 100;
  if (Number.isInteger(rounded)) {
    return `${symbol}${rounded.toLocaleString('en-US')}`;
  }
  return `${symbol}${rounded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function describeBillingDday(
  nextBillingDate: string,
  today: string,
): { daysLeft: number; label: string; isOverdue: boolean } {
  const daysLeft = differenceInCalendarDays(parseISO(nextBillingDate), parseISO(today));
  if (daysLeft === 0) {
    return { daysLeft: 0, label: '오늘 결제', isOverdue: false };
  }
  if (daysLeft < 0) {
    return { daysLeft, label: `${Math.abs(daysLeft)}일 지남`, isOverdue: true };
  }
  return { daysLeft, label: `D-${daysLeft}`, isOverdue: false };
}

export function advanceBillingDate(
  currentDate: string,
  cycle: BillingCycle,
  billingDay?: number | null,
): string {
  const base = parseISO(currentDate);
  if (cycle === 'weekly') {
    return toIsoDate(addDays(base, 7));
  }
  const shifted =
    cycle === 'monthly'
      ? addMonths(base, 1)
      : cycle === 'quarterly'
        ? addMonths(base, 3)
        : addYears(base, 1);

  if (billingDay != null && billingDay >= 1) {
    const maxDay = endOfMonth(shifted).getDate();
    const day = Math.min(billingDay, maxDay);
    return toIsoDate(new Date(shifted.getFullYear(), shifted.getMonth(), day));
  }
  return toIsoDate(shifted);
}

export function expandSubscriptionBillingDates(
  sub: Pick<Subscription, 'status' | 'nextBillingDate' | 'billingCycle' | 'billingDay'>,
  startDate: string,
  endDate: string,
): string[] {
  if (sub.status !== 'active' || !sub.nextBillingDate) return [];
  if (sub.nextBillingDate > endDate) return [];

  const result: string[] = [];
  let cursor = sub.nextBillingDate;
  for (let step = 0; step < 260 && cursor <= endDate; step++) {
    if (cursor >= startDate) {
      result.push(cursor);
    }
    const next = advanceBillingDate(cursor, sub.billingCycle, sub.billingDay);
    if (next <= cursor) break;
    cursor = next;
  }
  return result;
}

export function summarizeSubscriptions(
  items: Subscription[],
  today: string,
): SubscriptionSummary {
  const monthlyMap = new Map<SubscriptionCurrency, number>();
  const yearlyMap = new Map<SubscriptionCurrency, number>();
  const upcomingWithin7Days: UpcomingSubscriptionItem[] = [];

  let activeCount = 0;
  let pausedCount = 0;
  let cancelledCount = 0;

  for (const sub of items) {
    if (sub.status === 'active') {
      activeCount++;
      monthlyMap.set(
        sub.currency,
        (monthlyMap.get(sub.currency) ?? 0) + toMonthlyAmount(sub.amount, sub.billingCycle),
      );
      yearlyMap.set(
        sub.currency,
        (yearlyMap.get(sub.currency) ?? 0) + toYearlyAmount(sub.amount, sub.billingCycle),
      );
      if (sub.nextBillingDate) {
        const daysLeft = differenceInCalendarDays(parseISO(sub.nextBillingDate), parseISO(today));
        if (daysLeft >= 0 && daysLeft <= 7) {
          upcomingWithin7Days.push({
            subscription: sub,
            nextBillingDate: sub.nextBillingDate,
            daysLeft,
          });
        }
      }
    } else if (sub.status === 'paused') {
      pausedCount++;
    } else if (sub.status === 'cancelled') {
      cancelledCount++;
    }
  }

  upcomingWithin7Days.sort(
    (a, b) => a.daysLeft - b.daysLeft || a.subscription.name.localeCompare(b.subscription.name),
  );

  const monthlyByCurrency: CurrencyTotal[] = [];
  const yearlyByCurrency: CurrencyTotal[] = [];
  for (const currency of CURRENCY_ORDER) {
    const m = monthlyMap.get(currency);
    const y = yearlyMap.get(currency);
    if (m != null) monthlyByCurrency.push({ currency, amount: m });
    if (y != null) yearlyByCurrency.push({ currency, amount: y });
  }

  return {
    activeCount,
    pausedCount,
    cancelledCount,
    monthlyByCurrency,
    yearlyByCurrency,
    upcomingWithin7Days,
  };
}
