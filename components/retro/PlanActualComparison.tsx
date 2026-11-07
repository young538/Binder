import type { Category, TimeBlock } from '@/lib/types';
import { comparePlanActual } from '@/lib/planning/insights';

export function PlanActualComparison({ blocks, categories }: { blocks: TimeBlock[]; categories: Category[] }) {
  const rows = comparePlanActual(blocks);
  const totals = rows.reduce((sum, row) => ({ plan: sum.plan + row.plan, actual: sum.actual + row.actual }), { plan: 0, actual: 0 });
  const hours = (minutes: number) => `${(minutes / 60).toFixed(1)}h`;
  const maximum = Math.max(1, ...rows.flatMap(row => [row.plan, row.actual]));
  return <section aria-label="계획 대비 실제 시간" className="rounded-xl border border-blue-200 bg-white p-4 dark:border-blue-900 dark:bg-zinc-900">
    <h3 className="font-semibold">계획 대비 실제 시간</h3>
    <p className="my-2 text-sm text-zinc-600 dark:text-zinc-300">계획 {hours(totals.plan)} · 실제 {hours(totals.actual)} · 차이 {totals.actual - totals.plan > 0 ? '+' : ''}{hours(totals.actual - totals.plan)}</p>
    {!rows.length && <p className="text-sm text-zinc-500">계획이나 실제 시간을 기록하면 비교할 수 있어요.</p>}
    <div className="space-y-4">{rows.map(row => {
      const category = categories.find(item => item.id === row.categoryId);
      return <div key={row.categoryId}>
        <div className="mb-1 flex flex-wrap justify-between gap-2 text-xs"><span>{category?.name ?? '삭제된 카테고리'}</span><span>계획 {hours(row.plan)} / 실제 {hours(row.actual)} / 차이 {row.difference > 0 ? '+' : ''}{hours(row.difference)}</span></div>
        <div aria-hidden="true" className="space-y-1">
          <div className="h-2 rounded bg-zinc-100 dark:bg-zinc-800"><div className="h-full rounded bg-blue-200 dark:bg-blue-900" style={{ width: `${row.plan / maximum * 100}%` }} /></div>
          <div className="h-2 rounded bg-zinc-100 dark:bg-zinc-800"><div className="h-full rounded bg-blue-600" style={{ width: `${row.actual / maximum * 100}%` }} /></div>
        </div>
      </div>;
    })}</div>
    <p className="mt-3 text-xs leading-5 text-zinc-500">위 막대는 계획, 아래는 실제 시간입니다. 겹친 기록도 합산하며 시간 차이는 할 일의 완료 여부를 뜻하지 않습니다.</p>
  </section>;
}
