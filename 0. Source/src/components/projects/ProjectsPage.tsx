'use client';
import { useMemo, useState } from 'react';
import { FolderKanban, Plus } from 'lucide-react';
import { PROJECT_STATUS_LABEL, type Project, type ProjectStatus } from '@/lib/types';
import { describeDeadline } from '@/lib/projects';
import { getProjectsOverview } from '@/lib/repo/projects';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { toIsoDate } from '@/lib/utils/date';
import { useBinder } from '@/store';
import { fieldClass } from '@/components/common/Dialog';
import { ProjectCard } from './ProjectCard';
import { ProjectEditorDialog } from './ProjectEditorDialog';

type StatusTab = ProjectStatus | 'all';

const TABS: { key: StatusTab; label: string }[] = [
  { key: 'active', label: PROJECT_STATUS_LABEL.active },
  { key: 'planned', label: PROJECT_STATUS_LABEL.planned },
  { key: 'onHold', label: PROJECT_STATUS_LABEL.onHold },
  { key: 'done', label: PROJECT_STATUS_LABEL.done },
  { key: 'all', label: '전체' },
];

export function ProjectsPage({ initialProjectId }: { initialProjectId?: string }) {
  const { goals } = useBinder();
  const today = toIsoDate(new Date());
  const { value, loading, error, refresh } = useAsyncResource(
    'projects:overview',
    getProjectsOverview,
    { projects: [] },
    ['projects', 'todos', 'timeBlocks'],
  );

  const [tab, setTab] = useState<StatusTab>(() => (initialProjectId ? 'all' : 'active'));
  const [goalFilter, setGoalFilter] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(initialProjectId ? [initialProjectId] : []),
  );
  const [dialogState, setDialogState] = useState<{ open: boolean; editing?: Project }>({ open: false });

  const allItems = value.projects;
  const activeCount = allItems.filter(item => item.project.status === 'active').length;
  const missingActionCount = allItems.filter(item => item.needsNextAction).length;
  const urgentCount = allItems.filter(item => {
    if (item.project.status === 'done') return false;
    const info = describeDeadline(item.project.deadline, today, item.project.status);
    return !!info?.urgent;
  }).length;

  const filtered = useMemo(
    () =>
      allItems.filter(item => {
        if (tab !== 'all' && item.project.status !== tab) return false;
        if (goalFilter && item.project.goalId !== goalFilter) return false;
        return true;
      }),
    [allItems, tab, goalFilter],
  );

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 pb-24 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
            Execution Projects
          </div>
          <h1 className="mt-0.5 text-2xl font-bold text-zinc-900 dark:text-zinc-50">프로젝트</h1>
          <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            큰 목표를 기한과 완료 기준이 있는 프로젝트로 쪼개고, 다음 행동을 일일·수집함 할 일로 연결하세요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialogState({ open: true })}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <Plus size={16} /> 새 프로젝트
        </button>
      </header>

      <section className="grid grid-cols-3 gap-2.5 sm:gap-4" aria-label="프로젝트 요약">
        <div className="rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">진행 중</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{activeCount}개</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">다음 행동 필요</p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${missingActionCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-900 dark:text-zinc-50'}`}>
            {missingActionCount}개
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">7일 내 마감·지연</p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${urgentCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-900 dark:text-zinc-50'}`}>
            {urgentCount}개
          </p>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="프로젝트 상태 필터">
          {TABS.map(item => {
            const count =
              item.key === 'all'
                ? allItems.length
                : allItems.filter(p => p.project.status === item.key).length;
            const selected = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(item.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  selected
                    ? 'bg-blue-600 text-white'
                    : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                {item.label} ({count})
              </button>
            );
          })}
        </div>

        <select
          aria-label="목표별 프로젝트 필터"
          value={goalFilter}
          onChange={event => setGoalFilter(event.target.value)}
          className={`w-full sm:w-56 ${fieldClass}`}
        >
          <option value="">모든 목표</option>
          {goals.map(goal => (
            <option key={goal.id} value={goal.id}>
              🎯 {goal.title}
            </option>
          ))}
        </select>
      </div>

      {loading && allItems.length === 0 && (
        <p className="text-sm text-zinc-500">프로젝트를 불러오는 중…</p>
      )}
      {!!error && (
        <button
          type="button"
          onClick={() => void refresh()}
          className="text-sm text-red-600 hover:underline dark:text-red-400"
        >
          프로젝트 목록을 불러오지 못했어요. 다시 시도
        </button>
      )}

      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-5 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
            <FolderKanban size={22} />
          </div>
          <h2 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">
            표시할 프로젝트가 없어요
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            2주~3개월 안에 끝내고 싶은 과제를 프로젝트로 만들고, 당장 실행할 다음 행동 1개를 연결해 보세요.
          </p>
          <button
            type="button"
            onClick={() => setDialogState({ open: true })}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={16} /> 첫 프로젝트 만들기
          </button>
        </div>
      )}

      <div className="space-y-4">
        {filtered.map(item => (
          <ProjectCard
            key={item.project.id}
            item={item}
            today={today}
            expanded={expandedIds.has(item.project.id)}
            onToggleExpand={() => toggleExpand(item.project.id)}
            onEdit={project => setDialogState({ open: true, editing: project })}
          />
        ))}
      </div>

      {dialogState.open && (
        <ProjectEditorDialog
          key={dialogState.editing?.id ?? 'new'}
          existing={dialogState.editing}
          nextOrder={allItems.length}
          onClose={() => setDialogState({ open: false })}
          onSaved={saved => {
            setDialogState({ open: false });
            if (tab !== 'all' && saved.status !== tab) setTab(saved.status);
            setExpandedIds(prev => new Set(prev).add(saved.id));
          }}
        />
      )}
    </div>
  );
}
