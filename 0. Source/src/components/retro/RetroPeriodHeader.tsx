'use client';
import Link from 'next/link';
import { addMonths, addWeeks, addYears, format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toIsoWeek, weekDates } from '@/lib/utils/date';

interface Props {
  mode: 'weekly' | 'monthly' | 'yearly';
  period: string;
}

export function RetroPeriodHeader({ mode, period }: Props) {
  const now = new Date();
  const currentWeek = toIsoWeek(now);
  const currentMonth = format(now, 'yyyy-MM');
  const currentYear = format(now, 'yyyy');

  let prevHref = '';
  let nextHref = '';
  let heading = '';
  let subtitle = '';

  if (mode === 'weekly') {
    const monday = weekDates(period)[0];
    prevHref = `/retrospective/week/${toIsoWeek(addWeeks(monday, -1))}`;
    nextHref = `/retrospective/week/${toIsoWeek(addWeeks(monday, 1))}`;
    heading = `📝 ${period}`;
    subtitle = '주간 회고';
  } else if (mode === 'monthly') {
    const base = parseISO(`${period}-01`);
    prevHref = `/retrospective/month/${format(addMonths(base, -1), 'yyyy-MM')}`;
    nextHref = `/retrospective/month/${format(addMonths(base, 1), 'yyyy-MM')}`;
    heading = `🗓️ ${format(base, 'yyyy년 M월')}`;
    subtitle = '월간 회고';
  } else {
    const base = parseISO(`${period}-01-01`);
    prevHref = `/retrospective/year/${format(addYears(base, -1), 'yyyy')}`;
    nextHref = `/retrospective/year/${format(addYears(base, 1), 'yyyy')}`;
    heading = `🧭 ${period}년`;
    subtitle = '연간 회고';
  }

  const tabs: { key: Props['mode']; label: string; href: string }[] = [
    { key: 'weekly', label: '주간', href: `/retrospective/week/${mode === 'weekly' ? period : currentWeek}` },
    { key: 'monthly', label: '월간', href: `/retrospective/month/${mode === 'monthly' ? period : currentMonth}` },
    { key: 'yearly', label: '연간', href: `/retrospective/year/${mode === 'yearly' ? period : currentYear}` },
  ];

  return (
    <header className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-wide text-zinc-500">{subtitle}</div>
        <nav aria-label="회고 기간 단위" className="flex gap-1.5">
          {tabs.map(tab => {
            const active = mode === tab.key;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href={prevHref}
          aria-label={`이전 ${subtitle}`}
          className="rounded-full p-2 text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <ChevronLeft size={18} />
        </Link>
        <h1 className="flex-1 text-center text-2xl font-bold text-zinc-800 dark:text-zinc-50">{heading}</h1>
        <Link
          href={nextHref}
          aria-label={`다음 ${subtitle}`}
          className="rounded-full p-2 text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <ChevronRight size={18} />
        </Link>
      </div>
    </header>
  );
}
