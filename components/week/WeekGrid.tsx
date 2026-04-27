'use client';
import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useBinder } from '@/store';
import { weekDates, toIsoDate, minutesToTimeStr, toIsoWeek } from '@/lib/utils/date';
import { weekKeyFromString } from '@/lib/utils/period';
import { getTimeBlocksInRange } from '@/lib/repo/timeBlocks';
import { TimeBlock, TimeBlockKind, Todo } from '@/lib/types';
import { addDays } from 'date-fns';
import { BlockEditor } from './BlockEditor';
import { DailyRetroSheet } from './DailyRetroSheet';
import { GoalCoverageBar } from './GoalCoverageBar';
import { FocusNoteEditor } from '@/components/common/FocusNoteEditor';
import { TodoListSection } from '@/components/common/TodoListSection';
import { DayTodoStrip } from './DayTodoStrip';
import { HabitStrip } from './HabitStrip';
import { GoalSummaryStrip } from '@/components/monthly/GoalSummaryStrip';
import { tint } from '@/lib/utils/color';

interface Props {
  isoweek: string;
}

const ROW_HEIGHT = 32; // px per grid row

interface EditorState {
  date: string;
  startMin: number;
  endMin: number;
  kind: TimeBlockKind;
  existing?: TimeBlock;
  prefilledTodoId?: string;
  prefilledText?: string;
}

