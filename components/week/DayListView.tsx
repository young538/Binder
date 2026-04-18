'use client';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, NotebookPen } from 'lucide-react';
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
    categories.find((c) => c.id === id)?.color ?? '#a1a1aa';
  const catName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? '';

  const openAdd = () => {
    const start = (settings?.dayStartHour ?? 9) * 60;
    const grid = settings?.gridMinutes ?? 30;
    setEditor({ date: dateStr, startMin: start, endMin: start + grid });
  };

  return (
    <div className="md:hidden bg-zinc-50 dark:bg-zinc-950 min-h-screen">
      <header className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setDayIdx((i) => Math.max(0, i - 1))}
          disabled={dayIdx === 0}
          className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 text-zinc-600 dark:text-zinc-400"
          aria-label="이전 날"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <div className="font-semibold text-zinc-900 dark:text-zinc-50">
            {current.getMonth() + 1}월 {current.getDate()}일{' '}
            <span className="text-zinc-500 font-normal">({DOW[dayIdx]})</span>
          </div>
          <button
            className="mt-1 text-xs text-blue-600 dark:text-blue-400 inline-flex items-center gap-1"
            onClick={() => setRetroOpen(true)}
          >
            <NotebookPen size={12} /> 📝 일일 회고
          </button>
        </div>
        <button
          onClick={() => setDayIdx((i) => Math.min(6, i + 1))}
          disabled={dayIdx === 6}
          className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 text-zinc-600 dark:text-zinc-400"
          aria-label="다음 날"
        >
          <ChevronRight size={20} />
        </button>
      </header>

      <ul className="p-4 space-y-2 pb-24">
        {dayBlocks.length === 0 && (
          <li className="p-8 text-center text-sm text-zinc-400 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
            아직 기록이 없어요
          </li>
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
            className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition"
          >
            <div className="flex">
              <div
                className="w-1.5 self-stretch"
                style={{ background: catColor(b.categoryId) }}
              />
              <div className="flex-1 p-3">
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {b.text || '(내용 없음)'}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="tabular-nums">
                    {minutesToTimeStr(b.startMin)} – {minutesToTimeStr(b.endMin)}
                  </span>
                  {catName(b.categoryId) && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                      <span>{catName(b.categoryId)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="fixed bottom-14 left-4 right-4 z-20">
        <button
          onClick={openAdd}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-lg flex items-center justify-center gap-1.5"
        >
          <Plus size={18} /> 블록 추가
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
