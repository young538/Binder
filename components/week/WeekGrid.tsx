'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
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

interface EditorState {
  date: string;
  startMin: number;
  endMin: number;
  existing?: TimeBlock;
}

export const WeekGrid = ({ isoweek }: Props) => {
  const { categories, settings, goals } = useBinder();
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [retroDate, setRetroDate] = useState<string | null>(null);

  const dates = weekDates(isoweek);
  const rangeStart = toIsoDate(dates[0]);
  const rangeEnd = toIsoDate(dates[6]);

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

  const catColor = (id: string) => categories.find((c) => c.id === id)?.color ?? '#ddd';

  const openNew = (date: string, startMin: number) => {
    setEditor({ date, startMin, endMin: startMin + gridMinutes });
  };

  const openEdit = (block: TimeBlock) => {
    setEditor({
      date: block.date,
      startMin: block.startMin,
      endMin: block.endMin,
      existing: block,
    });
  };

  return (
    <div className="hidden md:block">
      <header className="flex items-center gap-3 p-3 border-b">
        <Link href={`/week/${prevWeek}`} className="px-2 py-1 rounded hover:bg-gray-100">
          ◀ 이전주
        </Link>
        <h1 className="font-bold flex-1 text-center">{isoweek}</h1>
        <Link href={`/week/${nextWeek}`} className="px-2 py-1 rounded hover:bg-gray-100">
          다음주 ▶
        </Link>
      </header>

      <div
        className="grid overflow-x-auto"
        style={{ gridTemplateColumns: `60px repeat(7, minmax(80px, 1fr))` }}
      >
        <div></div>
        {dates.map((d, i) => (
          <button
            key={i}
            onClick={() => setRetroDate(toIsoDate(d))}
            className="text-center py-2 border-b text-sm font-medium hover:bg-blue-50"
          >
            {DOW[i]} {d.getMonth() + 1}/{d.getDate()}{' '}
            <span className="text-xs text-blue-600">📝</span>
          </button>
        ))}

        {Array.from({ length: totalRows }).map((_, row) => {
          const startMin = dayStartHour * 60 + row * gridMinutes;
          return (
            <div key={row} className="contents">
              <div className="text-xs text-gray-400 pr-1 text-right border-r">
                {startMin % 60 === 0 ? minutesToTimeStr(startMin) : ''}
              </div>
              {dates.map((d, col) => {
                const dateStr = toIsoDate(d);
                const match = blocks.find(
                  (b) => b.date === dateStr && b.startMin <= startMin && b.endMin > startMin,
                );
                return (
                  <button
                    key={col}
                    onClick={() => (match ? openEdit(match) : openNew(dateStr, startMin))}
                    className="border-b border-r h-6 text-[10px] overflow-hidden text-left hover:bg-gray-50"
                    style={match ? { background: catColor(match.categoryId) } : {}}
                    title={match?.text}
                  >
                    {match && match.startMin === startMin ? match.text : ''}
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
