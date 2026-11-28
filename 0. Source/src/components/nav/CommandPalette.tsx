'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command, Plus } from 'lucide-react';
import { destinations } from './destinations';
import { createNote } from '@/lib/repo/notes';
import { http } from '@/lib/repo/http';
import { createTodo } from '@/lib/repo/todos';
import { SEARCH_KINDS, type SearchResult, type SearchResults } from '@/lib/search/types';
import { useBinder } from '@/store';
import { useNotifications } from '@/store/notifications';
import { Dialog } from '@/components/common/Dialog';

interface PaletteAction {
  key: string;
  label: string;
  subtitle?: string;
  badge?: string;
  run: () => void | Promise<void>;
}

export function CommandPalette() {
  const router = useRouter();
  const me = useBinder(s => s.me);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(prev => {
          const next = !prev;
          if (next) {
            setQuery('');
            setResults([]);
            setActiveIndex(0);
          }
          return next;
        });
      }
    };
    const onOpenEvent = () => {
      setQuery('');
      setResults([]);
      setActiveIndex(0);
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('binder:open-command-palette', onOpenEvent);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('binder:open-command-palette', onOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      setSearching(true);
      const params = new URLSearchParams({ q: trimmed, offset: '0' });
      http
        .get<SearchResults>(`/api/search?${params}`)
        .then(data => {
          if (!cancelled) {
            setResults(data.items.slice(0, 8));
            setActiveIndex(0);
          }
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query]);

  const trimmed = query.trim();

  const navTargets = useMemo(() => {
    if (!open) return [];
    const now = new Date();
    const lower = trimmed.toLowerCase();
    return Object.entries(destinations)
      .filter(([, item]) => [item.label, item.searchLabel, item.basePath, item.subtitle(now)]
        .some(text => text.toLowerCase().includes(lower)))
      .map(([key, item]) => ({
        key: `nav:${key}`, label: item.searchLabel, subtitle: item.subtitle(now), href: item.href,
      }));
  }, [open, trimmed]);

  const actions: PaletteAction[] = useMemo(() => {
    const list: PaletteAction[] = [];
    if (trimmed) {
      list.push({
        key: 'create:todo',
        label: `수집함에 할 일 추가: "${trimmed}"`,
        badge: '빠른 생성',
        run: async () => {
          await createTodo({ title: trimmed, scope: 'inbox', scopeKey: 'inbox', status: 'pending', order: 0 });
          if (me?.userId) {
            useNotifications.getState().add({
              userId: me.userId,
              text: `수집함에 추가했어요: ${trimmed}`,
              expiresAt: Date.now() + 4000,
            });
          }
          setOpen(false);
        },
      });
      list.push({
        key: 'create:note',
        label: `인사이트 노트로 저장: "${trimmed}"`,
        badge: '빠른 노트',
        run: async () => {
          await createNote({
            kind: 'insight',
            title: trimmed,
            body: '',
            pinned: false,
            reviewDate: null,
            decisionOutcome: null,
            goalId: null,
            projectId: null,
            sourceRetro: null,
          });
          if (me?.userId) {
            useNotifications.getState().add({
              userId: me.userId,
              text: `인사이트 노트로 저장했어요: ${trimmed}`,
              expiresAt: Date.now() + 4000,
            });
          }
          setOpen(false);
        },
      });
    }

    for (const r of results) {
      list.push({
        key: `search:${r.kind}:${r.id}`,
        label: r.title,
        subtitle: r.excerpt || undefined,
        badge: SEARCH_KINDS[r.kind],
        run: () => {
          setOpen(false);
          router.push(r.href);
        },
      });
    }

    for (const nav of navTargets) {
      list.push({
        key: nav.key,
        label: nav.label,
        subtitle: nav.subtitle,
        badge: '이동',
        run: () => {
          setOpen(false);
          router.push(nav.href());
        },
      });
    }
    return list;
  }, [trimmed, results, navTargets, me, router]);

  const execute = async (action?: PaletteAction) => {
    if (!action || busy) return;
    setBusy(true);
    try {
      await action.run();
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog title="OS 커맨드 런처" onClose={() => { if (!busy) setOpen(false); }}>
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 focus-within:border-blue-500 focus-within:bg-white dark:border-zinc-700 dark:bg-zinc-950">
          <Command size={16} className="shrink-0 text-zinc-400" />
          <input
            ref={inputRef}
            type="text"
            autoFocus
            aria-label="커맨드 또는 검색어 입력"
            placeholder="검색어 입력, 화면 이동, 또는 새 할 일/노트 즉시 추가…"
            value={query}
            onChange={e => {
              const next = e.target.value;
              setQuery(next);
              setActiveIndex(0);
              if (!next.trim()) {
                setResults([]);
                setSearching(false);
              }
            }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex(i => (actions.length ? (i + 1) % actions.length : 0));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex(i => (actions.length ? (i - 1 + actions.length) % actions.length : 0));
              } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void execute(actions[activeIndex]);
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
          />
          {searching && <span className="text-[11px] text-zinc-400">검색 중…</span>}
        </div>

        <ul
          role="listbox"
          aria-label="커맨드 목록"
          className="max-h-[55dvh] space-y-1 overflow-y-auto pr-1"
        >
          {actions.length === 0 ? (
            <li className="py-6 text-center text-xs text-zinc-500">일치하는 항목이 없습니다.</li>
          ) : (
            actions.map((action, idx) => {
              const selected = idx === activeIndex;
              return (
                <li key={action.key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={busy}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => void execute(action)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
                      selected
                        ? 'bg-blue-50 text-blue-900 dark:bg-blue-950/60 dark:text-blue-100'
                        : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate font-medium">
                        {action.key.startsWith('create:') && <Plus size={14} className="shrink-0 text-blue-600" />}
                        <span className="truncate">{action.label}</span>
                      </div>
                      {action.subtitle && (
                        <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">{action.subtitle}</div>
                      )}
                    </div>
                    {action.badge && (
                      <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {action.badge}
                      </span>
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </Dialog>
  );
}
