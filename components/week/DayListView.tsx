'use client';
import { useEffect, useState } from 'react';
import { useBinder } from '@/store';
import { weekDates, toIsoDate, minutesToTimeStr } from '@/lib/utils/date';
import { getTimeBlocksInRange } from '@/lib/repo/timeBlocks';
import { TimeBlock } from '@/lib/types';
import { BlockEditor } from './BlockEditor';
import { DailyRetroSheet } from './DailyRetroSheet';

interface Props {
  isoweek: string;
}

const DOW = ['월', '화', '수', '목', '금', '토', '일'];

interface EditorState {
  existing?: TimeBlock;
  date: string;
  startMin: number;
  endMin: number;
}

export const DayListView = ({ isoweek }: Props) => {
  const { categories, settings } = useBinder();
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [dayIdx, setDayIdx] = useState(0);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [retroOpen, setRetroOpen] = useState(false);

  const dates = weekDates(isoweek);
  const today = toIsoDate(new Date());
  const todayIdx = dates.findIndex((d) => toIsoDate(d) === today);

  useEffect(() => {
    setDayIdx(todayIdx >= 0 ? todayIdx : 0);
  }, [todayIdx]);

  const rangeStart = toIsoDate(dates[0]);
  const rangeEnd = toIsoDate(dates[6]);

  const reload = () => {
    getTimeBlocksInRange(rangeStart, rangeEnd).then(setBlocks);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart, rangeEnd]);

  const current = dates[dayIdx];
  const dateStr = toIsoDate(current);
  const dayBlocks = blocks
    .filter((b) => b.date === dateStr)
    .sort((a, b) => a.startMin - b.startMin);
  const catColor = (id: string) =>
    categories.find((c) => c.id === id)?.color ?? '#ddd';

  const openAdd = () => {
    const start = (settings?.dayStartHour ?? 9) * 60;
    const grid = settings?.gridMinutes ?? 30;
    setEditor({ date: dateStr, startMin: start, endMin: start + grid });
  };

  return (
    <div className="md:hidden">
      <header className="flex items-center justify-between p-3 border-b">
        <button
          onClick={() => setDayIdx((i) => Math.max(0, i - 1))}
          disabled={dayIdx === 0}
          className="px-3 py-1 disabled:opacity-30"
        >
          ◀
        </button>
        <div className="text-center">
          <div className="font-bold">
            {current.getMonth() + 1}/{current.getDate()} ({DOW[dayIdx]})
          </div>
          <button
            className="text-xs text-blue-600 mt-0.5"
            onClick={() => setRetroOpen(true)}
          >
            📝 일일 회고
          </button>
        </div>
        <button
          onClick={() => setDayIdx((i) => Math.min(6, i + 1))}
          disabled={dayIdx === 6}
          className="px-3 py-1 disabled:opacity-30"
        >
          ▶
        </button>
      </header>

      <ul className="divide-y">
        {dayBlocks.length === 0 && (
          <li className="p-6 text-center text-sm text-gray-400">기록 없음</li>
        )}
        {dayBlocks.map((b) => (
          <li
            key={b.id}
            onClick={() =>
              setEditor({
                existing: b,
                date: b.date,
                startMin: b.startMin,
                endMin: b.endMin,
              })
            }
            className="flex gap-3 p-3 hover:bg-gray-50 cursor-pointer"
          >
            <div
              className="w-3 self-stretch rounded"
              style={{ background: catColor(b.categoryId) }}
            />
            <div className="flex-1">
              <div className="text-sm font-medium">
                {b.text || '(내용 없음)'}
              </div>
              <div className="text-xs text-gray-500">
                {minutesToTimeStr(b.startMin)} ~ {minutesToTimeStr(b.endMin)}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="p-3">
        <button
          onClick={openAdd}
          className="w-full py-2 bg-blue-600 text-white rounded"
        >
          + 블록 추가
        </button>
      </div>

      {editor && (
        <BlockEditor
          initial={{
            date: editor.date,
            startMin: editor.startMin,
            endMin: editor.endMin,
          }}
          existing={editor.existing}
          onClose={() => setEditor(null)}
          onSaved={reload}
        />
      )}
      {retroOpen && (
        <DailyRetroSheet date={dateStr} onClose={() => setRetroOpen(false)} />
      )}
    </div>
  );
};
