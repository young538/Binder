'use client';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FocusNoteEditor } from '@/components/common/FocusNoteEditor';
import { HabitEditor } from '@/components/settings/HabitEditor';
import { RoutineEditor } from '@/components/settings/RoutineEditor';
import { AnnualGoalTable } from './AnnualGoalTable';
import { yearKeyFromString } from '@/lib/utils/period';

interface Props { year: string; }

export const AnnualPage = ({ year }: Props) => {
  const prevYear = String(Number(year) - 1);
  const nextYear = String(Number(year) + 1);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <header className="flex items-center gap-3">
        <Link href={`/annual/${prevYear}`}
          className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600">
          <ChevronLeft size={18} />
        </Link>
        <h1 className="text-2xl font-bold flex-1 text-center text-zinc-800 dark:text-zinc-50">{year} 연간 계획</h1>
        <Link href={`/annual/${nextYear}`}
          className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600">
          <ChevronRight size={18} />
        </Link>
      </header>

      <FocusNoteEditor
        scope="year"
        scopeKey={yearKeyFromString(year)}
        label="올해 한 문장"
        placeholder="예: 지속가능한 수익 구조를 만든다" />

      <AnnualGoalTable year={year} />

      <HabitEditor />

      <RoutineEditor />
    </div>
  );
};
