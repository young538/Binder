'use client';
import { useState } from 'react';
import { Sparkles, Sunrise } from 'lucide-react';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { useStoredFlag } from '@/lib/hooks/useStoredBoolean';
import { getMorningBoot } from '@/lib/repo/morningBoot';
import { useBinder } from '@/store';
import { MorningBootDialog } from './MorningBootDialog';

export function MorningBootBanner({ date }: { date: string }) {
  const me = useBinder(s => s.me);
  const [bootDone, setBootDone] = useStoredFlag(`binder:morning-boot:${me?.userId ?? 'anon'}:${date}`);
  const { value } = useAsyncResource(
    `morningBoot:${date}`,
    () => getMorningBoot(date),
    null,
    ['todos', 'projects', 'focusNotes', 'lifeEvents', 'people', 'notes'],
  );
  const [open, setOpen] = useState(false);

  if (!value) return null;

  const overdueCount = value.overdueTodos.length;
  const missingActionCount = value.activeProjects.filter(item => item.needsNextAction).length;
  const inboxCount = value.inboxTodos.length;
  const highlight = value.highlight.trim();
  const contextCount =
    (value.upcomingEvents?.length ?? 0) +
    (value.duePeople?.length ?? 0) +
    (value.dueDecisions?.length ?? 0);

  return (
    <>
      {bootDone ? (
        <section
          aria-label="모닝 부팅 배너"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:px-5"
        >
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
                <Sparkles size={13} /> 오늘의 초점
              </span>
              {overdueCount > 0 && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                  밀린 할 일 {overdueCount}개
                </span>
              )}
              {contextCount > 0 && (
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-200">
                  일정·안부·복기 {contextCount}건
                </span>
              )}
            </div>
            <p className={`break-words text-sm ${highlight ? 'font-medium text-zinc-900 dark:text-zinc-50' : 'text-zinc-500 dark:text-zinc-400'}`}>
              {highlight || '오늘의 초점이 아직 비어 있어요'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            부팅 다시 열기
          </button>
        </section>
      ) : (
        <section
          aria-label="모닝 부팅 배너"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-3.5 shadow-sm dark:border-blue-900/70 dark:bg-blue-950/30 md:px-5"
        >
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-blue-900 dark:text-blue-100">
              <Sunrise size={16} className="text-blue-600 dark:text-blue-400" />
              <span>모닝 부팅</span>
            </div>
            <p className="break-words text-xs text-blue-800/80 dark:text-blue-200/80">
              밀린 할 일 {overdueCount}개 · 다음 행동 필요 프로젝트 {missingActionCount}개 · 수집함 {inboxCount}개
              {contextCount > 0 ? ` · 다가오는 일정·안부·복기 ${contextCount}건` : ''}
            </p>
            {highlight && (
              <p className="break-words text-xs font-medium text-zinc-800 dark:text-zinc-100">
                오늘의 초점: {highlight}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            아침 부팅 시작
          </button>
        </section>
      )}

      {open && (
        <MorningBootDialog
          key={date}
          date={date}
          snapshot={value}
          onClose={() => setOpen(false)}
          onComplete={() => {
            setBootDone(true);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
