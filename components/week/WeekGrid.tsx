'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useBinder } from '@/store';
import { weekDates, toIsoDate, minutesToTimeStr, toIsoWeek } from '@/lib/utils/date';
import { getTimeBlocksInRange } from '@/lib/repo/timeBlocks';
import { TimeBlock } from '@/lib/types';
import { addDays } from 'date-fns';

interface Props { isoweek: string; }

const DOW = ['월', '화', '수', '목', '금', '토', '일'];

export const WeekGrid = ({ isoweek }: Props) => {
  const { categories, settings } = useBinder();
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);

  const dates = weekDates(isoweek);
  const rangeStart = toIsoDate(dates[0]);
  const rangeEnd = toIsoDate(dates[6]);

  useEffect(() => {
    getTimeBlocksInRange(rangeStart, rangeEnd).then(setBlocks);
  }, [rangeStart, rangeEnd]);

  if (!settings) return null;
  const { dayStartHour, dayEndHour, gridMinutes } = settings;
  const totalRows = ((dayEndHour - dayStartHour) * 60) / gridMinutes;

  const prevWeek = toIsoWeek(addDays(dates[0], -7));
  const nextWeek = toIsoWeek(addDays(dates[0], 7));

  const catColor = (id: string) => categories.find((c) => c.id === id)?.color ?? '#ddd';

  return (
    <div>
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
          <div key={i} className="text-center py-2 border-b text-sm font-medium">
            {DOW[i]} {d.getMonth() + 1}/{d.getDate()}
          </div>
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
                  <div
                    key={col}
                    className="border-b border-r h-6 text-[10px] overflow-hidden hover:bg-gray-50"
                    style={match ? { background: catColor(match.categoryId) } : {}}
                    title={match?.text}
                  >
                    {match && match.startMin === startMin ? match.text : ''}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
