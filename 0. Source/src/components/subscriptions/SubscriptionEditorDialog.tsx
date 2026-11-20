'use client';
import { useState } from 'react';
import { createSubscription, updateSubscription } from '@/lib/repo/subscriptions';
import {
  BILLING_CYCLE_LABEL,
  SUBSCRIPTION_CATEGORY_PRESETS,
  SUBSCRIPTION_STATUS_LABEL,
  type BillingCycle,
  type Subscription,
  type SubscriptionCurrency,
  type SubscriptionStatus,
} from '@/lib/types';
import { Dialog, actionClass, fieldClass } from '@/components/common/Dialog';

interface Props {
  existing?: Subscription;
  nextOrder: number;
  onClose: () => void;
}

const CURRENCIES: { value: SubscriptionCurrency; label: string }[] = [
  { value: 'KRW', label: 'KRW (₩ 원)' },
  { value: 'USD', label: 'USD ($ 달러)' },
  { value: 'JPY', label: 'JPY (¥ 엔)' },
  { value: 'EUR', label: 'EUR (€ 유로)' },
];

const CYCLES: BillingCycle[] = ['monthly', 'yearly', 'quarterly', 'weekly'];
const STATUSES: SubscriptionStatus[] = ['active', 'paused', 'cancelled'];

export function SubscriptionEditorDialog({ existing, nextOrder, onClose }: Props) {
  const [name, setName] = useState(existing?.name ?? '');
  const [amountStr, setAmountStr] = useState(existing != null ? String(existing.amount) : '');
  const [currency, setCurrency] = useState<SubscriptionCurrency>(existing?.currency ?? 'KRW');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(existing?.billingCycle ?? 'monthly');
  const [status, setStatus] = useState<SubscriptionStatus>(existing?.status ?? 'active');
  const [nextBillingDate, setNextBillingDate] = useState(existing?.nextBillingDate ?? '');
  const [billingDayStr, setBillingDayStr] = useState(
    existing?.billingDay != null ? String(existing.billingDay) : '',
  );
  const [category, setCategory] = useState(existing?.category ?? '');
  const [paymentMethod, setPaymentMethod] = useState(existing?.paymentMethod ?? '');
  const [url, setUrl] = useState(existing?.url ?? '');
  const [autoRenew, setAutoRenew] = useState(existing?.autoRenew ?? true);
  const [note, setNote] = useState(existing?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) {
      setError('서비스명을 입력해 주세요.');
      return;
    }

    const parsedAmount = Number(amountStr.trim());
    if (!amountStr.trim() || !Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setError('금액은 0 이상의 숫자로 입력해 주세요.');
      return;
    }

    let billingDay: number | null = null;
    if (billingDayStr.trim()) {
      const day = Number(billingDayStr.trim());
      if (!Number.isSafeInteger(day) || day < 1 || day > 31) {
        setError('정기 결제일은 1~31 사이 정수여야 합니다.');
        return;
      }
      billingDay = day;
    }

    const trimmedUrl = url.trim();
    if (trimmedUrl) {
      try {
        const parsed = new URL(trimmedUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          setError('관리 URL은 http:// 또는 https:// 형식이어야 합니다.');
          return;
        }
      } catch {
        setError('올바른 관리 URL 형식이 아닙니다.');
        return;
      }
    }

    setBusy(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        amount: parsedAmount,
        currency,
        billingCycle,
        billingDay,
        nextBillingDate: nextBillingDate || null,
        status,
        category: category.trim() || null,
        paymentMethod: paymentMethod.trim() || null,
        autoRenew,
        url: trimmedUrl || null,
        note: note.trim() || null,
      };
      if (existing) {
        await updateSubscription(existing.id, payload);
      } else {
        await createSubscription({ ...payload, order: nextOrder });
      }
      onClose();
    } catch {
      setError('구독 정보를 저장하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={existing ? '구독 정보 편집' : '새 구독 · 월정액 추가'} onClose={() => { if (!busy) onClose(); }}>
      <form onSubmit={e => void submit(e)} className="space-y-3.5">
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          서비스명
          <input
            type="text"
            aria-label="서비스명"
            required
            autoFocus
            disabled={busy}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="예: ChatGPT Plus, YouTube Premium, iCloud+"
            className={`mt-1 ${fieldClass}`}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            금액
            <input
              type="number"
              aria-label="결제 금액"
              required
              min="0"
              step="any"
              disabled={busy}
              value={amountStr}
              onChange={e => setAmountStr(e.target.value)}
              placeholder="14900"
              className={`mt-1 ${fieldClass}`}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            통화
            <select
              aria-label="결제 통화"
              disabled={busy}
              value={currency}
              onChange={e => setCurrency(e.target.value as SubscriptionCurrency)}
              className={`mt-1 ${fieldClass}`}
            >
              {CURRENCIES.map(item => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            결제 주기
            <select
              aria-label="결제 주기"
              disabled={busy}
              value={billingCycle}
              onChange={e => setBillingCycle(e.target.value as BillingCycle)}
              className={`mt-1 ${fieldClass}`}
            >
              {CYCLES.map(c => (
                <option key={c} value={c}>
                  {BILLING_CYCLE_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            상태
            <select
              aria-label="구독 상태"
              disabled={busy}
              value={status}
              onChange={e => setStatus(e.target.value as SubscriptionStatus)}
              className={`mt-1 ${fieldClass}`}
            >
              {STATUSES.map(s => (
                <option key={s} value={s}>
                  {SUBSCRIPTION_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            다음 결제일
            <input
              type="date"
              aria-label="다음 결제일"
              disabled={busy}
              value={nextBillingDate}
              onChange={e => setNextBillingDate(e.target.value)}
              className={`mt-1 ${fieldClass}`}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            결제일 (매월 일자)
            <input
              type="number"
              aria-label="결제일 (매월 일자)"
              min="1"
              max="31"
              disabled={busy}
              value={billingDayStr}
              onChange={e => setBillingDayStr(e.target.value)}
              placeholder="1~31 (선택)"
              className={`mt-1 ${fieldClass}`}
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            분류
            <input
              type="text"
              aria-label="구독 분류"
              list="subscription-category-presets"
              disabled={busy}
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="예: AI·생산성, OTT·콘텐츠"
              className={`mt-1 ${fieldClass}`}
            />
            <datalist id="subscription-category-presets">
              {SUBSCRIPTION_CATEGORY_PRESETS.map(preset => (
                <option key={preset} value={preset} />
              ))}
            </datalist>
          </label>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            결제 수단
            <input
              type="text"
              aria-label="결제 수단"
              disabled={busy}
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              placeholder="예: 현대카드 M, 카카오페이"
              className={`mt-1 ${fieldClass}`}
            />
          </label>
        </div>

        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          관리·해지 URL <span className="font-normal text-zinc-400">(선택)</span>
          <input
            type="url"
            aria-label="관리 URL"
            disabled={busy}
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://..."
            className={`mt-1 ${fieldClass}`}
          />
        </label>

        <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={autoRenew}
            disabled={busy}
            onChange={e => setAutoRenew(e.target.checked)}
          />
          자동 갱신
        </label>

        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          메모
          <textarea
            rows={2}
            aria-label="구독 메모"
            disabled={busy}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="공유 인원, 해지 조건, 프로모션 종료일 등"
            className={`mt-1 ${fieldClass}`}
          />
        </label>

        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            취소
          </button>
          <button type="submit" disabled={busy} className={actionClass}>
            {busy ? '저장 중…' : existing ? '변경 저장' : '구독 등록'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
