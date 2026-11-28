'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Command, MoreHorizontal, X } from 'lucide-react';
import { destinations, retrospectiveMenu } from './destinations';

const primary = [destinations.dashboard, destinations.daily, destinations.inbox, destinations.finance];

const moreGroups = [
  { title: '플래너', items: [destinations.week, destinations.monthly, destinations.annual, destinations.life] },
  { title: '목표 · 실행', items: [destinations.mandalart, destinations.projects, retrospectiveMenu, destinations.goalReview] },
  { title: '재무', items: [destinations.subscriptions] },
  { title: '기록 · 도구', items: [destinations.wiki, destinations.notes, destinations.injections, destinations.metrics, destinations.reading, destinations.search, destinations.settings] },
];

export const BottomNav = () => {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const moreActive = moreGroups.some(g => g.items.some(m => path.startsWith(m.basePath)));

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 inset-x-0 flex border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/95 backdrop-blur-md dark:bg-zinc-950/95 z-30 pb-2">
        {primary.map(({ label, Icon, basePath, href }) => {
          const active = path.startsWith(basePath);
          return (
            <Link
              key={basePath}
              href={basePath === destinations.daily.basePath ? basePath : href()}
              onNavigate={basePath === destinations.daily.basePath ? (event) => {
                event.preventDefault();
                router.push(destinations.daily.href());
              } : undefined}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors
                ${active ? 'text-blue-700 dark:text-blue-300' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
            >
              <span className={`inline-flex items-center justify-center px-3 py-0.5 rounded-full transition-colors ${active ? 'bg-blue-50/70 dark:bg-blue-950/40' : ''}`}>
                <Icon size={22} strokeWidth={active ? 2.25 : 1.75} />
              </span>
              <span className={`text-[10px] ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setOpen(true)}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors
            ${moreActive ? 'text-blue-700 dark:text-blue-300' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
        >
          <span className={`inline-flex items-center justify-center px-3 py-0.5 rounded-full transition-colors ${moreActive ? 'bg-blue-50/70 dark:bg-blue-950/40' : ''}`}>
            <MoreHorizontal size={22} strokeWidth={moreActive ? 2.25 : 1.75} />
          </span>
          <span className={`text-[10px] ${moreActive ? 'font-semibold' : 'font-medium'}`}>더보기</span>
        </button>
      </nav>

      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 flex items-end"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-zinc-900/25 backdrop-blur-sm" />
          <div
            className="relative w-full max-h-[82dvh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-t-2xl p-3 pb-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-50">전체 메뉴</h3>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    window.dispatchEvent(new CustomEvent('binder:open-command-palette'));
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
                >
                  <Command size={13} /> 런처
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 text-zinc-500 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  aria-label="닫기"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {moreGroups.map(group => (
              <div key={group.title} className="space-y-1.5">
                <div className="px-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  {group.title}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {group.items.map(({ label, Icon, basePath, href }) => {
                    const active = path.startsWith(basePath);
                    return (
                      <Link
                        key={basePath}
                        href={href()}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border transition
                          ${
                            active
                              ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                              : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                          }`}
                      >
                        <Icon size={17} />
                        <span className="text-sm font-medium">{label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
