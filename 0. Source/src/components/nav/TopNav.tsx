'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, Command, LogOut } from 'lucide-react';
import { destinations, retrospectiveMenu } from './destinations';
import { useBinder } from '@/store';
import { logout } from '@/lib/repo/auth';

const directLinks = [destinations.dashboard, destinations.daily, destinations.inbox];

const dropdownGroups = [
  { key: 'planner', label: '플래너', items: [destinations.week, destinations.monthly, destinations.annual, destinations.life] },
  { key: 'goals', label: '목표 · 실행', items: [destinations.mandalart, destinations.projects, retrospectiveMenu, destinations.goalReview] },
  { key: 'finance', label: '재무', items: [destinations.finance, destinations.subscriptions] },
  { key: 'records', label: '지식 · 기록', items: [destinations.notes, destinations.injections, destinations.metrics, destinations.reading] },
] as const;

type GroupKey = (typeof dropdownGroups)[number]['key'];

export const TopNav = () => {
  const path = usePathname();
  const router = useRouter();
  const me = useBinder(s => s.me);
  const [busy, setBusy] = useState(false);
  const [openGroup, setOpenGroup] = useState<GroupKey | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const settingsActive = path.startsWith(destinations.settings.basePath);

  useEffect(() => {
    if (!openGroup) return;
    const onOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroup(null);
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenGroup(null);
    };
    window.addEventListener('mousedown', onOutside);
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('mousedown', onOutside);
      window.removeEventListener('keydown', onEscape);
    };
  }, [openGroup]);

  const onLogout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await logout();
      router.push('/login');
    } catch {
      setBusy(false);
    }
  };

  return (
    <nav className="hidden lg:flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800 px-3 xl:px-6 py-2.5 bg-white dark:bg-zinc-950 sticky top-0 z-20">
      <Link
        href={destinations.dashboard.href()}
        className="font-semibold mr-2 xl:mr-4 text-sm xl:text-base text-zinc-800 hover:text-blue-600 dark:text-zinc-50 dark:hover:text-blue-400 shrink-0 transition-colors"
      >
        Super 플래너
      </Link>

      <div ref={navRef} className="flex items-center gap-0.5 xl:gap-1 mr-auto">
        {directLinks.map(({ label, Icon, basePath, href }) => {
          const active = path.startsWith(basePath);
          return (
            <Link
              key={basePath}
              href={basePath === destinations.daily.basePath ? basePath : href()}
              onClick={() => setOpenGroup(null)}
              onNavigate={basePath === destinations.daily.basePath ? (event) => {
                event.preventDefault();
                setOpenGroup(null);
                router.push(destinations.daily.href());
              } : undefined}
              className={`relative flex items-center gap-1 xl:gap-1.5 px-2.5 py-1.5 rounded-full transition-colors text-[13px] xl:text-sm whitespace-nowrap
                ${active
                  ? 'text-blue-700 font-semibold bg-blue-50/70 dark:bg-blue-950/40 dark:text-blue-300'
                  : 'text-zinc-600 hover:text-zinc-800 hover:bg-stone-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900'}`}
            >
              <Icon size={15} strokeWidth={active ? 2.25 : 1.75} />
              <span>{label}</span>
            </Link>
          );
        })}

        {dropdownGroups.map(group => {
          const groupActive = group.items.some(item => path.startsWith(item.basePath));
          const isOpen = openGroup === group.key;
          return (
            <div key={group.key} className="relative">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenGroup(prev => (prev === group.key ? null : group.key))}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full transition-colors text-[13px] xl:text-sm whitespace-nowrap
                  ${groupActive
                    ? 'text-blue-700 font-semibold bg-blue-50/70 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'text-zinc-600 hover:text-zinc-800 hover:bg-stone-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900'}`}
              >
                <span>{group.label}</span>
                <ChevronDown size={13} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-48 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                  {group.items.map(({ label, Icon, basePath, href }) => {
                    const active = path.startsWith(basePath);
                    return (
                      <Link
                        key={basePath}
                        href={href()}
                        onClick={() => setOpenGroup(null)}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                          active
                            ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                            : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <Icon size={15} />
                        <span>{label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {me && (
        <span className="hidden xl:inline text-xs text-zinc-500 dark:text-zinc-400 mr-1.5 select-none">
          {me.username}
        </span>
      )}
      <button
        type="button"
        aria-label="커맨드 런처"
        title="커맨드 런처 (Ctrl/Cmd+K)"
        onClick={() => window.dispatchEvent(new CustomEvent('binder:open-command-palette'))}
        className="flex items-center gap-1 rounded-full border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 shrink-0"
      >
        <Command size={13} />
        <span className="hidden xl:inline">⌘K</span>
      </button>
      <Link href={destinations.search.href()} aria-label={destinations.search.label} title={destinations.search.label} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0">
        <destinations.search.Icon size={17} />
      </Link>
      <Link
        href={destinations.settings.href()}
        className={`p-2 rounded-full transition-colors shrink-0
          ${settingsActive
            ? 'text-blue-700 bg-blue-50/70 dark:bg-blue-950/40 dark:text-blue-300'
            : 'text-zinc-600 hover:text-zinc-800 hover:bg-stone-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900'}`}
        title={destinations.settings.label}
      >
        <destinations.settings.Icon size={16} strokeWidth={settingsActive ? 2.25 : 1.75} />
      </Link>
      <button
        type="button"
        onClick={onLogout}
        disabled={busy}
        title="로그아웃"
        className="p-2 rounded-full text-zinc-600 hover:text-zinc-800 hover:bg-stone-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50 shrink-0"
      >
        <LogOut size={16} strokeWidth={1.75} />
      </button>
    </nav>
  );
};
