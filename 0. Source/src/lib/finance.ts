import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  getDaysInMonth,
  parseISO,
  startOfWeek,
  subDays,
  subMonths,
} from 'date-fns';
import { formatCurrency, type CurrencyTotal } from './subscriptions';
import type {
  FinanceBudget,
  FinanceTransaction,
  FinanceTransactionKind,
  FinanceTransactionSource,
  SubscriptionCurrency,
} from './types';

export const TOTAL_BUDGET_CATEGORY = '__total__';

export interface FinanceImportRow {
  date: string;
  time: string | null;
  kind: FinanceTransactionKind;
  amount: number;
  currency: SubscriptionCurrency;
  category: string;
  subCategory: string | null;
  merchant: string;
  paymentMethod: string | null;
  note: string | null;
  source: FinanceTransactionSource;
  externalHash: string;
  duplicate?: boolean;
}

export interface FinanceImportPreview {
  format: 'banksalad_xlsx' | 'csv';
  sheetName: string | null;
  totalRows: number;
  newRows: number;
  duplicateRows: number;
  expenseCount: number;
  incomeCount: number;
  transferCount: number;
  skippedRows: number;
  sampleRows: FinanceImportRow[];
}

export interface FinanceImportCommitResult {
  format: 'banksalad_xlsx' | 'csv';
  inserted: number;
  duplicates: number;
  skipped: number;
}

export interface FinanceCategoryBreakdown {
  category: string;
  amount: number;
  count: number;
  percent: number;
  budget: number | null;
  budgetPercent: number | null;
}

export interface FinanceDailyTotal {
  date: string;
  day: number;
  amount: number;
}

export interface FinanceCycleRange {
  yyyymm: string;
  cycleStartDay: number;
  startDate: string;
  endDate: string;
  prevYyyymm: string;
  prevStartDate: string;
  prevEndDate: string;
  daysCount: number;
  shortLabel: string;
}

export interface FinanceMonthlySummary {
  yyyymm: string;
  cycleStartDay: number;
  startDate: string;
  endDate: string;
  totalExpense: number;
  totalIncome: number;
  netSavings: number;
  transferInTotal: number;
  transferOutTotal: number;
  transferNetTotal: number;
  transferTotal: number;
  excludedCount: number;
  prevMonthExpense: number;
  expenseDiff: number;
  totalBudget: number | null;
  budgetPercent: number | null;
  remainingBudget: number | null;
  dailyAllowance: number | null;
  foreignExpenses: CurrencyTotal[];
  byCategory: FinanceCategoryBreakdown[];
  topCategories: FinanceCategoryBreakdown[];
  byDay: FinanceDailyTotal[];
}

const CURRENCY_ORDER: SubscriptionCurrency[] = ['KRW', 'USD', 'JPY', 'EUR'];

export function buildFinanceRowKey(
  row: Pick<
    FinanceImportRow,
    'date' | 'time' | 'kind' | 'amount' | 'currency' | 'category' | 'merchant' | 'paymentMethod'
  >,
  occurrenceIndex: number,
): string {
  return [
    row.date,
    row.time ?? '',
    row.kind,
    row.amount.toFixed(2),
    row.currency,
    row.category.trim(),
    row.merchant.trim(),
    (row.paymentMethod ?? '').trim(),
    `#${occurrenceIndex}`,
  ].join('|');
}

