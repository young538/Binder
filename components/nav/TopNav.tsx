'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Target, NotebookPen, Settings } from 'lucide-react';
import { toIsoWeek } from '@/lib/utils/date';

const links = [
  { label: '주간',    Icon: Calendar,     basePath: '/week',          href: () => `/week/${toIsoWeek(new Date())}` },
  { label: '만다라트', Icon: Target,       basePath: '/mandalart',     href: () => '/mandalart' },
  { label: '회고',    Icon: NotebookPen,  basePath: '/retrospective', href: () => `/retrospective/week/${toIsoWeek(new Date())}` },
  { label: '설정',    Icon: Settings,     basePath: '/settings',      href: () => '/settings' },
];

export const TopNav = () => {
  const path = usePathname();
  return (
    <nav className="hidden lg:flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 bg-white dark:bg-zinc-950 sticky top-0 z-20">
      <span className="font-semibold mr-auto text-zinc-900 dark:text-zinc-50">3P 바인더</span>
      {links.map(({ label, Icon, basePath, href }) => {
        const active = path.startsWith(basePath);
        return (
          <Link key={basePath} href={href()}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors text-sm
              ${active
                ? 'text-blue-600 font-medium'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900'}`}>
            <Icon size={16} strokeWidth={active ? 2.25 : 1.75} />
            <span>{label}</span>
            {active && (
              <span className="absolute -bottom-3 left-3 right-3 h-0.5 bg-blue-600 rounded-full" />
            )}
          </Link>
        );
      })}
    </nav>
  );
};
