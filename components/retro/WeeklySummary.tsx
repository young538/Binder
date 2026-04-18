import { TimeBlock, Category, Goal } from '@/lib/types';
import { aggregateByCategory, aggregateByGoal, aggregateByDay } from '@/lib/aggregate';
import { weekDates, toIsoDate } from '@/lib/utils/date';

interface Props {
  isoweek: string;
  blocks: TimeBlock[];
  categories: Category[];
  goals: Goal[];
}

const hours = (m: number) => (m / 60).toFixed(1);

export const WeeklySummary = ({ isoweek, blocks, categories, goals }: Props) => {
  const totalMin = blocks.reduce((s, b) => s + (b.endMin - b.startMin), 0);
  const byCat = aggregateByCategory(blocks);
  const byGoal = aggregateByGoal(blocks);
  const byDay = aggregateByDay(blocks);
  const dates = weekDates(isoweek).map(toIsoDate);
  const dayMax = Math.max(1, ...dates.map((d) => byDay.get(d) ?? 0));

  return (
    <section className="grid md:grid-cols-3 gap-4 mb-6">
      <div className="p-4 border rounded">
        <div className="text-xs text-gray-500">총 기록 시간</div>
        <div className="text-3xl font-bold">{hours(totalMin)}h</div>
      </div>
      <div className="p-4 border rounded">
        <div className="text-xs text-gray-500 mb-2">카테고리별</div>
        {byCat.size === 0 && <div className="text-xs text-gray-400">기록 없음</div>}
        {Array.from(byCat.entries()).map(([cid, m]) => {
          const cat = categories.find((c) => c.id === cid);
          return (
            <div key={cid} className="flex items-center gap-2 text-sm">
              <span className="w-3 h-3 rounded" style={{ background: cat?.color ?? '#ccc' }} />
              <span className="flex-1">{cat?.name ?? '?'}</span>
              <span>{hours(m)}h</span>
            </div>
          );
        })}
      </div>
      <div className="p-4 border rounded">
        <div className="text-xs text-gray-500 mb-2">목표별</div>
        {byGoal.size === 0 && <div className="text-xs text-gray-400">기록 없음</div>}
        {Array.from(byGoal.entries()).map(([gid, m]) => (
          <div key={gid ?? '_'} className="flex justify-between text-sm">
            <span className="truncate">
              {gid ? (goals.find((g) => g.id === gid)?.title ?? '(삭제됨)') : '(미지정)'}
            </span>
            <span>{hours(m)}h</span>
          </div>
        ))}
      </div>
      <div className="md:col-span-3 p-4 border rounded">
        <div className="text-xs text-gray-500 mb-2">요일별</div>
        <div className="grid grid-cols-7 gap-2 items-end h-32">
          {dates.map((d) => {
            const m = byDay.get(d) ?? 0;
            return (
              <div key={d} className="flex flex-col items-center gap-1">
                <div
                  className="w-full bg-blue-500 rounded"
                  style={{ height: `${(m / dayMax) * 100}%`, minHeight: m ? 2 : 0 }}
                />
                <div className="text-xs text-gray-600">{d.slice(-5)}</div>
                <div className="text-[10px] text-gray-500">{hours(m)}h</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
