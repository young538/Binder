'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  BookMarked,
  BookOpen,
  Calendar,
  CalendarDays,
  CalendarHeart,
  CalendarRange,
  ChevronDown,
  Command,
  CreditCard,
  FolderKanban,
  Inbox,
  LogOut,
  NotebookPen,
  Search,
  Settings as SettingsIcon,
  Sun,
  Target,
} from 'lucide-react';
import { toIsoWeek, toIsoDate } from '@/lib/utils/date';
import { format } from 'date-fns';
import { useBinder } from '@/store';
import { logout } from '@/lib/repo/auth';

const primaryLinks = [
  { label: 'One-Thing', Icon: Target, basePath: '/mandalart', href: () => '/mandalart' },
  { label: '프로젝트', Icon: FolderKanban, basePath: '/projects', href: () => '/projects' },
  { label: '일일', Icon: Sun, basePath: '/daily', href: () => '/daily' },
  { label: '주간', Icon: Calendar, basePath: '/week', href: () => `/week/${toIsoWeek(new Date())}` },
  { label: '월간', Icon: CalendarDays, basePath: '/monthly', href: () => `/monthly/${format(new Date(), 'yyyy-MM')}` },
  { label: '연간', Icon: CalendarRange, basePath: '/annual', href: () => `/annual/${format(new Date(), 'yyyy')}` },
  { label: '회고', Icon: NotebookPen, basePath: '/retrospective', href: () => `/retrospective/week/${toIsoWeek(new Date())}` },
];

const lifeHubLinks = [
  { label: '원칙 · 노트', Icon: BookMarked, basePath: '/notes', href: '/notes' },
  { label: '상태 지표', Icon: Activity, basePath: '/metrics', href: '/metrics' },
  { label: '구독 · 월정액', Icon: CreditCard, basePath: '/subscriptions', href: '/subscriptions' },
  { label: '일정 · 사람', Icon: CalendarHeart, basePath: '/life', href: '/life' },
  { label: '독서', Icon: BookOpen, basePath: '/reading', href: '/reading' },
  { label: '목표 실행 점검', Icon: Target, basePath: '/goal-review', href: '/goal-review' },
];

export const TopNav = () => {
  const path = usePathname();
  const router = useRouter();
  const me = useBinder(s => s.me);
  const [busy, setBusy] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const hubRef = useRef<HTMLDivElement>(null);
  const settingsActive = path.startsWith('/settings');
  const hubActive = lifeHubLinks.some(item => path.startsWith(item.basePath));

  useEffect(() => {
    if (!hubOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (hubRef.current && !hubRef.current.contains(e.target as Node)) setHubOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHubOpen(false);
    };
    window.addEventListener('mousedown', onOutside);
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('mousedown', onOutside);
      window.removeEventListener('keydown', onEscape);
    };
  }, [hubOpen]);

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
    <nav className="hidden lg:flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800 px-4 xl:px-6 py-2.5 bg-white dark:bg-zinc-950 sticky top-0 z-20">
      <span className="font-semibold mr-2 xl:mr-4 text-sm xl:text-base text-zinc-800 dark:text-zinc-50 shrink-0">Super 플래너</span>
      <div className="flex items-center gap-0.5 xl:gap-1 mr-auto">
        {primaryLinks.map(({ label, Icon, basePath, href }) => {
          const active = path.startsWith(basePath);
          return (
            <Link
              key={basePath}
              href={href()}
              onNavigate={basePath === '/daily' ? (event) => {
                event.preventDefault();
                router.push(`/daily/${toIsoDate(new Date())}`);
              } : undefined}
              className={`relative flex items-center gap-1 xl:gap-1.5 px-2 xl:px-2.5 py-1.5 rounded-full transition-colors text-[13px] xl:text-sm whitespace-nowrap
                ${active
                  ? 'text-blue-700 font-semibold bg-blue-50/70 dark:bg-blue-950/40 dark:text-blue-300'
                  : 'text-zinc-600 hover:text-zinc-800 hover:bg-stone-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900'}`}
            >
              <Icon size={15} strokeWidth={active ? 2.25 : 1.75} />
              <span>{label}</span>
            </Link>
          );
        })}

        <div className="relative" ref={hubRef}>
          <button
            type="button"
            aria-expanded={hubOpen}
            onClick={() => setHubOpen(v => !v)}
            className={`flex items-center gap-1 px-2 xl:px-2.5 py-1.5 rounded-full transition-colors text-[13px] xl:text-sm whitespace-nowrap
              ${hubActive
                ? 'text-blue-700 font-semibold bg-blue-50/70 dark:bg-blue-950/40 dark:text-blue-300'
                : 'text-zinc-600 hover:text-zinc-800 hover:bg-stone-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900'}`}
          >
            <span>라이프 허브</span>
            <ChevronDown size={14} />
          </button>
          {hubOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-48 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
              {lifeHubLinks.map(({ label, Icon, basePath, href }) => {
                const active = path.startsWith(basePath);
                return (
                  <Link
                    key={basePath}
                    href={href}
                    onClick={() => setHubOpen(false)}
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
      <Link href="/search" aria-label="전체 검색" title="전체 검색" className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0">
        <Search size={17} />
      </Link>
      <Link href="/inbox" aria-label="수집함" title="수집함" className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0">
        <Inbox size={17} />
      </Link>
      <Link
        href="/settings"
        className={`p-2 rounded-full transition-colors shrink-0
          ${settingsActive
            ? 'text-blue-700 bg-blue-50/70 dark:bg-blue-950/40 dark:text-blue-300'
            : 'text-zinc-600 hover:text-zinc-800 hover:bg-stone-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900'}`}
        title="설정"
      >
        <SettingsIcon size={16} strokeWidth={settingsActive ? 2.25 : 1.75} />
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
