'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, CalendarDays, CalendarRange, Target, NotebookPen, BookOpen, Settings as SettingsIcon } from 'lucide-react';
import { toIsoWeek } from '@/lib/utils/date';
import { format } from 'date-fns';

const primaryLinks = [
  { label: '만다라트', Icon: Target,         basePath: '/mandalart',     href: () => '/mandalart' },
  { label: '연간',    Icon: CalendarRange,  basePath: '/annual',        href: () => `/annual/${format(new Date(), 'yyyy')}` },
  { label: '월간',    Icon: CalendarDays,   basePath: '/monthly',       href: () => `/monthly/${format(new Date(), 'yyyy-MM')}` },
  { label: '주간',    Icon: Calendar,       basePath: '/week',          href: () => `/week/${toIsoWeek(new Date())}` },
  { label: '회고',    Icon: NotebookPen,    basePath: '/retrospective', href: () => `/retrospective/week/${toIsoWeek(new Date())}` },
  { label: '독서',    Icon: BookOpen,       basePath: '/reading',       href: () => '/reading' },
];

export const TopNav = () => {
  const path = usePathname();
  const settingsActive = path.startsWith('/settings');
  return (
    <nav className="hidden lg:flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 bg-white dark:bg-zinc-950 sticky top-0 z-20">
      <span className="font-semibold mr-4 text-zinc-800 dark:text-zinc-50">3P 바인더</span>
      <div className="flex items-center gap-1 mr-auto">
        {primaryLinks.map(({ label, Icon, basePath, href }) => {
          const active = path.startsWith(basePath);
          return (
            <Link key={basePath} href={href()}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors text-sm
                ${active
                  ? 'text-blue-700 font-semibold bg-blue-50/70 dark:bg-blue-950/40 dark:text-blue-300'
                  : 'text-zinc-600 hover:text-zinc-800 hover:bg-stone-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900'}`}>
              <Icon size={16} strokeWidth={active ? 2.25 : 1.75} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
      <Link href="/settings"
        className={`p-2 rounded-full transition-colors
          ${settingsActive
            ? 'text-blue-700 bg-blue-50/70 dark:bg-blue-950/40 dark:text-blue-300'
            : 'text-zinc-600 hover:text-zinc-800 hover:bg-stone-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900'}`}
        title="설정">
        <SettingsIcon size={16} strokeWidth={settingsActive ? 2.25 : 1.75} />
      </Link>
    </nav>
  );
};
