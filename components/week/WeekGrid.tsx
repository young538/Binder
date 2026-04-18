'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, NotebookPen } from 'lucide-react';
import { useBinder } from '@/store';
import { weekDates, toIsoDate, minutesToTimeStr, toIsoWeek } from '@/lib/utils/date';
import { getTimeBlocksInRange } from '@/lib/repo/timeBlocks';
import { TimeBlock } from '@/lib/types';
import { addDays } from 'date-fns';
import { BlockEditor } from './BlockEditor';
import { GoalCoverageBar } from './GoalCoverageBar';
import { DailyRetroSheet } from './DailyRetroSheet';

interface Props {
  isoweek: string;
}

const DOW = ['월', '화', '수', '목', '금', '토', '일'];
const ROW_HEIGHT = 32; // px per grid row

interface EditorState {
  date: string;
  startMin: number;
  endMin: number;
  existing?: TimeBlock;
}

const tintBg = (hex: string, opacity = 0.22) => {
  const h = hex.replace('#', '');
  if (h.length !== 6) return `rgba(161,161,170,${opacity})`;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
};

export const WeekGrid = ({ isoweek }: Props) => {
  const { categories, settings, goals } = useBinder();
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [retroDate, setRetroDate] = useState<string | null>(null);

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
        <h1 className="font-semibold flex-1 text-center text-zinc-900 dark:text-zinc-50">
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

      <div
        className="grid overflow-x-auto"
        style={{ gridTemplateColumns: `60px repeat(7, minmax(80px, 1fr))` }}
      >
        <div className="bg-white dark:bg-zinc-950"></div>
        {dates.map((d, i) => {
          const dateStr = toIsoDate(d);
          const isToday = dateStr === today;
          return (
            <button
              key={i}
              onClick={() => setRetroDate(dateStr)}
              className={`text-center py-2.5 border-b border-zinc-200 dark:border-zinc-800 text-sm font-medium transition ${
                isToday
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  : 'bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                <span>{DOW[i]}</span>
                <span className="text-xs font-normal opacity-70">
                  {d.getMonth() + 1}/{d.getDate()}
                </span>
              </div>
              <div className="flex items-center justify-center gap-0.5 mt-0.5">
                <NotebookPen size={11} className="text-blue-500 opacity-60" />
                <span className="text-[10px] text-blue-600 dark:text-blue-400 opacity-0">📝</span>
              </div>
            </button>
          );
        })}

        {/* Time labels column */}
        {Array.from({ length: totalRows }).map((_, row) => {
          const startMin = dayStartHour * 60 + row * gridMinutes;
          const isHourMark = startMin % 60 === 0;
          return (
            <div
              key={`t-${row}`}
              className={`text-xs pr-2 text-right text-zinc-400 dark:text-zinc-600 border-r border-zinc-100 dark:border-zinc-900 ${
                isHourMark ? 'border-t border-zinc-200 dark:border-zinc-800' : ''
              }`}
              style={{ gridColumn: 1, gridRow: row + 2, height: ROW_HEIGHT }}
            >
              {isHourMark ? minutesToTimeStr(startMin) : ''}
            </div>
          );
        })}

        {/* Day columns with absolutely-positioned blocks */}
        {dates.map((d, col) => {
          const dateStr = toIsoDate(d);
          const isToday = dateStr === today;
          const dayBlocks = blocks.filter((b) => b.date === dateStr);
          return (
            <div
              key={`col-${col}`}
              className={`relative border-r border-zinc-100 dark:border-zinc-900 ${
                isToday ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
              }`}
              style={{ gridColumn: col + 2, gridRow: `2 / span ${totalRows}` }}
            >
              {Array.from({ length: totalRows }).map((_, row) => {
                const startMin = dayStartHour * 60 + row * gridMinutes;
                const isHourMark = startMin % 60 === 0;
                return (
                  <button
                    key={row}
                    onClick={() =>
                      setEditor({
                        date: dateStr,
                        startMin,
                        endMin: startMin + gridMinutes,
                      })
                    }
                    className={`block w-full transition hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 ${
                      isHourMark ? 'border-t border-zinc-200 dark:border-zinc-800' : ''
                    }`}
                    style={{ height: ROW_HEIGHT }}
                  />
                );
              })}

              {dayBlocks.map((b) => {
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
                        existing: b,
                      });
                    }}
                    className="absolute left-0.5 right-0.5 rounded-md shadow-sm hover:shadow-md transition text-left overflow-hidden"
                    style={{
                      top: topRow * ROW_HEIGHT + 1,
                      height: spanRows * ROW_HEIGHT - 2,
                      background: tintBg(color, 0.22),
                      borderLeft: `3px solid ${color}`,
                    }}
                    title={b.text}
                  >
                    <div className="px-1.5 py-1">
                      <div className="text-[11px] font-medium leading-tight text-zinc-900 dark:text-zinc-100 truncate">
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
        })}
      </div>

      <GoalCoverageBar blocks={blocks} goals={goals} categories={categories} />

      {editor && (
        <BlockEditor
          initial={{ date: editor.date, startMin: editor.startMin, endMin: editor.endMin }}
          existing={editor.existing}
          onClose={() => setEditor(null)}
          onSaved={reloadBlocks}
        />
      )}

      {retroDate && (
        <DailyRetroSheet date={retroDate} onClose={() => setRetroDate(null)} />
      )}
    </div>
  );
};