export const WeekGrid = ({ isoweek }: Props) => {
  const { categories, settings, goals } = useBinder();
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [retroDate, setRetroDate] = useState<string | null>(null);
  const [stripRefresh, setStripRefresh] = useState(0);

  const dates = weekDates(isoweek);
  const rangeStart = toIsoDate(dates[0]);
  const rangeEnd = toIsoDate(dates[6]);
  const today = toIsoDate(new Date());

  const reloadBlocks = () => {
    getTimeBlocksInRange(rangeStart, rangeEnd).then(setBlocks);
  };

  useEffect(() => {
    reloadBlocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart, rangeEnd]);

  if (!settings) return null;
  const { dayStartHour, dayEndHour, gridMinutes } = settings;
  const totalRows = ((dayEndHour - dayStartHour) * 60) / gridMinutes;

  const prevWeek = toIsoWeek(addDays(dates[0], -7));
  const nextWeek = toIsoWeek(addDays(dates[0], 7));

  const catColor = (id: string) =>
    categories.find((c) => c.id === id)?.color ?? '#a1a1aa';

  const openFromTodo = (todo: Todo) => {
    const startMin = dayStartHour * 60;
    setEditor({
      date: todo.scopeKey,
      startMin,
      endMin: startMin + gridMinutes,
      kind: 'plan',
      prefilledTodoId: todo.id,
      prefilledText: todo.title,
    });
  };

  const handleSaved = () => {
    reloadBlocks();
    setStripRefresh((k) => k + 1);
  };

  return (
    <div className="hidden md:block">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <Link
          href={`/week/${prevWeek}`}
          className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400"
          aria-label="이전주"
        >
          <ChevronLeft size={18} />
        </Link>
        <h1 className="font-semibold flex-1 text-center text-zinc-800 dark:text-zinc-50">
          {isoweek}
        </h1>
        <Link
          href={`/week/${nextWeek}`}
          className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400"
          aria-label="다음주"
        >
          <ChevronRight size={18} />
        </Link>
      </header>

      <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <FocusNoteEditor
          scope="week"
          scopeKey={weekKeyFromString(isoweek)}
          label="이번 주 한 문장"
          placeholder="예: 릴스 제작 루틴 실행"
        />
      </div>

      <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <GoalSummaryStrip />
      </div>

      <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <TodoListSection scope="week" scopeKey={isoweek} title="이번 주 TODO" />
      </div>

      <HabitStrip dates={dates} />

      <DayTodoStrip
        dates={dates}
        refreshKey={stripRefresh}
        onMakeBlock={openFromTodo}
        onChanged={() => setStripRefresh((k) => k + 1)}
      />

      {/* 2-column-per-day grid: each day is split into 계획 (plan) | 실제 (actual). */}
      <div
        className="grid overflow-x-auto"
        style={{ gridTemplateColumns: `60px repeat(14, minmax(60px, 1fr))` }}
      >
        {/* Row 1: date header — spans 2 sub-cols */}
        <div className="bg-white dark:bg-zinc-950" style={{ gridColumn: 1, gridRow: 1 }}></div>
        {dates.map((d, i) => {
          const dateStr = toIsoDate(d);
          const isToday = dateStr === today;
          return (
            <button
              key={`h1-${i}`}
              onClick={() => setRetroDate(dateStr)}
              className={`text-center py-2 border-b border-zinc-200 dark:border-zinc-800 text-xs font-medium transition ${
                isToday
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  : 'bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900'
              }`}
              style={{ gridColumn: `${i * 2 + 2} / span 2`, gridRow: 1 }}
            >
              <div className="text-[10px] text-zinc-500 mb-0.5">{d.getMonth() + 1}/{d.getDate()}</div>
              회고 📝
            </button>
          );
        })}

        {/* Row 2: 계획 / 실제 sub-header */}
        <div style={{ gridColumn: 1, gridRow: 2 }}></div>
        {dates.map((_, i) => (
          <Fragment key={`h2-${i}`}>
            <div
              className="text-center text-[10px] py-1 bg-blue-50/60 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 font-semibold border-b border-r border-zinc-100 dark:border-zinc-900"
              style={{ gridColumn: i * 2 + 2, gridRow: 2 }}
            >
              🗓️ 계획
            </div>
            <div
              className="text-center text-[10px] py-1 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 font-semibold border-b border-r border-zinc-100 dark:border-zinc-900"
              style={{ gridColumn: i * 2 + 3, gridRow: 2 }}
            >
              ✅ 실제
            </div>
          </Fragment>
        ))}

        {/* Time labels column (starts at row 3) */}
        {Array.from({ length: totalRows }).map((_, row) => {
          const startMin = dayStartHour * 60 + row * gridMinutes;
          const isHourMark = startMin % 60 === 0;
          return (
            <div
              key={`t-${row}`}
              className={`text-xs pr-2 text-right text-zinc-400 dark:text-zinc-600 border-r border-zinc-100 dark:border-zinc-900 ${
                isHourMark ? 'border-t border-zinc-100 dark:border-zinc-800' : ''
              }`}
              style={{ gridColumn: 1, gridRow: row + 3, height: ROW_HEIGHT }}
            >
              {isHourMark ? minutesToTimeStr(startMin) : ''}
            </div>
          );
        })}

        {/* Sub-columns for each day × {plan, actual} */}
        {dates.map((d, col) => {
          const dateStr = toIsoDate(d);
          const isToday = dateStr === today;
          const subCols: { kind: TimeBlockKind; gridColumn: number }[] = [
            { kind: 'plan', gridColumn: col * 2 + 2 },
            { kind: 'actual', gridColumn: col * 2 + 3 },
          ];
          return subCols.map(({ kind, gridColumn }) => {
            const subBlocks = blocks.filter(b => b.date === dateStr && (b.kind ?? 'plan') === kind);
            const kindBg =
              kind === 'plan'
                ? 'bg-blue-50/20 dark:bg-blue-950/10'
                : 'bg-emerald-50/20 dark:bg-emerald-950/10';
            return (
              <div
                key={`col-${col}-${kind}`}
                className={`relative border-r border-zinc-100 dark:border-zinc-900 ${
                  isToday ? 'bg-blue-50/40 dark:bg-blue-950/20' : kindBg
                }`}
                style={{ gridColumn, gridRow: `3 / span ${totalRows}` }}
              >
                {Array.from({ length: totalRows }).map((_, row) => {
                  const startMin = dayStartHour * 60 + row * gridMinutes;
                  const isHourMark = startMin % 60 === 0;
                  return (
                    <button
                      key={row}
                      data-testid="time-slot"
                      onClick={() =>
                        setEditor({
                          date: dateStr,
                          startMin,
                          endMin: startMin + gridMinutes,
                          kind,
                        })
                      }
                      className={`block w-full transition hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 ${
                        isHourMark ? 'border-t border-zinc-100 dark:border-zinc-800' : ''
                      }`}
                      style={{ height: ROW_HEIGHT }}
                    />
                  );
                })}

                {subBlocks.map((b) => {
                  const topRow = (b.startMin - dayStartHour * 60) / gridMinutes;
                  const spanRows = (b.endMin - b.startMin) / gridMinutes;
                  const color = catColor(b.categoryId);
                  return (
                    <button
                      key={b.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditor({
                          date: b.date,
                          startMin: b.startMin,
                          endMin: b.endMin,
                          kind: b.kind ?? 'plan',
                          existing: b,
                        });
                      }}
                      className="absolute left-0.5 right-0.5 rounded-md shadow-sm hover:shadow-md transition text-left overflow-hidden"
                      style={{
                        top: topRow * ROW_HEIGHT + 1,
                        height: spanRows * ROW_HEIGHT - 2,
                        background: tint.soft(color),
                        borderLeft: `3px solid ${tint.bar(color)}`,
                      }}
                      title={b.text}
                    >
                      <div className="px-1 py-0.5">
                        <div className="text-[10px] font-medium leading-tight text-zinc-800 dark:text-zinc-100 truncate">
                          {b.text || '(내용 없음)'}
                        </div>
                        {spanRows >= 2 && (
                          <div className="text-[9px] text-zinc-600 dark:text-zinc-400 mt-0.5 truncate">
                            {minutesToTimeStr(b.startMin)}–{minutesToTimeStr(b.endMin)}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          });
        })}
      </div>

      <GoalCoverageBar blocks={blocks} goals={goals} categories={categories} />

      {editor && (
        <BlockEditor
          initial={{ date: editor.date, startMin: editor.startMin, endMin: editor.endMin, kind: editor.kind }}
          existing={editor.existing}
          prefilledTodoId={editor.prefilledTodoId}
          prefilledText={editor.prefilledText}
          onClose={() => setEditor(null)}
          onSaved={handleSaved}
        />
      )}

      {retroDate && (
        <DailyRetroSheet date={retroDate} onClose={() => setRetroDate(null)} />
      )}
    </div>
  );
};
