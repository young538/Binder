'use client';

import { useMemo, useState } from 'react';
import { parseISO } from 'date-fns';
import { Plus } from 'lucide-react';
import {
  buildFinanceCalendarWeeks,
  formatCompactKrw,
  formatFinanceAmount,
  type FinanceCycleRange,
} from '@/lib/finance';
import type { FinanceTransaction } from '@/lib/types';
import { FinanceTransactionRow } from './FinanceTransactionRow';

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

interface Props {
  cycleRange: FinanceCycleRange;
  transactions: FinanceTransaction[];
  todayIso: string;
  firstDayOfWeek: 'mon' | 'sun';
  onAddForDate: (date: string) => void;
  onEdit: (tx: FinanceTransaction) => void;
  onToggleExcluded: (tx: FinanceTransaction) => void;
  onDelete: (tx: FinanceTransaction) => void;
}

export function FinanceCalendarView({
  cycleRange,
  transactions,
  todayIso,
  firstDayOfWeek,
  onAddForDate,
  onEdit,
  onToggleExcluded,
  onDelete,
}: Props) {
  const [pickedDate, setPickedDate] = useState<string | null>(null);

  const weeks = useMemo(
    () =>
      buildFinanceCalendarWeeks(
        cycleRange.startDate,
        cycleRange.endDate,
        transactions,
        firstDayOfWeek,
      ),
    [cycleRange.endDate, cycleRange.startDate, firstDayOfWeek, transactions],
  );

  const transactionsByDate = useMemo(() => {
    const map = new Map<string, FinanceTransaction[]>();
    for (const tx of transactions) {
      const list = map.get(tx.date) ?? [];
      list.push(tx);
      map.set(tx.date, list);
    }
    return map;
  }, [transactions]);

  const latestTxDate = useMemo(() => {
    let maxDate: string | null = null;
    for (const tx of transactions) {
      if (tx.date >= cycleRange.startDate && tx.date <= cycleRange.endDate) {
        if (!maxDate || tx.date > maxDate) maxDate = tx.date;
      }
    }
    return maxDate;
  }, [cycleRange.endDate, cycleRange.startDate, transactions]);

  const isTodayInRange =
    todayIso >= cycleRange.startDate && todayIso <= cycleRange.endDate;

  const selectedDate =
    pickedDate &&
    pickedDate >= cycleRange.startDate &&
    pickedDate <= cycleRange.endDate
      ? pickedDate
      : isTodayInRange
        ? todayIso
        : latestTxDate ?? cycleRange.startDate;

  const selectedDayTransactions = useMemo(
    () => transactionsByDate.get(selectedDate) ?? [],
    [selectedDate, transactionsByDate],
  );

  const selectedDaySummary = useMemo(() => {
    let expense = 0;
    let income = 0;
    for (const tx of selectedDayTransactions) {
      if (tx.excluded || tx.currency !== 'KRW') continue;
      if (tx.kind === 'expense') expense += tx.amount;
      else if (tx.kind === 'income') income += tx.amount;
    }
    return { expense, income };
  }, [selectedDayTransactions]);

  const weekdayHeaders =
    firstDayOfWeek === 'sun'
      ? ['일', '월', '화', '수', '목', '금', '토']
      : ['월', '화', '수', '목', '금', '토', '일'];

  const selectedWeekday = WEEKDAY_KO[parseISO(selectedDate).getDay()];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm sm:p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">
              {cycleRange.startDate} ~ {cycleRange.endDate}
            </span>
            <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {cycleRange.daysCount}일
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden="true" />
              지출
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
              수입·환불
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-zinc-400" aria-hidden="true" />
              이체·제외
            </span>
            {isTodayInRange && selectedDate !== todayIso && (
              <button
                type="button"
                onClick={() => setPickedDate(todayIso)}
                className="rounded-lg border border-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                오늘
              </button>
            )}
          </div>
        </div>

        <div aria-label="가계부 캘린더" className="space-y-1">
          <div className="grid grid-cols-7 gap-1">
            {weekdayHeaders.map(dayLabel => (
              <div
                key={dayLabel}
                className={`py-1.5 text-center text-[11px] font-semibold ${
                  dayLabel === '일'
                    ? 'text-rose-500 dark:text-rose-400'
                    : dayLabel === '토'
                      ? 'text-sky-600 dark:text-sky-400'
                      : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {dayLabel}
              </div>
            ))}
          </div>

          <div className="space-y-1">
            {weeks.map(week => (
              <div key={week[0].date} className="grid grid-cols-7 gap-1">
                {week.map(cell => {
                  const dateLabel =
                    cycleRange.cycleStartDay > 1 &&
                    (cell.date === cycleRange.startDate || cell.isMonthStart)
                      ? `${cell.month}/${cell.day}`
                      : String(cell.day);

                  if (!cell.inRange) {
                    return (
                      <div
                        key={cell.date}
                        aria-hidden="true"
                        className="min-h-[68px] min-w-0 rounded-xl border border-zinc-100 bg-zinc-50/50 p-1 text-[11px] text-zinc-300 sm:min-h-[86px] sm:p-1.5 dark:border-zinc-800/60 dark:bg-zinc-950/40 dark:text-zinc-700"
                      >
                        <span className="tabular-nums">
                          {cell.isMonthStart ? `${cell.month}/${cell.day}` : cell.day}
                        </span>
                      </div>
                    );
                  }

                  const dayOfWeek = parseISO(cell.date).getDay();
                  const isSunday = dayOfWeek === 0;
                  const isSaturday = dayOfWeek === 6;
                  const isToday = cell.date === todayIso;
                  const isSelected = cell.date === selectedDate;
                  const weekday = WEEKDAY_KO[dayOfWeek];

                  const summaryParts: string[] = [];
                  if (cell.expenseTotal > 0) {
                    summaryParts.push(`지출 ${formatFinanceAmount(cell.expenseTotal)}`);
                  } else if (cell.expenseTotal < 0) {
                    summaryParts.push(`순환불 ${formatFinanceAmount(Math.abs(cell.expenseTotal))}`);
                  }
                  if (cell.incomeTotal !== 0) {
                    summaryParts.push(`수입 ${formatFinanceAmount(cell.incomeTotal)}`);
                  }
                  if (cell.expenseTotal === 0 && cell.incomeTotal === 0 && cell.txCount > 0) {
                    summaryParts.push(`거래 ${cell.txCount}건`);
                  }
                  const ariaLabel =
                    summaryParts.length > 0
                      ? `${cell.date} (${weekday}), ${summaryParts.join(', ')}`
                      : `${cell.date} (${weekday})`;

                  return (
                    <button
                      key={cell.date}
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={ariaLabel}
                      onClick={() => setPickedDate(cell.date)}
                      className={`flex min-h-[68px] min-w-0 flex-col justify-between overflow-hidden rounded-xl border p-1 text-left transition sm:min-h-[86px] sm:p-1.5 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500 dark:border-blue-400 dark:bg-blue-950/30 dark:ring-blue-400'
                          : isToday
                            ? 'border-blue-300 bg-white hover:bg-zinc-50 dark:border-blue-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/70'
                            : 'border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/70'
                      }`}
                    >
                      <div className="flex w-full min-w-0 items-center justify-between gap-0.5">
                        <span
                          className={`inline-flex items-center rounded px-1 py-0.5 text-[11px] font-semibold tabular-nums leading-none ${
                            isToday
                              ? 'bg-blue-600 text-white'
                              : isSunday
                                ? 'text-rose-600 dark:text-rose-400'
                                : isSaturday
                                  ? 'text-sky-600 dark:text-sky-400'
                                  : 'text-zinc-700 dark:text-zinc-200'
                          }`}
                        >
                          {dateLabel}
                        </span>
                        {cell.txCount > 0 && (
                          <span className="hidden text-[10px] tabular-nums text-zinc-400 sm:inline">
                            {cell.txCount}
                          </span>
                        )}
                      </div>

                      <div className="w-full min-w-0 space-y-0.5 tabular-nums leading-tight">
                        {cell.expenseTotal !== 0 && (
                          <div
                            className={`w-full min-w-0 truncate text-[10px] font-semibold sm:text-[11px] ${
                              cell.expenseTotal > 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            <span className="hidden sm:inline">
                              {cell.expenseTotal > 0
                                ? `-${formatFinanceAmount(cell.expenseTotal)}`
                                : `+${formatFinanceAmount(Math.abs(cell.expenseTotal))}`}
                            </span>
                            <span className="sm:hidden">
                              {cell.expenseTotal > 0
                                ? `-${formatCompactKrw(cell.expenseTotal)}`
                                : `+${formatCompactKrw(cell.expenseTotal)}`}
                            </span>
                          </div>
                        )}
                        {cell.incomeTotal !== 0 && (
                          <div
                            className={`w-full min-w-0 truncate text-[10px] font-semibold sm:text-[11px] ${
                              cell.incomeTotal > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            <span className="hidden sm:inline">
                              {cell.incomeTotal > 0
                                ? `+${formatFinanceAmount(cell.incomeTotal)}`
                                : `-${formatFinanceAmount(Math.abs(cell.incomeTotal))}`}
                            </span>
                            <span className="sm:hidden">
                              {cell.incomeTotal > 0
                                ? `+${formatCompactKrw(cell.incomeTotal)}`
                                : `-${formatCompactKrw(cell.incomeTotal)}`}
                            </span>
                          </div>
                        )}
                        {cell.expenseTotal === 0 &&
                          cell.incomeTotal === 0 &&
                          cell.txCount > 0 && (
                            <div className="w-full min-w-0 truncate text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
                              <span className="hidden sm:inline">
                                {cell.transferCount > 0
                                  ? `이체 ${cell.transferCount}`
                                  : `제외 ${cell.excludedCount}`}
                              </span>
                              <span className="sm:hidden">•{cell.txCount}</span>
                            </div>
                          )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <section
        aria-label="선택한 날짜 거래 내역"
        className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50/70 px-4 py-3 text-xs dark:border-zinc-800 dark:bg-zinc-950/60">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {selectedDate} ({selectedWeekday})
            </h2>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {selectedDayTransactions.length}건
            </span>
            {selectedDaySummary.expense !== 0 && (
              <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                지출 {formatFinanceAmount(selectedDaySummary.expense)}
              </span>
            )}
            {selectedDaySummary.income !== 0 && (
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                수입 {formatFinanceAmount(selectedDaySummary.income)}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onAddForDate(selectedDate)}
            className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={13} />
            이 날짜에 거래 추가
          </button>
        </div>

        {selectedDayTransactions.length === 0 ? (
          <div className="p-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
            이 날짜에 기록된 거래 내역이 없습니다.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {selectedDayTransactions.map(tx => (
              <FinanceTransactionRow
                key={tx.id}
                tx={tx}
                onToggleExcluded={onToggleExcluded}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
