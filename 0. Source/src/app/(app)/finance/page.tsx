import { Suspense } from 'react';
import { FinancePage } from '@/components/finance/FinancePage';

export default function FinanceRoutePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl p-6 text-sm text-zinc-500">가계부를 불러오는 중…</div>}>
      <FinancePage />
    </Suspense>
  );
}
