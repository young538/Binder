'use client';

import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getDailyDateLabel, type DailyAgendaDay } from './useDailyAgenda';
import { CheckCheck, Plus, RotateCcw } from 'lucide-react';
import { BlockEditor } from '@/components/week/BlockEditor';
import { TimeGrid } from '@/components/common/TimeGrid';
import { unconfirmedPlansForDay } from '@/lib/time-grid/confirmation';
import { confirmPlansAsActual } from '@/lib/repo/timeBlocks';
import { minutesToTimeStr } from '@/lib/utils/date';
import type { LifeEvent, TimeBlock, TimeBlockKind } from '@/lib/types';
import { useBinder } from '@/store';

interface Props {
  days: DailyAgendaDay[];
  today: string;
  dayEvents: LifeEvent[];
  loading: boolean;
  loadError: boolean;
  onRetry: () => void;
}

interface EditorState {
  date: string;
  startMin: number;
  endMin: number;
  kind: TimeBlockKind;
  prefilledText?: string;
  categoryId?: string | null;
  goalId?: string | null;
  projectId?: string | null;
  todoId?: string | null;
  existing?: TimeBlock;
}

const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}시간 ${rest}분` : `${hours}시간`;
};

interface DayRecordsProps {
  day: DailyAgendaDay;
  dayEvents: LifeEvent[];
  label: string;
  showList: boolean;
}

function DayRecords({ day: { date, blocks }, dayEvents, label, showList }: DayRecordsProps) {
  const { categories, goals, projects, settings } = useBinder();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');

  // Older imported rows may not have kind; retain the historical plan default.
  const plans = useMemo(() => blocks.filter((block) => (block.kind ?? 'plan') === 'plan'), [blocks]);
  const actuals = useMemo(() => blocks.filter((block) => block.kind === 'actual'), [blocks]);
  const timedDayEvents = useMemo(
    () => dayEvents.filter(ev => !ev.allDay && ev.startMin != null && ev.endMin != null && ev.date === date),
    [dayEvents, date],
  );
  const openEventAsPlan = (ev: LifeEvent) => {
    const startMin = ev.startMin ?? (settings?.dayStartHour ?? 9) * 60;
    const grid = settings?.gridMinutes ?? 30;
    const endMin = ev.endMin ?? Math.min(1440, startMin + grid);
    setEditor({
      date,
      startMin,
      endMin,
      kind: 'plan',
      prefilledText: ev.title,
      categoryId: categories[0]?.id ?? null,
      goalId: ev.goalId ?? null,
      projectId: ev.projectId ?? null,
    });
  };
  const unconfirmedPlans = useMemo(() => unconfirmedPlansForDay(blocks), [blocks]);

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const goalById = useMemo(() => new Map(goals.map((goal) => [goal.id, goal])), [goals]);
  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  const handleConfirmAll = async () => {
    if (confirmBusy || unconfirmedPlans.length === 0) return;
    setConfirmBusy(true);
    setConfirmMsg('');
    try {
      const res = await confirmPlansAsActual(date);
      setConfirmMsg(res.created > 0 ? `${res.created}개 계획을 실제 기록으로 확정했어요.` : '이미 모두 실제 기록에 반영되었어요.');
    } catch {
      setConfirmMsg('계획 확정에 실패했어요. 다시 시도해 주세요.');
    } finally {
      setConfirmBusy(false);
    }
  };

  const newSlot = (kind: TimeBlockKind): EditorState => {
    const startMin = Math.max(0, Math.min(1440 - 1, (settings?.dayStartHour ?? 9) * 60));
    const grid = settings?.gridMinutes ?? 30;
    const endMin = Math.min(1440, startMin + Math.max(1, grid));
    return {
      date,
      startMin,
      endMin: endMin > startMin ? endMin : Math.min(1440, startMin + 1),
      kind,
      categoryId: categories[0]?.id ?? null,
    };
  };

  const openEditor = (block: TimeBlock) => {
    setEditor({
      date: block.date,
      startMin: block.startMin,
      endMin: block.endMin,
      kind: block.kind ?? 'plan',
      categoryId: block.categoryId,
      goalId: block.goalId ?? null,
      projectId: block.projectId ?? null,
      todoId: block.todoId ?? null,
      existing: block,
    });
  };

  const renderColumn = (kind: TimeBlockKind, title: string, rows: TimeBlock[]) => {
    const total = rows.reduce((sum, block) => sum + Math.max(0, block.endMin - block.startMin), 0);
    const canAdd = categories.length > 0;
    return (
      <section aria-label={kind === 'plan' ? '하루 계획' : '실제 진행'} className="min-w-0">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">합계 {formatDuration(total)}</p>
          </div>
          <button
            type="button"
            onClick={() => canAdd && setEditor(newSlot(kind))}
            disabled={!canAdd}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Plus size={14} />
            {kind === 'plan' ? '계획 추가' : '실제 기록 추가'}
          </button>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-zinc-400">아직 {kind === 'plan' ? '계획' : '실제 기록'}이 없어요.</p>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.map((block) => {
              const category = categoryById.get(block.categoryId);
              const goal = block.goalId ? goalById.get(block.goalId) : undefined;
              const project = block.projectId ? projectById.get(block.projectId) : undefined;
              const duration = Math.max(0, block.endMin - block.startMin);
              return (
                <button
                  key={block.id}
                  type="button"
                  aria-label={`${block.text || '(내용 없음)'} 편집`}
                  onClick={() => openEditor(block)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <span className="w-20 shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                    {minutesToTimeStr(block.startMin)}–{minutesToTimeStr(block.endMin)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-medium text-zinc-800 dark:text-zinc-100">
                      {block.text || '(내용 없음)'}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span>{formatDuration(duration)}</span>
                      {category && <span>{category.name}</span>}
                      {project && <span className="text-indigo-600 dark:text-indigo-400">📁 {project.title}</span>}
                      {goal && <span>목표: {goal.title}</span>}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {!canAdd && (
          <p className="border-t border-zinc-100 px-4 py-3 text-xs text-amber-600 dark:border-zinc-800 dark:text-amber-400">
            카테고리를 먼저 추가하면 기록할 수 있어요.
          </p>
        )}
      </section>
    );
  };

  return (
    <section aria-label={`${date} 계획과 실제`} className="min-w-0">
      <div className="px-2 py-3 sm:px-4">
        <h3 className="flex flex-col items-start gap-x-1.5 text-sm font-semibold sm:flex-row sm:flex-wrap sm:items-baseline">
          {label}
          <time dateTime={date} className="text-xs font-normal tabular-nums text-zinc-500">
            {format(parseISO(date), 'M.d (EEE)', { locale: ko })}
          </time>
        </h3>
        <p className="mt-2 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          <span className="inline-block">계획 {formatDuration(plans.reduce((sum, block) => sum + block.endMin - block.startMin, 0))}</span>
          {' · '}
          <span className="inline-block">실제 {formatDuration(actuals.reduce((sum, block) => sum + block.endMin - block.startMin, 0))}</span>
        </p>
        {confirmMsg && (
          <p role="status" className="mt-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            {confirmMsg}
          </p>
        )}
        {unconfirmedPlans.length > 0 && (
          <button
            type="button"
            disabled={confirmBusy}
            onClick={() => void handleConfirmAll()}
            className="mt-2 inline-flex max-w-full items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-1.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300 sm:px-2.5"
          >
            <CheckCheck size={14} className="hidden shrink-0 sm:block" />
            <span><span className="sr-only sm:not-sr-only">계획 → </span>{confirmBusy ? '확정 중…' : `실제 확정 (${unconfirmedPlans.length})`}</span>
          </button>
        )}
      </div>
      {showList && (
        <div>
          {timedDayEvents.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 bg-indigo-50/40 px-4 py-2.5 dark:border-zinc-800 dark:bg-indigo-950/20">
              <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">캘린더 일정</span>
              {timedDayEvents.map(ev => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => openEventAsPlan(ev)}
                  className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900 dark:bg-zinc-900 dark:text-indigo-300"
                >
                  <span>
                    {minutesToTimeStr(ev.startMin!)}–{minutesToTimeStr(ev.endMin!)} {ev.title}
                  </span>
                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">+ 계획</span>
                </button>
              ))}
            </div>
          )}
          <div className="grid divide-y divide-zinc-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-1 lg:divide-x-0 lg:divide-y dark:divide-zinc-800">
            {renderColumn('plan', '계획', plans)}
            {renderColumn('actual', '실제 진행', actuals)}
          </div>
        </div>
      )}
      {editor && (
        <BlockEditor
          key={editor.existing?.id ?? `${editor.date}-${editor.kind}-${editor.startMin}-${editor.prefilledText ?? ''}`}
          initial={{
            date: editor.date,
            startMin: editor.startMin,
            endMin: editor.endMin,
            kind: editor.kind,
            text: editor.prefilledText,
            categoryId: editor.categoryId,
            goalId: editor.goalId,
            projectId: editor.projectId,
            todoId: editor.todoId,
          }}
          existing={editor.existing}
          prefilledText={editor.prefilledText}
          onClose={() => setEditor(null)}
          onSaved={() => undefined}
        />
      )}
    </section>
  );
}

export function DailyTimeBlocks({ days, today, dayEvents, loading, loadError, onRetry }: Props) {
  const [view, setView] = useState<'timeline' | 'list'>('timeline');
  const error = loadError ? '하루 계획과 실제 기록을 불러오지 못했어요. 다시 시도해 주세요.' : '';
  return (
    <section aria-label="하루 계획과 실제" className="mb-5 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">하루 계획과 실제</h2>
        <div className="flex shrink-0 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800" aria-label="기록 보기 방식">
          {(['timeline', 'list'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              aria-pressed={view === mode}
              onClick={() => setView(mode)}
              className={`rounded-md px-2.5 py-1 text-xs ${view === mode ? 'bg-white font-semibold text-indigo-600 shadow-sm dark:bg-zinc-700 dark:text-indigo-300' : 'text-zinc-500'}`}
            >
              {mode === 'timeline' ? '시간표' : '목록'}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div aria-label="하루 계획과 실제를 불러오는 중" className="grid animate-pulse gap-px bg-zinc-100 md:grid-cols-2 dark:bg-zinc-800">
          <div className="h-28 bg-white dark:bg-zinc-900" />
          <div className="h-28 bg-white dark:bg-zinc-900" />
        </div>
      ) : error ? (
        <div role="alert" className="flex items-center justify-center gap-3 px-5 py-8 text-sm text-rose-600 dark:text-rose-400">
          <span>{error}</span>
          <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 font-semibold underline">
            <RotateCcw size={14} /> 다시 시도
          </button>
        </div>
      ) : (
        <>
          <div className={`grid divide-zinc-100 dark:divide-zinc-800 ${view === 'timeline'
            ? 'grid-cols-3 divide-x pl-[clamp(38px,10vw,60px)]' : 'divide-y lg:grid-cols-3 lg:divide-x lg:divide-y-0'}`}>
            {days.map((day, index) => (
              <DayRecords key={day.date} day={day} dayEvents={dayEvents}
                label={getDailyDateLabel(day.date, today, index)} showList={view === 'list'} />
            ))}
          </div>
          {view === 'timeline' && (
            <div className="max-h-[520px] overflow-y-auto overscroll-contain" data-daily-timeline>
              <TimeGrid fitToWidth dates={days.map(day => parseISO(day.date))}
                blocks={days.flatMap(day => day.blocks)} calendarEvents={dayEvents} />
            </div>
          )}
        </>
      )}
    </section>
  );
}
