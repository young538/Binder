'use client';
import { useEffect, useMemo, useState } from 'react';
import type { AnnualGoal, Habit } from '@/lib/types';
import { listByYear, createAnnualGoal, updateAnnualGoal, deleteAnnualGoal, ensureSeven } from '@/lib/repo/annualGoals';
import { listHabits } from '@/lib/repo/habits';
import { useBinder } from '@/store';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';

export function useAnnualGoals(year: string) {
  const { goals: mandalartGoals } = useBinder();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { value: [goals, habits], refresh: reload } = useAsyncResource(
    year, () => Promise.all([listByYear(year), listHabits()]), [[], []], ['annualGoals', 'habits', 'habitLogs'],
  );
  useEffect(() => { void ensureSeven(year).then(() => reload()).catch(() => reload()); }, [year, reload]);
  const habitsByAnnualId = useMemo(() => {
    const groups = new Map<string, Habit[]>();
    for (const habit of habits) {
      if (!habit.annualGoalId) continue;
      const linked = groups.get(habit.annualGoalId) ?? [];
      linked.push(habit);
      groups.set(habit.annualGoalId, linked);
    }
    return groups;
  }, [habits]);

  const patch = async (g: AnnualGoal, field: keyof AnnualGoal, value: unknown) => {
    await updateAnnualGoal(g.id, { [field]: value } as Partial<AnnualGoal>);
    reload();
  };

  const patchMonthly = async (
    g: AnnualGoal,
    type: 'monthlyTargets' | 'monthlyActuals',
    idx: number,
    value: string,
  ) => {
    const arr = [...g[type]];
    arr[idx] = value === '' ? null : Number(value);
    const patch: Partial<AnnualGoal> = { [type]: arr };
    // 월 목표 입력 시 연 목표(target)를 자동 합산
    if (type === 'monthlyTargets') {
      const sum = arr.reduce<number>((s, v) => s + (v ?? 0), 0);
      if (sum > 0) patch.target = sum;
    }
    await updateAnnualGoal(g.id, patch);
    reload();
  };

  const addRow = async () => {
    const order = goals.length ? Math.max(...goals.map(g => g.order)) + 1 : 1;
    await createAnnualGoal(year, order);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm('삭제할까요?')) return;
    await deleteAnnualGoal(id);
    reload();
  };

  return { goals, habitsByAnnualId, mandalartGoals, expandedId, setExpandedId, patch, patchMonthly, addRow, remove };
}
export type AnnualGoalViewModel = ReturnType<typeof useAnnualGoals>;
