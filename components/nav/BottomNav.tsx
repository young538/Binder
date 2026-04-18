'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  Target,
  NotebookPen,
  MoreHorizontal,
  BookOpen,
  Settings as SettingsIcon,
  X,
} from 'lucide-react';
import { toIsoWeek } from '@/lib/utils/date';
import { format } from 'date-fns';

const primary = [
  { label: '주간', Icon: Calendar,      basePath: '/week',          href: () => `/week/${toIsoWeek(new Date())}` },
  { label: '월간', Icon: CalendarDays,  basePath: '/monthly',       href: () => `/monthly/${format(new Date(), 'yyyy-MM')}` },
  { label: '연간', Icon: CalendarRange, basePath: '/annual',        href: () => `/annual/${format(new Date(), 'yyyy')}` },
  { label: '목표', Icon: Target,        basePath: '/mandalart',     href: () => '/mandalart' },
  { label: '회고', Icon: NotebookPen,   basePath: '/retrospective', href: () => `/retrospective/week/${toIsoWeek(new Date())}` },
];

const more = [
  { label: '독서', Icon: BookOpen,     basePath: '/reading',  href: () => '/reading' },
  { label: '설정', Icon: SettingsIcon, basePath: '/settings', href: () => '/settings' },
];

export const BottomNav = () => {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const moreActive = more.some((m) => path.startsWith(m.basePath));

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 inset-x-0 flex border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 z-30 pb-2">
        {primary.map(({ label, Icon, basePath, href }) => {
          const active = path.startsWith(basePath);
          return (
            <Link
              key={basePath}
              href={href()}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors
                ${active ? 'text-blue-600' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
            >
              <Icon size={22} strokeWidth={active ? 2.25 : 1.75} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setOpen(true)}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors
            ${moreActive ? 'text-blue-600' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
        >
          <MoreHorizontal size={22} strokeWidth={moreActive ? 2.25 : 1.75} />
          <span className="text-[10px] font-medium">더보기</span>
        </button>
      </nav>

      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 flex items-end"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full bg-white dark:bg-zinc-900 rounded-t-2xl p-3 pb-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 px-2">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">더보기</h3>
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-zinc-500 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {more.map(({ label, Icon, basePath, href }) => {
                const active = path.startsWith(basePath);
                return (
                  <Link
                    key={basePath}
                    href={href()}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition
                      ${
                        active
                          ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                          : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                      }`}
                  >
                    <Icon size={18} />
                    <span className="text-sm font-medium">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
