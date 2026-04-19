'use client';
import { useEffect, useMemo, useState } from 'react';
import { useBinder } from '@/store';
import { Goal } from '@/lib/types';
import { computeMultipleProgress, GoalProgress } from '@/lib/progress';
import { GoalProgressCard } from '@/components/common/GoalProgressCard';

export const GoalSummaryStrip = () => {
  const { goals } = useBinder();
  const [progressMap, setProgressMap] = useState<Map<string, GoalProgress>>(new Map());

  const { highlighted, basis } = useMemo(() => {
    const cores = goals.filter(g => g.level === 'mandalartCore' && g.title).slice(0, 8);
    const subs = goals.filter(g => g.level === 'mandalartSub' && g.title).slice(0, 6);
    if (cores.length > 0) return { highlighted: cores as Goal[], basis: '코어 기준' };
    return { highlighted: subs as Goal[], basis: '서브 기준' };
  }, [goals]);

  const idsKey = highlighted.map(g => g.id).join(',');

  useEffect(() => {
    if (highlighted.length === 0) {
      setProgressMap(new Map());
      return;
    }
    computeMultipleProgress(highlighted.map(g => g.id)).then(setProgressMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  if (highlighted.length === 0) return null;

  return (
    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-50">🎯 목표 진행 요약</h3>
        <span className="text-[10px] text-zinc-500">{basis}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {highlighted.map(g => {
          const p = progressMap.get(g.id);
          if (!p) return null;
          return <GoalProgressCard key={g.id} goal={g} progress={p} />;
        })}
      </div>
    </section>
  );
};
