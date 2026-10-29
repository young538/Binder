'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Settings2,
} from 'lucide-react';
import {
  addDays,
  format,
  parseISO,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { toIsoDate } from '@/lib/utils/date';
import {
  habitScheduleLabel,
} from '@/lib/utils/habitSchedule';
import { tint } from '@/lib/utils/color';
import { useBinder } from '@/store';
import { TodoListSection } from '@/components/common/TodoListSection';
import { useDailyTracker } from './useDailyTracker';
import { HabitCheckRow } from './HabitCheckRow';
import { DailyRecord } from '@/components/daily/DailyRecord';
import { DailyRoutineSheet } from '@/components/daily/DailyRoutineSheet';
import { DailyReading } from '@/components/daily/DailyReading';
import { DailyTimeBlocks } from '@/components/daily/DailyTimeBlocks';

interface Props {
  date: string;
}

const LoadingRows = () => (
  <div className="space-y-3 p-5" aria-label="루틴을 불러오는 중">
    {[0, 1, 2, 3].map((row) => (
      <div key={row} className="flex animate-pulse items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-4 flex-1 rounded bg-zinc-100 dark:bg-zinc-800" />
      </div>
    ))}
  </div>
);

export const DailyPage = (props: Props) => <DailyPageSession key={props.date} {...props} />;

const DailyPageSession = ({ date }: Props) => {
  const { categories } = useBinder();
  const selectedDate = useMemo(() => parseISO(date), [date]);
  const today = toIsoDate(new Date());
  const [routineOpen, setRoutineOpen] = useState(false);
  const { habits, loading, loadError, actionError, presetBusy, pendingIds, groups,
    fixedHabits, flexibleHabits, completedToday, fixedDone, fixedPercent,
    toggle, addTrackerPreset, flexibleProgress } = useDailyTracker(date, categories);

  const previousDate = toIsoDate(addDays(selectedDate, -1));
  const nextDate = toIsoDate(addDays(selectedDate, 1));
  const isToday = date === today;


  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-8">
        <header className="mb-5 rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:px-6">
          <div className="flex items-center gap-3">
            <Link
              href={`/daily/${previousDate}`}
              aria-label="이전 날"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <ChevronLeft size={20} />
            </Link>
            <div className="min-w-0 flex-1 text-center">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                Daily Tracker
              </div>
              <h1 className="mt-0.5 text-xl font-bold text-zinc-900 dark:text-zinc-50 md:text-2xl">
                {format(selectedDate, 'M월 d일 EEEE', { locale: ko })}
              </h1>
              <div className="mt-1 text-xs text-zinc-500">{format(selectedDate, 'yyyy년')}</div>
            </div>
            <Link
              href={`/daily/${nextDate}`}
              aria-label="다음 날"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <ChevronRight size={20} />
            </Link>
          </div>
          {!isToday && (
            <div className="mt-3 flex justify-center">
              <Link
                href={`/daily/${today}`}
                className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
              >
                오늘로 돌아가기
              </Link>
            </div>
          )}
        </header>

        <DailyTimeBlocks key={date} date={date} />

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.85fr)]">
          <div className="space-y-5">
            <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
                <div className={`flex items-end justify-between gap-4 ${habits.length === 0 ? 'hidden' : ''}`}>
                  <div>
                    <p className="text-xs font-medium text-zinc-500">오늘의 고정 루틴</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                      {fixedDone}
                      <span className="ml-1 text-base font-medium text-zinc-400">/ {fixedHabits.length}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                      {fixedPercent}%
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {fixedHabits.length > 0 && fixedDone === fixedHabits.length ? '오늘 루틴 완료' : '하나씩 체크해 보세요'}
                    </div>
                  </div>
                </div>
                <div
                  className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
                  role="progressbar"
                  aria-label="오늘의 고정 루틴 완료율"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={fixedPercent}
                >
                  <div
                    className="h-full rounded-full bg-blue-500 transition-[width] duration-300"
                    style={{ width: `${fixedPercent}%` }}
                  />
                </div>
              </div>

              {loading ? (
                <LoadingRows />
              ) : loadError ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-rose-600 dark:text-rose-400">{loadError}</p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="mt-3 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    다시 불러오기
                  </button>
                </div>
              ) : habits.length === 0 ? (
                <div className="px-5 py-9 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                    <ListChecks size={24} />
                  </div>
                  <h2 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">고정 루틴을 준비해 볼까요?</h2>
                  <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    9월 트래커의 일정 정리, 명상, 독서, 기록, 운동 항목을 매일 체크하는 루틴으로 추가할 수 있어요.
                  </p>
                  <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={addTrackerPreset}
                      disabled={presetBusy}
                      className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                    >
                      {presetBusy ? '추가 중…' : '9월 트래커 루틴 추가'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoutineOpen(true)}
                      className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      직접 만들기
                    </button>
                  </div>
                </div>
              ) : groups.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">이 날짜에 예정된 고정 루틴이 없어요.</p>
                  <button
                    type="button"
                    onClick={() => setRoutineOpen(true)}
                    className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    반복 요일 관리
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {groups.map((group) => (
                    <div key={group.id}>
                      <div
                        className="flex items-center gap-2 border-b border-zinc-100 px-4 py-2 dark:border-zinc-800"
                        style={{ background: tint.soft(group.color, 0.25) }}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ background: group.color }} />
                        <h2 className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">{group.name}</h2>
                        <span className="text-[11px] text-zinc-500">{group.habits.length}개</span>
                      </div>
                      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {group.habits.map((habit) => (
                          <HabitCheckRow key={habit.id} habit={habit}
                            done={completedToday.has(habit.id)} pending={pendingIds.has(habit.id)}
                            color={categories.find(category => category.id === habit.categoryId)?.color ?? habit.color}
                            onToggle={toggle} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loading && habits.length > 0 && (
                <div className="flex justify-end border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setRoutineOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400"
                  >
                    <Settings2 size={14} /> 루틴 관리
                  </button>
                </div>
              )}
            </section>

            {!loading && flexibleHabits.length > 0 && (
              <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">기간 목표</h2>
                  <p className="mt-0.5 text-xs text-zinc-500">요일이 정해지지 않은 주·월 단위 루틴이에요.</p>
                </div>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {flexibleHabits.map((habit) => {
                    const progress = flexibleProgress(habit);
                    const doneToday = completedToday.has(habit.id);
                    if (!progress) return null;
                    return (
                      <div key={habit.id} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggle(habit)}
                            disabled={pendingIds.has(habit.id)}
                            aria-pressed={doneToday}
                            aria-label={`${habit.name} ${doneToday ? '오늘 완료 취소' : '오늘 완료'}`}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-95 disabled:cursor-wait disabled:opacity-60"
                            style={{
                              background: doneToday ? tint.strong(habit.color) : 'transparent',
                              borderColor: doneToday ? habit.color : 'var(--color-border)',
                            }}
                          >
                            {doneToday && <Check size={19} strokeWidth={3} className="text-zinc-900" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{habit.name}</span>
                              <span className="shrink-0 text-xs font-semibold tabular-nums text-zinc-600 dark:text-zinc-300">
                                {progress.done}/{progress.target}회
                              </span>
                            </div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                              <div
                                className="h-full rounded-full transition-[width] duration-300"
                                style={{ background: habit.color, width: `${progress.percent}%` }}
                              />
                            </div>
                            <div className="mt-1 flex justify-between text-[11px] text-zinc-400">
                              <span>{progress.label}</span>
                              <span>{doneToday ? '오늘 완료' : habitScheduleLabel(habit.schedule)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {actionError && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
                {actionError}
              </div>
            )}
          </div>

          <aside className="space-y-5">
            <TodoListSection scope="day" scopeKey={date} title="오늘 할 일" />
            <DailyReading key={`reading-${date}`} date={date} />
          </aside>
        </div>
        <div className="mt-5" aria-label="일일 기록 모음">
          <DailyRecord date={date} />
        </div>
      </div>

      {routineOpen && (
        <DailyRoutineSheet
          onClose={() => setRoutineOpen(false)}
        />
      )}
    </div>
  );
};
