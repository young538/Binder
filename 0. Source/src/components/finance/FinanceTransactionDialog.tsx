'use client';

import { useState } from 'react';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  FINANCE_KIND_LABEL,
  type FinanceTransaction,
  type FinanceTransactionKind,
  type SubscriptionCurrency,
} from '@/lib/types';
import { createFinanceTransaction, updateFinanceTransaction } from '@/lib/repo/finance';
import { Dialog, actionClass, fieldClass } from '@/components/common/Dialog';

interface Props {
  initial?: FinanceTransaction | null;
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}

export function FinanceTransactionDialog({ initial, defaultDate, onClose, onSaved }: Props) {
  const [kind, setKind] = useState<FinanceTransactionKind>(initial?.kind ?? 'expense');
  const [date, setDate] = useState(initial?.date ?? defaultDate);
  const [time, setTime] = useState(initial?.time ?? '');
  const [amountStr, setAmountStr] = useState(initial ? String(initial.amount) : '');
  const [currency, setCurrency] = useState<SubscriptionCurrency>(initial?.currency ?? 'KRW');
  const [category, setCategory] = useState(initial?.category ?? DEFAULT_EXPENSE_CATEGORIES[0]);
  const [subCategory, setSubCategory] = useState(initial?.subCategory ?? '');
  const [merchant, setMerchant] = useState(initial?.merchant ?? '');
  const [paymentMethod, setPaymentMethod] = useState(initial?.paymentMethod ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [excluded, setExcluded] = useState(initial?.excluded ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const suggestedCategories: readonly string[] =
    kind === 'income'
      ? DEFAULT_INCOME_CATEGORIES
      : kind === 'transfer'
        ? ['이체', '카드대금', '저축/투자', '계좌이동']
        : DEFAULT_EXPENSE_CATEGORIES;

  const handleKindChange = (nextKind: FinanceTransactionKind) => {
    setKind(nextKind);
    if (!initial) {
      if (nextKind === 'income' && (DEFAULT_EXPENSE_CATEGORIES as readonly string[]).includes(category)) {
        setCategory(DEFAULT_INCOME_CATEGORIES[0]);
      } else if (nextKind === 'transfer') {
        setCategory('이체');
      } else if (nextKind === 'expense' && ((DEFAULT_INCOME_CATEGORIES as readonly string[]).includes(category) || category === '이체')) {
        setCategory(DEFAULT_EXPENSE_CATEGORIES[0]);
      }
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const amount = Number(amountStr.replace(/,/g, '').trim());
    if (!Number.isFinite(amount) || amount < 0) {
      setError('올바른 금액을 입력해 주세요.');
      return;
    }
    if (!merchant.trim()) {
      setError('거래 내용이나 가맹점을 입력해 주세요.');
      return;
    }
    if (!category.trim()) {
      setError('대분류를 입력해 주세요.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const payload = {
        date,
        time: time.trim() || null,
        kind,
        amount,
        currency,
        category: category.trim(),
        subCategory: subCategory.trim() || null,
        merchant: merchant.trim(),
        paymentMethod: paymentMethod.trim() || null,
        note: note.trim() || null,
        excluded,
      };
      if (initial) {
        await updateFinanceTransaction(initial.id, payload);
      } else {
        await createFinanceTransaction({
          ...payload,
          source: 'manual',
          subscriptionId: null,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '거래 내역을 저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={initial ? '거래 내역 수정' : '새 거래 추가'} onClose={() => { if (!busy) onClose(); }}>
      <form onSubmit={e => void submit(e)} className="space-y-3">
        <div className="flex gap-1.5" role="group" aria-label="거래 구분">
          {(['expense', 'income', 'transfer'] as const).map(k => (
            <button
              key={k}
              type="button"
              disabled={busy}
              aria-pressed={kind === k}
              onClick={() => handleKindChange(k)}
              className={`flex-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                kind === k
                  ? k === 'expense'
                    ? 'bg-rose-600 text-white'
                    : k === 'income'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              {FINANCE_KIND_LABEL[k]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            거래 날짜
            <input
              type="date"
              required
              aria-label="거래 날짜"
              value={date}
              disabled={busy}
              onChange={e => setDate(e.target.value)}
              className={`mt-1 ${fieldClass}`}
            />
          </label>
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            시간 (선택)
            <input
              type="time"
              aria-label="거래 시간"
              value={time}
              disabled={busy}
              onChange={e => setTime(e.target.value)}
              className={`mt-1 ${fieldClass}`}
            />
          </label>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            금액
            <input
              type="number"
              min="0"
              step="any"
              required
              autoFocus
              aria-label="거래 금액"
              placeholder="15000"
              value={amountStr}
              disabled={busy}
              onChange={e => setAmountStr(e.target.value)}
              className={`mt-1 ${fieldClass}`}
            />
          </label>
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            통화
            <select
              aria-label="거래 통화"
              value={currency}
              disabled={busy}
              onChange={e => setCurrency(e.target.value as SubscriptionCurrency)}
              className={`mt-1 ${fieldClass}`}
            >
              <option value="KRW">KRW (₩)</option>
              <option value="USD">USD ($)</option>
              <option value="JPY">JPY (¥)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </label>
        </div>

        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          내용 / 가맹점
          <input
            type="text"
            required
            aria-label="거래 내용"
            placeholder="예: 스타벅스, 점심 식사, 급여"
            value={merchant}
            disabled={busy}
            onChange={e => setMerchant(e.target.value)}
            className={`mt-1 ${fieldClass}`}
          />
        </label>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            대분류
            <input
              type="text"
              required
              list="finance-category-suggestions"
              aria-label="대분류"
              value={category}
              disabled={busy}
              onChange={e => setCategory(e.target.value)}
              className={`mt-1 ${fieldClass}`}
            />
            <datalist id="finance-category-suggestions">
              {suggestedCategories.map(c => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            소분류 (선택)
            <input
              type="text"
              aria-label="소분류"
              placeholder="예: 커피, 외식"
              value={subCategory}
              disabled={busy}
              onChange={e => setSubCategory(e.target.value)}
              className={`mt-1 ${fieldClass}`}
            />
          </label>
        </div>

        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          결제수단 (선택)
          <input
            type="text"
            aria-label="결제수단"
            placeholder="예: 현대카드, 토스뱅크 체크, 현금"
            value={paymentMethod}
            disabled={busy}
            onChange={e => setPaymentMethod(e.target.value)}
            className={`mt-1 ${fieldClass}`}
          />
        </label>

        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          메모 (선택)
          <input
            type="text"
            aria-label="거래 메모"
            value={note}
            disabled={busy}
            onChange={e => setNote(e.target.value)}
            className={`mt-1 ${fieldClass}`}
          />
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={excluded}
            disabled={busy}
            onChange={e => setExcluded(e.target.checked)}
            className="rounded border-zinc-300 text-blue-600"
          />
          <span>이번 달 지출·수입 합계 및 예산 계산에서 제외 (정산분/취소 등)</span>
        </label>

        {error && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-xl border border-zinc-200 px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            취소
          </button>
          <button type="submit" disabled={busy} className={actionClass}>
            {busy ? '저장 중…' : initial ? '수정 저장' : '거래 저장'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
