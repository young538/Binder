'use client';
import { TimeBlock, Goal, Category } from '@/lib/types';
import { aggregateByGoal, aggregateByCategory } from '@/lib/aggregate';

interface Props {
  blocks: TimeBlock[];
  goals: Goal[];
  categories: Category[];
}

const formatHours = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

export const GoalCoverageBar = ({ blocks, goals, categories }: Props) => {
  const byGoal = aggregateByGoal(blocks);
  const byCat = aggregateByCategory(blocks);

  const goalRows = Array.from(byGoal.entries()).map(([gid, mins]) => ({
    label: gid ? (goals.find(g => g.id === gid)?.title ?? '(삭제된 목표)') : '(목표 미지정)',
    color: gid ? (goals.find(g => g.id === gid)?.color ?? '#888') : '#ccc',
    mins,
  }));
  const catRows = Array.from(byCat.entries()).map(([cid, mins]) => ({
    label: categories.find(c => c.id === cid)?.name ?? '(삭제됨)',
    color: categories.find(c => c.id === cid)?.color ?? '#888',
    mins,
  }));

  const goalMax = Math.max(1, ...goalRows.map(r => r.mins));
  const catMax = Math.max(1, ...catRows.map(r => r.mins));

  return (
    <section className="grid md:grid-cols-2 gap-4 p-4 border-t bg-gray-50 dark:bg-gray-900">
      <div>
        <h3 className="text-sm font-semibold mb-2">🎯 목표별</h3>
        {goalRows.length === 0 && <p className="text-xs text-gray-500">기록 없음</p>}
        {goalRows.map((r, i) => (
          <div key={i} className="flex items-center gap-2 text-xs mb-1">
            <div className="w-24 truncate">{r.label}</div>
            <div className="flex-1 bg-gray-200 rounded h-2 overflow-hidden">
              <div style={{ width: `${(r.mins / goalMax) * 100}%`, background: r.color }}
                className="h-full" />
            </div>
            <div className="w-16 text-right">{formatHours(r.mins)}</div>
          </div>
        ))}
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-2">🎨 카테고리별</h3>
        {catRows.length === 0 && <p className="text-xs text-gray-500">기록 없음</p>}
        {catRows.map((r, i) => (
          <div key={i} className="flex items-center gap-2 text-xs mb-1">
            <div className="w-24 truncate">{r.label}</div>
            <div className="flex-1 bg-gray-200 rounded h-2 overflow-hidden">
              <div style={{ width: `${(r.mins / catMax) * 100}%`, background: r.color }}
                className="h-full" />
            </div>
            <div className="w-16 text-right">{formatHours(r.mins)}</div>
          </div>
        ))}
      </div>
    </section>
  );
};
