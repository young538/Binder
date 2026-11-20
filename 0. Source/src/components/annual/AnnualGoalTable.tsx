'use client';
import { Plus } from 'lucide-react';
import { useAnnualGoals } from './useAnnualGoals';
import { AnnualGoalDesktop } from './AnnualGoalDesktop';
import { AnnualGoalMobile } from './AnnualGoalMobile';

export const AnnualGoalTable = ({ year }: { year: string }) => {
  const model = useAnnualGoals(year);
  return (
    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-50">{year}년 목표</h2>
        <button
          onClick={model.addRow}
          className="hidden md:flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          <Plus size={12} /> 행 추가
        </button>
      </div>

      <AnnualGoalDesktop {...model} />
      <AnnualGoalMobile {...model} />

      <div className="px-4 py-2 text-[10px] text-zinc-500 bg-zinc-50 dark:bg-zinc-800/30">
        💡 각 월 셀의 위 숫자=계획(목표), 아래=실적. 월 계획을 입력하면 연 목표가 자동 합산됩니다. 달성률 = Σ실적 / 목표.
      </div>
    </section>
  );
};
