import { addDays, parseISO } from 'date-fns';
import { annualOccurrenceForYear } from './lifeEvents';
import { expandSubscriptionBillingDates, formatCurrency } from './subscriptions';
import type { AnnualGoal, LifeEvent, Person, Project, Subscription } from './types';
import { toIsoDate } from './utils/date';

export interface CalendarMarker {
  id: string;
  date: string;
  kind: 'project' | 'annualGoal' | 'event' | 'dday' | 'anniversary' | 'birthday' | 'subscription';
  label: string;
  href: string;
  color?: string | null;
}

export function buildCalendarMarkers(
  startDate: string,
  endDate: string,
  sources: {
    projects?: Project[];
    annualGoals?: AnnualGoal[];
    lifeEvents?: LifeEvent[];
    people?: Person[];
    subscriptions?: Subscription[];
  },
): Map<string, CalendarMarker[]> {
  const map = new Map<string, CalendarMarker[]>();
  const push = (marker: CalendarMarker) => {
    if (marker.date < startDate || marker.date > endDate) return;
    const list = map.get(marker.date);
    if (list) list.push(marker);
    else map.set(marker.date, [marker]);
  };

  for (const project of sources.projects ?? []) {
    if (project.status === 'done' || !project.deadline) continue;
    push({
      id: `proj:${project.id}`,
      date: project.deadline,
      kind: 'project',
      label: `🏁 ${project.title}`,
      href: `/projects?project=${encodeURIComponent(project.id)}`,
    });
  }

  for (const ag of sources.annualGoals ?? []) {
    if (!ag.deadline) continue;
    push({
      id: `ag:${ag.id}`,
      date: ag.deadline,
      kind: 'annualGoal',
      label: `🎯 ${ag.title || '연간 목표'}`,
      href: `/annual/${encodeURIComponent(ag.year)}`,
    });
  }

  const startYear = Number(startDate.slice(0, 4));
  const endYear = Number(endDate.slice(0, 4));

  for (const ev of sources.lifeEvents ?? []) {
    if (ev.kind === 'anniversary') {
      const monthDay = ev.date.slice(5, 10);
      for (let year = startYear; year <= endYear; year++) {
        const occ = annualOccurrenceForYear(monthDay, year);
        push({
          id: `ev:${ev.id}:${occ}`,
          date: occ,
          kind: 'anniversary',
          label: `🎉 ${ev.title}`,
          href: '/life?tab=events',
          color: ev.color,
        });
      }
      continue;
    }

    const evEnd = ev.endDate && ev.endDate >= ev.date ? ev.endDate : ev.date;
    const clampedStart = ev.date > startDate ? ev.date : startDate;
    const clampedEnd = evEnd < endDate ? evEnd : endDate;
    if (clampedStart > clampedEnd) continue;
    let cursor = parseISO(clampedStart);
    const limit = parseISO(clampedEnd);
    while (cursor <= limit) {
      const dateStr = toIsoDate(cursor);
      push({
        id: `ev:${ev.id}:${dateStr}`,
        date: dateStr,
        kind: ev.kind === 'dday' ? 'dday' : 'event',
        label: ev.kind === 'dday' ? `📌 ${ev.title}` : `📅 ${ev.title}`,
        href: '/life?tab=events',
        color: ev.color,
      });
      cursor = addDays(cursor, 1);
    }
  }

  for (const person of sources.people ?? []) {
    if (!person.birthday) continue;
    const monthDay = person.birthday.slice(5, 10);
    for (let year = startYear; year <= endYear; year++) {
      const occ = annualOccurrenceForYear(monthDay, year);
      push({
        id: `bday:${person.id}:${occ}`,
        date: occ,
        kind: 'birthday',
        label: `🎂 ${person.name} 생일`,
        href: `/life?tab=people&person=${encodeURIComponent(person.id)}`,
      });
    }
  }

  for (const sub of sources.subscriptions ?? []) {
    const dates = expandSubscriptionBillingDates(sub, startDate, endDate);
    for (const d of dates) {
      push({
        id: `sub:${sub.id}:${d}`,
        date: d,
        kind: 'subscription',
        label: `💳 ${sub.name} ${formatCurrency(sub.amount, sub.currency)}`,
        href: `/subscriptions?subscription=${encodeURIComponent(sub.id)}`,
      });
    }
  }

  return map;
}
