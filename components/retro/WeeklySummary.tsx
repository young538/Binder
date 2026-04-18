import { TimeBlock, Category, Goal, Todo } from '@/lib/types';
import { aggregateByCategory, aggregateByGoal, aggregateByDay, aggregateByTodo } from '@/lib/aggregate';
import { weekDates, toIsoDate } from '@/lib/utils/date';

interface Props {
  isoweek: string;
  blocks: TimeBlock[];
  todos: Todo[];
  categories: Category[];
  goals: Goal[];
}

const DOW = ['월', '화', '수', '목', '금', '토', '일'];

const hours = (m: number) => (m / 60).toFixed(1);

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-4">
    <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">{title}</div>
    {children}
  </div>
);

export const WeeklySummary = ({ isoweek, blocks, todos, categories, goals }: Props) => {
  const totalMin = blocks.reduce((s, b) => s + (b.endMin - b.startMin), 0);
  const byCat = aggregateByCategory(blocks);
  const byGoal = aggregateByGoal(blocks);
  const byDay = aggregateByDay(blocks);
  const byTodo = aggregateByTodo(blocks);
  const dates = weekDates(isoweek).map(toIsoDate);
  const dayMax = Math.max(1, ...dates.map((d) => byDay.get(d) ?? 0));

  const totalTodos = todos.length;
  const doneTodos = todos.filter((t) => t.done).length;
  const completionPct = totalTodos > 0 ? Math.round((doneTodos / totalTodos) * 100) : 0;

  return (
    <section className="grid md:grid-cols-3 gap-3 mb-6">
      <Card title="총 기록 시간">
        <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
          {hours(totalMin)}
          <span className="text-lg font-medium text-zinc-500">h</span>
        </div>
      </Card>

      <Card title="TODO 완료율">
        {totalTodos === 0 ? (
          <div className="text-sm text-zinc-400">TODO 없음</div>
        ) : (
          <div>
            <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
              {doneTodos}
              <span className="text-lg font-medium text-zinc-500">/{totalTodos}</span>
              <span className="text-base font-normal text-zinc-500 ml-2">({completionPct}%)</span>
            </div>
            <div className="mt-2 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
        )}
      </Card>

      <Card title="카테고리별">
        {byCat.size === 0 && <div className="text-sm text-zinc-400">기록 없음</div>}
        <div className="space-y-1.5">
          {Array.from(byCat.entries()).map(([cid, m]) => {
            const cat = categories.find((c) => c.id === cid);
            return (
              <div key={cid} className="flex items-center gap-2 text-sm">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: cat?.color ?? '#d4d4d8' }} />
                <span className="flex-1 truncate text-zinc-700 dark:text-zinc-300">{cat?.name ?? '?'}</span>
                <span className="text-zinc-600 dark:text-zinc-400 tabular-nums">{hours(m)}h</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="목표별">
        {byGoal.size === 0 && <div className="text-sm text-zinc-400">기록 없음</div>}
        <div className="space-y-1.5">
          {Array.from(byGoal.entries()).map(([gid, m]) => (
            <div key={gid ?? '_'} className="flex justify-between text-sm">
              <span className="truncate text-zinc-700 dark:text-zinc-300">
                {gid ? (goals.find((g) => g.id === gid)?.title ?? '(삭제됨)') : '(미지정)'}
              </span>
              <span className="text-zinc-600 dark:text-zinc-400 tabular-nums">{hours(m)}h</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="TODO별 시간">
        {byTodo.size === 0 && <div className="text-sm text-zinc-400">연결된 시간 블록 없음</div>}
        <div className="space-y-1.5">
          {Array.from(byTodo.entries()).map(([tid, m]) => {
            const todo = tid ? todos.find((t) => t.id === tid) : null;
            const label = tid ? (todo?.title ?? '(삭제된 TODO)') : '(TODO 미연결)';
            return (
              <div key={tid ?? '_'} className="flex justify-between text-sm">
                <span className="truncate text-zinc-700 dark:text-zinc-300">
                  {todo?.done && <span className="text-emerald-600 mr-1">✓</span>}
                  {label}
                </span>
                <span className="text-zinc-600 dark:text-zinc-400 tabular-nums">{hours(m)}h</span>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="md:col-span-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-4">
        <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">요일별 기록</div>
        <div className="grid grid-cols-7 gap-3 items-end h-36">
          {dates.map((d, i) => {
            const m = byDay.get(d) ?? 0;
            const today = toIsoDate(new Date());
            const isToday = d === today;
            return (
              <div key={d} className="flex flex-col items-center gap-1.5">
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-md relative" style={{ height: '100%' }}>
                  <div
                    className={`absolute bottom-0 inset-x-0 rounded-md transition-all ${isToday ? 'bg-blue-500' : 'bg-blue-400/80'}`}
                    style={{ height: `${(m / dayMax) * 100}%`, minHeight: m ? 4 : 0 }}
                  />
                </div>
                <div className={`text-xs ${isToday ? 'font-semibold text-blue-600' : 'text-zinc-600 dark:text-zinc-400'}`}>{DOW[i]}</div>
                <div className="text-[10px] text-zinc-500 tabular-nums">{hours(m)}h</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
