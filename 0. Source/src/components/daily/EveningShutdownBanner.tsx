'use client';
import { useState } from 'react';
import { MoonStar, Sparkles } from 'lucide-react';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { useStoredFlag } from '@/lib/hooks/useStoredBoolean';
import { getEveningShutdown } from '@/lib/repo/eveningShutdown';
import { useBinder } from '@/store';
import { EveningShutdownDialog } from './EveningShutdownDialog';

export function EveningShutdownBanner({ date }: { date: string }) {
  const me = useBinder(s => s.me);
  const [done, setDone] = useStoredFlag(`binder:evening-shutdown:${me?.userId ?? 'anon'}:${date}`);
  const { value } = useAsyncResource(
    `eveningShutdown:${date}`,
    () => getEveningShutdown(date),
    null,
    ['timeBlocks', 'todos', 'dailyCheckins', 'retrospectives'],
  );
  const [open, setOpen] = useState(false);

  if (!value) return null;

  return (
    <>
      {done ? (
        <section
          aria-label="이브닝 셧다운 배너"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:px-5"
        >
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              <Sparkles size={13} /> 하루 마감 완료
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              실제 기록 {(value.actualMinutes / 60).toFixed(1)}h · 완료 할 일 {value.doneCount}/{value.totalCount}개
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            마감 다시 열기
          </button>
        </section>
      ) : (
        <section
          aria-label="이브닝 셧다운 배너"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/70 px-4 py-3.5 shadow-sm dark:border-indigo-900/70 dark:bg-indigo-950/30 md:px-5"
        >
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-indigo-950 dark:text-indigo-100">
              <MoonStar size={16} className="text-indigo-600 dark:text-indigo-400" />
              <span>이브닝 셧다운</span>
            </div>
            <p className="break-words text-xs text-indigo-900/80 dark:text-indigo-200/80">
              미확정 계획 {value.unconfirmedPlans.length}개 · 남은 할 일 {value.openTodayTodos.length}개 · 실제 {(value.actualMinutes / 60).toFixed(1)}h
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            저녁 마감 시작
          </button>
        </section>
      )}

      {open && (
        <EveningShutdownDialog
          key={date}
          date={date}
          snapshot={value}
          onClose={() => setOpen(false)}
          onComplete={() => {
            setDone(true);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