export function prevMonthKey(yyyymm: string): string {
  const base = parseISO(`${yyyymm}-01`);
  const prev = subMonths(base, 1);
  const y = prev.getFullYear();
  const m = String(prev.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function monthEndDate(yyyymm: string): string {
  return format(endOfMonth(parseISO(`${yyyymm}-01`)), 'yyyy-MM-dd');
}

export function nextMonthKey(yyyymm: string): string {
  const [yStr, mStr] = yyyymm.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

export function normalizeFinanceCycleStartDay(day?: number | null): number {
  if (typeof day !== 'number' || !Number.isFinite(day)) return 1;
  return Math.max(1, Math.min(31, Math.trunc(day)));
}

function clampDayInMonth(yyyymm: string, day: number): string {
  const daysInMonth = getDaysInMonth(parseISO(`${yyyymm}-01`));
  const clamped = Math.max(1, Math.min(daysInMonth, day));
  return `${yyyymm}-${String(clamped).padStart(2, '0')}`;
}

export function formatShortCycleRange(startDate: string, endDate: string): string {
  return `${Number(startDate.slice(5, 7))}.${startDate.slice(8, 10)} ~ ${Number(endDate.slice(5, 7))}.${endDate.slice(8, 10)}`;
}

export function getFinanceCycleRange(yyyymm: string, cycleStartDay = 1): FinanceCycleRange {
  const startDay = normalizeFinanceCycleStartDay(cycleStartDay);
  const prevYyyymm = prevMonthKey(yyyymm);
  let startDate: string;
  let endDate: string;
  let prevStartDate: string;
  let prevEndDate: string;

  if (startDay <= 1) {
    startDate = `${yyyymm}-01`;
    endDate = monthEndDate(yyyymm);
    prevStartDate = `${prevYyyymm}-01`;
    prevEndDate = monthEndDate(prevYyyymm);
  } else {
    startDate = clampDayInMonth(prevYyyymm, startDay);
    const nextStartDate = clampDayInMonth(yyyymm, startDay);
    endDate = format(subDays(parseISO(nextStartDate), 1), 'yyyy-MM-dd');
    const prevPrevYyyymm = prevMonthKey(prevYyyymm);
    prevStartDate = clampDayInMonth(prevPrevYyyymm, startDay);
    prevEndDate = format(subDays(parseISO(startDate), 1), 'yyyy-MM-dd');
  }

  const daysCount = differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
  const shortLabel = formatShortCycleRange(startDate, endDate);

  return {
    yyyymm,
    cycleStartDay: startDay,
    startDate,
    endDate,
    prevYyyymm,
    prevStartDate,
    prevEndDate,
    daysCount,
    shortLabel,
  };
}

export function getFinanceCycleKeyForDate(dateIso: string, cycleStartDay = 1): string {
  const startDay = normalizeFinanceCycleStartDay(cycleStartDay);
  const calMonth = dateIso.slice(0, 7);
  if (startDay <= 1) return calMonth;
  const thisMonthStart = clampDayInMonth(calMonth, startDay);
  return dateIso >= thisMonthStart ? nextMonthKey(calMonth) : calMonth;
}

export function formatFinanceAmount(amount: number, currency: SubscriptionCurrency = 'KRW'): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (currency === 'KRW') return `${sign}₩${Math.round(abs).toLocaleString('ko-KR')}`;
  return `${sign}${formatCurrency(abs, currency)}`;
}

/** Display signed transaction cashflow: + for refunds/inflows/transfer-in, - for spending/transfer-out. */
export function formatFinanceTransactionAmount(tx: {
  kind: FinanceTransactionKind;
  amount: number;
  currency: SubscriptionCurrency;
}): string {
  const absFormatted = formatFinanceAmount(Math.abs(tx.amount), tx.currency);
  if (tx.kind === 'expense') {
    return tx.amount < 0 ? `+${absFormatted}` : `-${absFormatted}`;
  }
  if (tx.kind === 'income') {
    return tx.amount < 0 ? `-${absFormatted}` : `+${absFormatted}`;
  }
  return tx.amount >= 0 ? `+${absFormatted}` : `-${absFormatted}`;
}

export function getFinanceTransactionKindLabel(tx: {
  kind: FinanceTransactionKind;
  amount: number;
}): string {
  if (tx.kind === 'transfer') {
    return tx.amount < 0 ? '이체 출금' : '이체 입금';
  }
  return tx.kind === 'income' ? '수입' : '지출';
}

export function resolveEffectiveBudgets(
  budgets: FinanceBudget[],
  yyyymm: string,
): {
  totalBudget: number | null;
  byCategory: Record<string, number>;
  monthOverrides: Record<string, FinanceBudget>;
  defaultBudgets: Record<string, FinanceBudget>;
} {
  let totalBudget: number | null = null;
  const byCategory: Record<string, number> = {};
  const defaultBudgets: Record<string, FinanceBudget> = {};
  const monthOverrides: Record<string, FinanceBudget> = {};

  for (const b of budgets) {
    if (b.yyyymm !== 'default') continue;
    defaultBudgets[b.category] = b;
    if (b.category === TOTAL_BUDGET_CATEGORY) {
      totalBudget = b.amount;
    } else {
      byCategory[b.category] = b.amount;
    }
  }

  for (const b of budgets) {
    if (b.yyyymm !== yyyymm) continue;
    monthOverrides[b.category] = b;
    if (b.category === TOTAL_BUDGET_CATEGORY) {
      totalBudget = b.amount;
    } else {
      byCategory[b.category] = b.amount;
    }
  }

  return { totalBudget, byCategory, monthOverrides, defaultBudgets };
}

export function summarizeMonthFinance(
  transactions: FinanceTransaction[],
  budgets: FinanceBudget[],
  prevMonthTransactions: FinanceTransaction[],
  yyyymm: string,
  todayIso: string,
  cycleStartDay = 1,
): FinanceMonthlySummary {
  const range = getFinanceCycleRange(yyyymm, cycleStartDay);
  const rangeStartObj = parseISO(range.startDate);

  let totalExpense = 0;
  let totalIncome = 0;
  let transferInTotal = 0;
  let transferOutTotal = 0;
  let excludedCount = 0;

  const foreignMap = new Map<SubscriptionCurrency, number>();
  const categoryStats = new Map<string, { amount: number; count: number }>();
  const dayTotals = new Map<string, number>();

  for (const tx of transactions) {
    if (tx.excluded) {
      excludedCount++;
      continue;
    }
    if (tx.kind === 'transfer') {
      if (tx.currency === 'KRW') {
        if (tx.amount >= 0) transferInTotal += tx.amount;
        else transferOutTotal += Math.abs(tx.amount);
      }
      continue;
    }
    if (tx.kind === 'income') {
      if (tx.currency === 'KRW') totalIncome += tx.amount;
      continue;
    }
    // tx.kind === 'expense' (negative amount = refund/cancellation, subtracts from totals)
    if (tx.currency !== 'KRW') {
      foreignMap.set(tx.currency, (foreignMap.get(tx.currency) ?? 0) + tx.amount);
      continue;
    }
    totalExpense += tx.amount;
    const prevCat = categoryStats.get(tx.category) ?? { amount: 0, count: 0 };
    categoryStats.set(tx.category, { amount: prevCat.amount + tx.amount, count: prevCat.count + 1 });
    dayTotals.set(tx.date, (dayTotals.get(tx.date) ?? 0) + tx.amount);
  }

  let prevMonthExpense = 0;
  for (const tx of prevMonthTransactions) {
    if (tx.excluded || tx.kind !== 'expense' || tx.currency !== 'KRW') continue;
    prevMonthExpense += tx.amount;
  }

  const resolved = resolveEffectiveBudgets(budgets, yyyymm);
  const totalBudget = resolved.totalBudget;
  const remainingBudget = totalBudget !== null ? totalBudget - totalExpense : null;
  const budgetPercent =
    totalBudget !== null && totalBudget > 0 ? Math.max(0, Math.round((totalExpense / totalBudget) * 100)) : null;

  let dailyAllowance: number | null = null;
  if (remainingBudget !== null && todayIso >= range.startDate && todayIso <= range.endDate) {
    const daysRemaining = Math.max(1, differenceInCalendarDays(parseISO(range.endDate), parseISO(todayIso)) + 1);
    dailyAllowance = Math.round(remainingBudget / daysRemaining);
  }

  const allCategories = new Set<string>([
    ...categoryStats.keys(),
    ...Object.keys(resolved.byCategory),
  ]);

  const byCategory: FinanceCategoryBreakdown[] = [...allCategories]
    .map(category => {
      const stat = categoryStats.get(category) ?? { amount: 0, count: 0 };
      const catBudget = resolved.byCategory[category] ?? null;
      return {
        category,
        amount: stat.amount,
        count: stat.count,
        percent: totalExpense > 0 && stat.amount > 0 ? Math.round((stat.amount / totalExpense) * 100) : 0,
        budget: catBudget,
        budgetPercent: catBudget !== null && catBudget > 0 ? Math.max(0, Math.round((stat.amount / catBudget) * 100)) : null,
      };
    })
    .sort((a, b) => b.amount - a.amount || (b.budget ?? 0) - (a.budget ?? 0) || a.category.localeCompare(b.category));

  const byDay: FinanceDailyTotal[] = Array.from({ length: range.daysCount }, (_, idx) => {
    const date = format(addDays(rangeStartObj, idx), 'yyyy-MM-dd');
    return {
      date,
      day: Number(date.slice(8, 10)),
      amount: dayTotals.get(date) ?? 0,
    };
  });

  const foreignExpenses: CurrencyTotal[] = CURRENCY_ORDER
    .filter(c => c !== 'KRW' && foreignMap.has(c))
    .map(currency => ({ currency, amount: Math.round((foreignMap.get(currency) ?? 0) * 100) / 100 }));

  const transferTotal = transferInTotal + transferOutTotal;
  const transferNetTotal = transferInTotal - transferOutTotal;

  return {
    yyyymm,
    cycleStartDay: range.cycleStartDay,
    startDate: range.startDate,
    endDate: range.endDate,
    totalExpense,
    totalIncome,
    netSavings: totalIncome - totalExpense,
    transferInTotal,
    transferOutTotal,
    transferNetTotal,
    transferTotal,
    excludedCount,
    prevMonthExpense,
    expenseDiff: totalExpense - prevMonthExpense,
    totalBudget,
    budgetPercent,
    remainingBudget,
    dailyAllowance,
    foreignExpenses,
    byCategory,
    topCategories: byCategory.filter(c => c.amount > 0).slice(0, 3),
    byDay,
  };
}

export interface FinanceCalendarDayCell {
  date: string;
  inRange: boolean;
  month: number;
  day: number;
  isMonthStart: boolean;
  expenseTotal: number;
  incomeTotal: number;
  transferCount: number;
  txCount: number;
  excludedCount: number;
}

export function formatCompactKrw(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 100_000_000) {
    return `${(abs / 100_000_000).toFixed(1).replace(/\.0$/, '')}억`;
  }
  if (abs >= 10_000) {
    return `${(abs / 10_000).toFixed(abs >= 100_000 ? 0 : 1).replace(/\.0$/, '')}만`;
  }
  if (abs >= 1_000) {
    return `${(abs / 1_000).toFixed(1).replace(/\.0$/, '')}천`;
  }
  return String(Math.round(abs));
}

export function buildFinanceCalendarWeeks(
  startDate: string,
  endDate: string,
  transactions: FinanceTransaction[],
  firstDayOfWeek: 'mon' | 'sun' = 'mon',
): FinanceCalendarDayCell[][] {
  const weekStartsOn = firstDayOfWeek === 'sun' ? 0 : 1;
  const gridStart = startOfWeek(parseISO(startDate), { weekStartsOn });
  const gridEnd = endOfWeek(parseISO(endDate), { weekStartsOn });

  const statsByDate = new Map<
    string,
    {
      expenseTotal: number;
      incomeTotal: number;
      transferCount: number;
      txCount: number;
      excludedCount: number;
    }
  >();

  for (const tx of transactions) {
    if (tx.date < startDate || tx.date > endDate) continue;
    const stat = statsByDate.get(tx.date) ?? {
      expenseTotal: 0,
      incomeTotal: 0,
      transferCount: 0,
      txCount: 0,
      excludedCount: 0,
    };
    stat.txCount += 1;
    if (tx.excluded) {
      stat.excludedCount += 1;
    } else if (tx.kind === 'transfer') {
      stat.transferCount += 1;
    } else if (tx.kind === 'income' && tx.currency === 'KRW') {
      stat.incomeTotal += tx.amount;
    } else if (tx.kind === 'expense' && tx.currency === 'KRW') {
      stat.expenseTotal += tx.amount;
    }
    statsByDate.set(tx.date, stat);
  }

  const weeks: FinanceCalendarDayCell[][] = [];
  let currentWeek: FinanceCalendarDayCell[] = [];

  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
    const date = format(d, 'yyyy-MM-dd');
    const month = Number(date.slice(5, 7));
    const day = Number(date.slice(8, 10));
    const stat = statsByDate.get(date);
    currentWeek.push({
      date,
      inRange: date >= startDate && date <= endDate,
      month,
      day,
      isMonthStart: day === 1,
      expenseTotal: stat?.expenseTotal ?? 0,
      incomeTotal: stat?.incomeTotal ?? 0,
      transferCount: stat?.transferCount ?? 0,
      txCount: stat?.txCount ?? 0,
      excludedCount: stat?.excludedCount ?? 0,
    });
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  return weeks;
}
