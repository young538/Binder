'use client';
import { TimeBlock, Goal, Category } from '@/lib/types';
import { aggregateByGoal, aggregateByCategory } from '@/lib/aggregate';

interface Props {
  blocks: TimeBlock[];
  goals: Goal[];
  categories: Category[];
  embedded?: boolean;
}

const formatHours = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

const Bar = ({
  rows,
  title,
}: {
  rows: { label: string; color: string; mins: number }[];
  title: string;
}) => {
  const max = Math.max(1, ...rows.map((r) => r.mins));
  return (
    <div className="min-w-0">
      <h3 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-50">{title}</h3>
      {rows.length === 0 && <p className="text-xs text-zinc-400">기록 없음</p>}
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-3 text-xs">
            <div className="min-w-0 w-24 shrink-0 truncate text-zinc-700 dark:text-zinc-300">{r.label}</div>
            <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
              <div
                style={{ width: `${(r.mins / max) * 100}%`, background: r.color }}
                className="h-full rounded-full"
              />
            </div>
            <div className="w-16 shrink-0 text-right text-zinc-600 dark:text-zinc-400 tabular-nums">
              {formatHours(r.mins)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const GoalCoverageBar = ({ blocks, goals, categories, embedded = false }: Props) => {
  const actualBlocks = blocks.filter((b) => (b.kind ?? 'plan') === 'actual');
  const byGoal = aggregateByGoal(actualBlocks);
  const byCat = aggregateByCategory(actualBlocks);

  const goalRows = Array.from(byGoal.entries()).map(([gid, mins]) => ({
    label: gid ? (goals.find((g) => g.id === gid)?.title ?? '(삭제된 목표)') : '(목표 미지정)',
    color: gid ? (goals.find((g) => g.id === gid)?.color ?? '#71717a') : '#d4d4d8',
    mins,
  }));
  const catRows = Array.from(byCat.entries()).map(([cid, mins]) => ({
    label: categories.find((c) => c.id === cid)?.name ?? '(삭제됨)',
    color: categories.find((c) => c.id === cid)?.color ?? '#71717a',
    mins,
  }));

  return (
    <section data-testid="weekly-statistics" className={embedded
      ? 'bg-white px-4 py-4 dark:bg-zinc-950'
      : 'rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950'}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-50">주간 실제 기록 통계</h2>
        <div className="shrink-0 text-[11px] text-zinc-500 dark:text-zinc-500">통계는 ✅ 실제 기록 기준</div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 md:divide-x md:divide-zinc-200 dark:md:divide-zinc-800">
        <div className="min-w-0 md:pr-4"><Bar rows={goalRows} title="🎯 목표별" /></div>
        <div className="min-w-0 md:pl-4"><Bar rows={catRows} title="🎨 카테고리별" /></div>
      </div>
    </section>
  );
};
