import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { LifeEvent, Person } from './types';

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function annualOccurrenceForYear(monthDay: string, year: number): string {
  const safeMonthDay = monthDay === '02-29' && !isLeapYear(year) ? '02-28' : monthDay;
  return `${String(year).padStart(4, '0')}-${safeMonthDay}`;
}

export function nextAnnualOccurrence(monthDay: string, today: string): { date: string; daysLeft: number } {
  const baseYear = Number(today.slice(0, 4));
  const thisYear = annualOccurrenceForYear(monthDay, baseYear);
  const target = thisYear >= today ? thisYear : annualOccurrenceForYear(monthDay, baseYear + 1);
  return {
    date: target,
    daysLeft: differenceInCalendarDays(parseISO(target), parseISO(today)),
  };
}

export function describeEventDday(
  event: Pick<LifeEvent, 'date' | 'endDate' | 'kind'>,
  today: string,
): { targetDate: string; daysLeft: number; label: string; isPast: boolean } {
  if (event.kind === 'anniversary') {
    const next = nextAnnualOccurrence(event.date.slice(5, 10), today);
    return {
      targetDate: next.date,
      daysLeft: next.daysLeft,
      label: next.daysLeft === 0 ? '오늘' : `D-${next.daysLeft}`,
      isPast: false,
    };
  }

  const end = event.endDate && event.endDate >= event.date ? event.endDate : event.date;
  if (today >= event.date && today <= end) {
    return {
      targetDate: event.date,
      daysLeft: 0,
      label: event.date === end ? '오늘 (D-Day)' : '진행 중',
      isPast: false,
    };
  }

  const daysLeft = differenceInCalendarDays(parseISO(event.date), parseISO(today));
  if (daysLeft < 0) {
    return {
      targetDate: event.date,
      daysLeft,
      label: `${Math.abs(daysLeft)}일 지남`,
      isPast: true,
    };
  }
  return {
    targetDate: event.date,
    daysLeft,
    label: daysLeft === 0 ? 'D-Day' : `D-${daysLeft}`,
    isPast: false,
  };
}

export function daysSinceContact(
  lastContactAt: string | null | undefined,
  today: string,
): number | null {
  if (!lastContactAt) return null;
  return differenceInCalendarDays(parseISO(today), parseISO(lastContactAt));
}

export function isContactDue(
  person: Pick<Person, 'cadenceDays' | 'lastContactAt'>,
  today: string,
): { due: boolean; daysSince: number | null; overdueDays: number } {
  const daysSince = daysSinceContact(person.lastContactAt, today);
  if (!person.cadenceDays || person.cadenceDays <= 0) {
    return { due: false, daysSince, overdueDays: 0 };
  }
  if (daysSince === null) {
    return { due: true, daysSince: null, overdueDays: person.cadenceDays };
  }
  const overdueDays = Math.max(0, daysSince - person.cadenceDays);
  return { due: daysSince >= person.cadenceDays, daysSince, overdueDays };
}
