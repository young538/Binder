'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { addDays, subDays } from 'date-fns';
import {
  Calendar,
  CalendarDays,
  CheckCircle2,
  Cloud,
  FolderKanban,
  Inbox,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { useBinder } from '@/store';
import type { Todo, TodoPriority, TodoScope } from '@/lib/types';
import { toIsoDate } from '@/lib/utils/date';
import { tint } from '@/lib/utils/color';
import {
  createTodo,
  deleteTodo,
  listAllTodos,
  setStatus,
  updateTodo,
} from '@/lib/repo/todos';
import { getGoogleCalendarStatus, syncGoogleCalendar } from '@/lib/repo/googleCalendar';
import { TodoStatusButton } from '@/components/common/TodoStatusButton';
import { TodoTitleEditor } from '@/components/common/TodoTitleEditor';
import { TodoDetailsButton } from '@/components/common/TodoDetailsButton';
import { TodoNote } from '@/components/common/TodoNote';
import { TodoCreateInput } from '@/components/common/TodoCreateInput';

type SmartView = 'inbox' | 'today' | 'upcoming' | 'all' | `project:${string}`;

const PRIORITY_META: Record<TodoPriority, { label: string; badgeClass: string }> = {
  1: {
    label: 'P1',
    badgeClass: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900',
  },
  2: {
    label: 'P2',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900',
  },
  3: {
    label: 'P3',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900',
  },
};

function formatScopeTag(todo: Todo, todayIso: string, tomorrowIso: string): { label: string; overdue: boolean } {
  if (todo.scope === 'inbox') return { label: '수집함', overdue: false };
  if (todo.scope === 'day') {
    if (todo.scopeKey === todayIso) return { label: '오늘', overdue: false };
    if (todo.scopeKey === tomorrowIso) return { label: '내일', overdue: false };
    const overdue = todo.scopeKey < todayIso && todo.status !== 'done';
    return { label: overdue ? `${todo.scopeKey} · 지연` : todo.scopeKey, overdue };
  }
  if (todo.scope === 'week') return { label: `주간 ${todo.scopeKey}`, overdue: false };
  if (todo.scope === 'month') return { label: `월간 ${todo.scopeKey}`, overdue: false };
  return { label: `연간 ${todo.scopeKey}`, overdue: false };
}

function compareHubTodos(a: Todo, b: Todo): number {
  const aDone = a.status === 'done' ? 1 : 0;
  const bDone = b.status === 'done' ? 1 : 0;
  if (aDone !== bDone) return aDone - bDone;

  const aPrio = a.priority ?? 99;
  const bPrio = b.priority ?? 99;
  if (aPrio !== bPrio) return aPrio - bPrio;

  if (a.scope === 'day' && b.scope === 'day' && a.scopeKey !== b.scopeKey) {
    return a.scopeKey.localeCompare(b.scopeKey);
  }
  if (a.order !== b.order) return a.order - b.order;
  return b.createdAt.localeCompare(a.createdAt);
}

export function TodoHubPage() {
  const { goals = [], categories = [], projects = [] } = useBinder();
  const { value: allTodos, refresh: refreshTodos } = useAsyncResource(
    'todos:hub',
    listAllTodos,
    [],
    ['todos'],
  );
  const { value: googleStatus, refresh: refreshGoogle } = useAsyncResource(
    'google-calendar:status',
    getGoogleCalendarStatus,
    null,
    ['googleCalendar'],
  );

  const [activeView, setActiveView] = useState<SmartView>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | '1' | '2' | '3'>('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [adding, setAdding] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const now = new Date();
  const todayIso = toIsoDate(now);
  const tomorrowIso = toIsoDate(addDays(now, 1));
  const sevenDaysAgoIso = toIsoDate(subDays(now, 7));

  const activeProjects = useMemo(
    () => projects.filter(p => p.status !== 'done'),
    [projects],
  );

  const nonCancelled = useMemo(
    () => allTodos.filter(t => t.status !== 'cancelled'),
    [allTodos],
  );

  const inView = useMemo(() => {
    const matchesView = (t: Todo): boolean => {
      if (activeView === 'inbox') return t.scope === 'inbox';
      if (activeView === 'today') {
        return (
          t.scope === 'day' &&
          (t.scopeKey === todayIso ||
            (t.scopeKey >= sevenDaysAgoIso && t.scopeKey < todayIso && t.status !== 'done'))
        );
      }
      if (activeView === 'upcoming') return t.scope === 'day' && t.scopeKey > todayIso;
      if (activeView === 'all') return true;
      if (activeView.startsWith('project:')) {
        const pid = activeView.slice('project:'.length);
        return t.projectId === pid;
      }
      return true;
    };

    const query = searchQuery.trim().toLowerCase();
    return nonCancelled.filter(t => {
      if (!matchesView(t)) return false;
      if (priorityFilter !== 'all' && String(t.priority ?? '') !== priorityFilter) return false;
      if (!query) return true;
      const projTitle = projects.find(p => p.id === t.projectId)?.title ?? '';
      return (
        t.title.toLowerCase().includes(query) ||
        (t.note ?? '').toLowerCase().includes(query) ||
        projTitle.toLowerCase().includes(query)
      );
    });
  }, [activeView, nonCancelled, priorityFilter, projects, searchQuery, sevenDaysAgoIso, todayIso]);

  const completedInViewCount = useMemo(
    () => inView.filter(t => t.status === 'done').length,
    [inView],
  );

  const visibleTodos = useMemo(() => {
    const rows = showCompleted ? inView : inView.filter(t => t.status !== 'done');
    return [...rows].sort(compareHubTodos);
  }, [inView, showCompleted]);

  const counts = useMemo(() => {
    const open = nonCancelled.filter(t => t.status !== 'done');
    const byProject: Record<string, number> = {};
    for (const t of open) {
      if (t.projectId) {
        byProject[t.projectId] = (byProject[t.projectId] ?? 0) + 1;
      }
    }
    return {
      inbox: open.filter(t => t.scope === 'inbox').length,
      today: open.filter(
        t =>
          t.scope === 'day' &&
          (t.scopeKey === todayIso || (t.scopeKey >= sevenDaysAgoIso && t.scopeKey < todayIso)),
      ).length,
      upcoming: open.filter(t => t.scope === 'day' && t.scopeKey > todayIso).length,
      all: open.length,
      byProject,
    };
  }, [nonCancelled, sevenDaysAgoIso, todayIso]);

  const reload = () => {
    void refreshTodos(true);
  };

  const editTitle = async (t: Todo, nextTitle: string) => {
    await updateTodo(t.id, { title: nextTitle });
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm('삭제할까요?')) return;
    await deleteTodo(id);
    reload();
  };

  const triageToDate = async (id: string, targetScope: TodoScope, targetScopeKey: string) => {
    await updateTodo(id, { scope: targetScope, scopeKey: targetScopeKey });
    reload();
  };

  const setProject = async (id: string, projectId: string | null) => {
    await updateTodo(id, { projectId });
    reload();
  };

  const handleCreateForView = async (title: string, requestKey: string) => {
    const selectedProjectId = activeView.startsWith('project:')
      ? activeView.slice('project:'.length)
      : null;
    const scope: TodoScope =
      activeView === 'today' || activeView === 'upcoming' ? 'day' : 'inbox';
    const scopeKey =
      activeView === 'today'
        ? todayIso
        : activeView === 'upcoming'
          ? tomorrowIso
          : 'inbox';
    await createTodo(
      {
        title,
        scope,
        scopeKey,
        status: 'pending',
        order: visibleTodos.length,
        projectId: selectedProjectId,
      },
      requestKey,
    );
  };

  const handleGoogleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncNotice(null);
    try {
      const res = await syncGoogleCalendar();
      await Promise.all([refreshTodos(true), refreshGoogle(true)]);
      if (res.tasks?.error) {
        setSyncNotice({ kind: 'error', text: res.tasks.error });
      } else if (res.tasks) {
        setSyncNotice({
          kind: 'success',
          text: `Tasks 동기화 완료: 가져옴 ${res.tasks.pulledCreated} · 갱신 ${res.tasks.pulledUpdated} · 반영 ${res.tasks.pushedCreated + res.tasks.pushedUpdated}`,
        });
      } else {
        setSyncNotice({ kind: 'success', text: 'Google 동기화를 완료했어요.' });
      }
    } catch (err) {
      setSyncNotice({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Google 동기화에 실패했습니다.',
      });
    } finally {
      setSyncing(false);
    }
  };

  const selectedProject = activeView.startsWith('project:')
    ? projects.find(p => p.id === activeView.slice('project:'.length)) ?? null
    : null;

  const viewHeaderTitle = selectedProject
    ? `📁 ${selectedProject.title}`
    : activeView === 'inbox'
      ? '수집함'
      : activeView === 'today'
        ? '오늘 할 일'
        : activeView === 'upcoming'
          ? '예정된 할 일'
          : '전체 할 일';

  const viewHeaderDesc = selectedProject
    ? '이 프로젝트에 연결된 모든 할 일입니다. 오늘·내일 날짜로 바로 배치할 수 있어요.'
    : activeView === 'inbox'
      ? '빠르게 담아 둔 할 일입니다. 오늘·내일·프로젝트를 지정해 정리하고 Google Tasks와 동기화하세요.'
      : activeView === 'today'
        ? '오늘 예정된 일간 할 일과 최근 7일 내 미완료 항목을 한곳에서 관리합니다.'
        : activeView === 'upcoming'
          ? '내일 이후로 예정된 할 일 목록입니다.'
          : '수집함, 일간, 주·월·연간 및 프로젝트의 모든 활성 할 일을 통합 검색·정리합니다.';

  const conn = googleStatus?.connection ?? null;

  const smartNavItems: Array<{
    id: SmartView;
    label: string;
    count: number;
    icon: typeof Inbox;
  }> = [
    { id: 'inbox', label: '수집함', count: counts.inbox, icon: Inbox },
    { id: 'today', label: '오늘', count: counts.today, icon: Calendar },
    { id: 'upcoming', label: '예정', count: counts.upcoming, icon: CalendarDays },
    { id: 'all', label: '전체', count: counts.all, icon: Layers },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 pb-24 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{viewHeaderTitle}</h1>
          <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{viewHeaderDesc}</p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={14} /> 할 일 추가
        </button>
      </header>

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-4">
          <nav aria-label="할 일 보기 전환" className="space-y-3">
            <div className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {smartNavItems.map(item => {
                const Icon = item.icon;
                const active = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveView(item.id)}
                    aria-pressed={active}
                    className={`flex shrink-0 items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      active
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                        : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 lg:border-transparent lg:bg-transparent'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon size={14} />
                      <span>{item.label}</span>
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                        active
                          ? 'bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900'
                          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}
                    >
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {activeProjects.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  <span className="flex items-center gap-1">
                    <FolderKanban size={12} /> 프로젝트
                  </span>
                  <Link href="/projects" className="text-blue-600 hover:underline dark:text-blue-400">
                    관리
                  </Link>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
                  {activeProjects.map(project => {
                    const viewKey: SmartView = `project:${project.id}`;
                    const active = activeView === viewKey;
                    const openCount = counts.byProject[project.id] ?? 0;
                    return (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => setActiveView(viewKey)}
                        aria-pressed={active}
                        className={`flex shrink-0 items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                          active
                            ? 'bg-indigo-600 text-white'
                            : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 lg:border-transparent lg:bg-transparent'
                        }`}
                      >
                        <span className="max-w-[140px] truncate lg:max-w-full">📁 {project.title}</span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                            active
                              ? 'bg-white/20 text-white'
                              : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}
                        >
                          {openCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </nav>

          <div className="rounded-xl border border-zinc-200 bg-white p-3 text-xs space-y-2 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-semibold text-zinc-800 dark:text-zinc-100">
                <Cloud size={14} className="text-emerald-600 dark:text-emerald-400" />
                Google Tasks
              </span>
              <Link
                href="/settings#google-calendar"
                className="text-[11px] text-blue-600 hover:underline dark:text-blue-400"
              >
                설정
              </Link>
            </div>
            {!googleStatus?.configured ? (
              <p className="text-[11px] text-zinc-500">Google 연동 환경변수가 설정되면 사용할 수 있습니다.</p>
            ) : !conn ? (
              <div className="space-y-1.5">
                <p className="text-[11px] text-zinc-500">Google 계정을 연결하면 할 일이 양방향 동기화됩니다.</p>
                <Link
                  href="/settings#google-calendar"
                  className="inline-block rounded-lg bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Google 연결하기
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                  {conn.googleEmail} · {conn.tasksSyncEnabled ? '활성' : '일시정지'}
                </div>
                {conn.tasksLastSyncedAt && (
                  <div className="text-[11px] text-zinc-400">
                    최근: {new Date(conn.tasksLastSyncedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                  </div>
                )}
                {conn.tasksLastSyncError && (
                  <p className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    {conn.tasksLastSyncError}
                  </p>
                )}
                <button
                  type="button"
                  disabled={syncing}
                  onClick={() => void handleGoogleSync()}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? '동기화 중…' : 'Google Tasks 동기화'}
                </button>
              </div>
            )}
          </div>
        </aside>

        <section className="min-w-0 space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {syncNotice && (
            <p
              role={syncNotice.kind === 'error' ? 'alert' : 'status'}
              className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                syncNotice.kind === 'error'
                  ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
              }`}
            >
              {syncNotice.text}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-[180px] flex-1">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="search"
                aria-label="할 일 검색"
                placeholder="제목·메모·프로젝트 검색"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <select
              aria-label="우선순위 필터"
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value as 'all' | '1' | '2' | '3')}
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            >
              <option value="all">모든 우선순위</option>
              <option value="1">P1 높음</option>
              <option value="2">P2 보통</option>
              <option value="3">P3 낮음</option>
            </select>
            <button
              type="button"
              onClick={() => setShowCompleted(v => !v)}
              aria-pressed={showCompleted}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                showCompleted
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              <CheckCircle2 size={13} />
              완료 항목 ({completedInViewCount})
            </button>
          </div>

          {adding && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-2.5 dark:border-blue-900/50 dark:bg-blue-950/20">
              <TodoCreateInput
                key={activeView}
                onCreate={handleCreateForView}
                onDone={() => {
                  setAdding(false);
                  reload();
                }}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
          )}

          {visibleTodos.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-200 px-4 py-8 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              {inView.length > 0 && !showCompleted
                ? `진행 중인 할 일이 없고 완료된 항목이 ${completedInViewCount}개 있어요.`
                : '표시할 할 일이 없습니다. 위 버튼이나 빠른 메모(Alt+N)로 추가해 보세요.'}
            </div>
          ) : (
            <ul className="space-y-2.5">
              {visibleTodos.map(t => {
                const pg = t.parentGoalId ? goals.find(g => g.id === t.parentGoalId)?.title : null;
                const proj = t.projectId ? projects.find(p => p.id === t.projectId) : undefined;
                const cat = t.categoryId ? categories.find(c => c.id === t.categoryId) : undefined;
                const scopeTag = formatScopeTag(t, todayIso, tomorrowIso);
                const prio = t.priority ? PRIORITY_META[t.priority] : null;
                return (
                  <li
                    key={t.id}
                    className="min-w-0 rounded-lg border border-zinc-100 p-2.5 dark:border-zinc-800"
                    style={
                      cat
                        ? {
                            borderLeft: `3px solid ${cat.color}`,
                            background: tint.subtle(cat.color),
                            paddingLeft: '0.625rem',
                          }
                        : undefined
                    }
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-1">
                        <TodoStatusButton
                          status={t.status}
                          onChange={next => {
                            void setStatus(t.id, next).then(reload);
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1 py-0.5">
                        <TodoTitleEditor
                          todo={t}
                          onCommit={editTitle}
                          className="py-0.5"
                          textClassName="text-zinc-800 dark:text-zinc-50"
                        />
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${
                              scopeTag.overdue
                                ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300'
                                : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                            }`}
                          >
                            {scopeTag.label}
                          </span>
                          {prio && (
                            <span className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${prio.badgeClass}`}>
                              {prio.label}
                            </span>
                          )}
                          {proj && (
                            <Link
                              href={`/projects?project=${encodeURIComponent(proj.id)}`}
                              className="truncate text-[11px] font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                            >
                              📁 {proj.title}
                            </Link>
                          )}
                          {pg && (
                            <span className="truncate text-[11px] text-blue-600 dark:text-blue-400">
                              🎯 {pg}
                            </span>
                          )}
                          {t.googleTaskId && (
                            <span
                              title="Google Tasks와 양방향 동기화됨"
                              className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                            >
                              G Tasks
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {!(t.scope === 'day' && t.scopeKey === todayIso) && (
                        <button
                          type="button"
                          onClick={() => void triageToDate(t.id, 'day', todayIso)}
                          className="rounded border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          오늘
                        </button>
                      )}
                      {!(t.scope === 'day' && t.scopeKey === tomorrowIso) && (
                        <button
                          type="button"
                          onClick={() => void triageToDate(t.id, 'day', tomorrowIso)}
                          className="rounded border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          내일
                        </button>
                      )}
                      {t.scope !== 'inbox' && (
                        <button
                          type="button"
                          onClick={() => void triageToDate(t.id, 'inbox', 'inbox')}
                          className="rounded border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          수집함으로
                        </button>
                      )}
                      <select
                        aria-label={`${t.title} 프로젝트`}
                        value={t.projectId ?? ''}
                        onChange={e => void setProject(t.id, e.target.value || null)}
                        className="min-w-0 max-w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                      >
                        <option value="">프로젝트 없음</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>
                            📁 {p.title}
                          </option>
                        ))}
                      </select>
                      <TodoDetailsButton todo={t} />
                      <button
                        type="button"
                        aria-label={`${t.title} 삭제`}
                        onClick={() => void remove(t.id)}
                        className="shrink-0 rounded p-1.5 text-zinc-500 transition hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <TodoNote todo={t} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
