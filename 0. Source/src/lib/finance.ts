import { endOfMonth, format, getDaysInMonth, parseISO, subMonths } from 'date-fns';
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

export interface FinanceMonthlySummary {
  yyyymm: string;
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
): FinanceMonthlySummary {
  const monthStart = `${yyyymm}-01`;
  const monthEndDate = endOfMonth(parseISO(monthStart));
  const daysInMonth = getDaysInMonth(monthEndDate);

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
  if (remainingBudget !== null && todayIso.slice(0, 7) === yyyymm) {
    const todayDay = Math.max(1, Math.min(daysInMonth, Number(todayIso.slice(8, 10))));
    const daysRemaining = Math.max(1, daysInMonth - todayDay + 1);
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

  const byDay: FinanceDailyTotal[] = Array.from({ length: daysInMonth }, (_, idx) => {
    const day = idx + 1;
    const date = `${yyyymm}-${String(day).padStart(2, '0')}`;
    return {
      date,
      day,
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
