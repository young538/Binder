'use client';

import { EyeOff, Pencil, Trash2 } from 'lucide-react';
import {
  formatFinanceTransactionAmount,
  getFinanceTransactionKindLabel,
} from '@/lib/finance';
import type { FinanceTransaction, FinanceTransactionKind } from '@/lib/types';

const SOURCE_BADGE: Record<FinanceTransaction['source'], string | null> = {
  manual: null,
  banksalad: '뱅크샐러드',
  csv: 'CSV',
  subscription: '구독 자동',
  shortcut: '단축어',
};

const KIND_BADGE_CLASS: Record<FinanceTransactionKind, string> = {
  expense: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900',
  income: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900',
  transfer: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
};

interface Props {
  tx: FinanceTransaction;
  onToggleExcluded: (tx: FinanceTransaction) => void;
  onEdit: (tx: FinanceTransaction) => void;
  onDelete: (tx: FinanceTransaction) => void;
}

export function FinanceTransactionRow({
  tx,
  onToggleExcluded,
  onEdit,
  onDelete,
}: Props) {
  const srcBadge = SOURCE_BADGE[tx.source];
  const kindBadgeCls =
    tx.kind === 'transfer' && tx.amount >= 0
      ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900'
      : KIND_BADGE_CLASS[tx.kind];
  const amountColorCls =
    tx.kind === 'expense'
      ? tx.amount < 0
        ? 'text-emerald-700 dark:text-emerald-400'
        : 'text-zinc-900 dark:text-zinc-100'
      : tx.kind === 'income'
        ? tx.amount < 0
          ? 'text-rose-600 dark:text-rose-400'
          : 'text-emerald-700 dark:text-emerald-400'
        : tx.amount > 0
          ? 'text-blue-700 dark:text-blue-400'
          : 'text-zinc-500 dark:text-zinc-400';

  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs ${
        tx.excluded ? 'opacity-55' : ''
      }`}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${kindBadgeCls}`}>
            {getFinanceTransactionKindLabel(tx)}
          </span>
          {tx.kind === 'expense' && tx.amount < 0 && (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              취소/환불
            </span>
          )}
          {tx.kind === 'income' && tx.amount < 0 && (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
              취소
            </span>
          )}
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {tx.category}
            {tx.subCategory ? ` · ${tx.subCategory}` : ''}
          </span>
          <span className={`truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100 ${tx.excluded ? 'line-through' : ''}`}>
            {tx.merchant}
          </span>
          {srcBadge && (
            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
              {srcBadge}
            </span>
          )}
          {tx.excluded && (
            <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
              합계 제외됨
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          {tx.time && <span>{tx.time}</span>}
          {tx.paymentMethod && <span>{tx.paymentMethod}</span>}
          {tx.note && <span className="truncate">· {tx.note}</span>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <span className={`mr-1 text-sm font-bold tabular-nums ${amountColorCls}`}>
          {formatFinanceTransactionAmount(tx)}
        </span>
        <button
          type="button"
          title={tx.excluded ? '합계에 다시 포함' : '이번 달 합계에서 제외'}
          aria-label={`${tx.merchant} 합계 제외 전환`}
          aria-pressed={tx.excluded}
          onClick={() => onToggleExcluded(tx)}
          className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
            tx.excluded
              ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
              : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
          }`}
        >
          <EyeOff size={12} className="inline mr-0.5" />
          {tx.excluded ? '제외됨' : '제외'}
        </button>
        <button
          type="button"
          aria-label={`${tx.merchant} 수정`}
          onClick={() => onEdit(tx)}
          className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <Pencil size={13} />
        </button>
        <button
          type="button"
          aria-label={`${tx.merchant} 삭제`}
          onClick={() => onDelete(tx)}
          className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </li>
  );
}
