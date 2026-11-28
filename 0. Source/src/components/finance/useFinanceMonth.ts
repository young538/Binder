'use client';

import { useEffect, useMemo } from 'react';
import { getFinanceCycleRange, resolveEffectiveBudgets, summarizeMonthFinance } from '@/lib/finance';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { getFinanceAutomationStatus, listFinanceBudgets, listFinanceTransactions } from '@/lib/repo/finance';

export function useFinanceMonth(month: string, cycleStartDay: number, todayIso: string) {
  const cycleRange = useMemo(
    () => getFinanceCycleRange(month, cycleStartDay),
    [cycleStartDay, month],
  );

  const transactionsQuery = useAsyncResource(
    `finance:tx:${month}:d${cycleStartDay}`,
    () =>
      listFinanceTransactions({
        startDate: cycleRange.prevStartDate,
        endDate: cycleRange.endDate,
      }),
    [],
    ['financeTransactions'],
  );

  const budgetsQuery = useAsyncResource(
    `finance:budgets:${month}`,
    () => listFinanceBudgets(month),
    [],
    ['financeBudgets'],
  );

  const automationQuery = useAsyncResource(
    'finance:automation',
    getFinanceAutomationStatus,
    null,
    ['financeAutomation'],
  );

  const { value: rangeTransactions, refresh: refreshTx } = transactionsQuery;
  const { value: budgets, refresh: refreshBudgets } = budgetsQuery;
  const { refresh: refreshAutomation } = automationQuery;

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshTx();
        void refreshBudgets();
        void refreshAutomation();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [refreshAutomation, refreshBudgets, refreshTx]);

  const monthTransactions = useMemo(
    () =>
      rangeTransactions.filter(
        t => t.date >= cycleRange.startDate && t.date <= cycleRange.endDate,
      ),
    [cycleRange.endDate, cycleRange.startDate, rangeTransactions],
  );

  const prevTransactions = useMemo(
    () =>
      rangeTransactions.filter(
        t => t.date >= cycleRange.prevStartDate && t.date <= cycleRange.prevEndDate,
      ),
    [cycleRange.prevEndDate, cycleRange.prevStartDate, rangeTransactions],
  );

  const summary = useMemo(
    () =>
      summarizeMonthFinance(
        monthTransactions,
        budgets,
        prevTransactions,
        month,
        todayIso,
        cycleStartDay,
      ),
    [budgets, cycleStartDay, month, monthTransactions, prevTransactions, todayIso],
  );

  const effectiveBudgets = useMemo(
    () => resolveEffectiveBudgets(budgets, month),
    [budgets, month],
  );

  return { cycleRange, transactionsQuery, budgetsQuery, automationQuery, monthTransactions, summary, effectiveBudgets };
}
