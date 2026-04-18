'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, CalendarDays, CalendarRange, Target, NotebookPen, Settings as SettingsIcon } from 'lucide-react';
import { toIsoWeek } from '@/lib/utils/date';
import { format } from 'date-fns';

const primary = [
  { label: '주간', Icon: Calendar,      basePath: '/week',          href: () => `/week/${toIsoWeek(new Date())}` },
  { label: '월간', Icon: CalendarDays,  basePath: '/monthly',       href: () => `/monthly/${format(new Date(), 'yyyy-MM')}` },
  { label: '연간', Icon: CalendarRange, basePath: '/annual',        href: () => `/annual/${format(new Date(), 'yyyy')}` },
  { label: '목표', Icon: Target,        basePath: '/mandalart',     href: () => '/mandalart' },
  { label: '회고', Icon: NotebookPen,   basePath: '/retrospective', href: () => `/retrospective/week/${toIsoWeek(new Date())}` },
];

export const BottomNav = () => {
  const path = usePathname();
  const settingsActive = path.startsWith('/settings');
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 flex border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 z-30 pb-2">
      {primary.map(({ label, Icon, basePath, href }) => {
        const active = path.startsWith(basePath);
        return (
          <Link key={basePath} href={href()}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors
              ${active ? 'text-blue-600' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'}`}>
            <Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        );
      })}
      <Link href="/settings"
        className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors
          ${settingsActive ? 'text-blue-600' : 'text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300'}`}>
        <SettingsIcon size={20} strokeWidth={settingsActive ? 2.25 : 1.75} />
        <span className="text-[10px]">설정</span>
      </Link>
    </nav>
  );
};
