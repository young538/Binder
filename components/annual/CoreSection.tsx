'use client';
import { Goal } from '@/lib/types';
import { SubCard } from './SubCard';

interface Props {
  core: Goal;
  subs: Goal[];
  currentMonth: Date;
}

export const CoreSection = ({ core, subs, currentMonth }: Props) => {
  return (
    <section className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
      <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-50 mb-3">
        {core.title || <span className="text-zinc-400">(코어 제목 미입력)</span>}
      </h2>
      {subs.length === 0 ? (
        <div className="text-xs text-zinc-400">만다라트에서 이 코어의 서브 8개를 입력해주세요.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {subs.sort((a, b) => a.order - b.order).map(s => (
            <SubCard key={s.id} sub={s} currentMonth={currentMonth} />
          ))}
        </div>
      )}
    </section>
  );
};
