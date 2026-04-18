'use client';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FocusNoteEditor } from '@/components/common/FocusNoteEditor';
import { TodoListSection } from '@/components/common/TodoListSection';
import { MonthlyCalendar } from './MonthlyCalendar';
import { monthKeyFromString } from '@/lib/utils/period';

interface Props { yyyymm: string; }

const parseYm = (yyyymm: string): [number, number] => {
  const m = yyyymm.match(/^(\d{4})-(\d{2})$/);
  if (!m) return [new Date().getFullYear(), new Date().getMonth() + 1];
  return [Number(m[1]), Number(m[2])];
};

const shiftMonth = (yyyymm: string, delta: number): string => {
  const [y, mo] = parseYm(yyyymm);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const MonthlyPage = ({ yyyymm }: Props) => {
  const periodKey = monthKeyFromString(yyyymm);
  const prev = shiftMonth(yyyymm, -1);
  const next = shiftMonth(yyyymm, 1);
  const [y, mo] = parseYm(yyyymm);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <header className="flex items-center gap-3">
        <Link href={`/monthly/${prev}`}
          className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600">
          <ChevronLeft size={18} />
        </Link>
        <h1 className="text-2xl font-bold flex-1 text-center text-zinc-900 dark:text-zinc-50">
          {y}년 {mo}월
        </h1>
        <Link href={`/monthly/${next}`}
          className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600">
          <ChevronRight size={18} />
        </Link>
      </header>

      <FocusNoteEditor
        scope="month"
        scopeKey={periodKey}
        label="이번 달 한 문장"
        placeholder="예: 릴스 업로드 주 2회 시작" />

      <TodoListSection scope="month" scopeKey={yyyymm} title="이번 달 TODO" />

      <MonthlyCalendar yyyymm={yyyymm} />
    </div>
  );
};
