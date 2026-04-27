'use client';
import { Goal } from '@/lib/types';
import { GoalProgress } from '@/lib/progress';

interface Props {
  goal: Goal;
  progress: GoalProgress;
  onClick?: () => void;
}

const hours = (m: number) => (m / 60).toFixed(1);

export const GoalProgressCard = ({ goal, progress, onClick }: Props) => {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={`w-full text-left bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 ${onClick ? 'hover:shadow-md hover:border-blue-300 transition' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-50 truncate flex-1">
          {goal.title || '(미입력)'}
        </div>
        <div className="text-xs font-bold tabular-nums text-blue-600 shrink-0">
          {progress.overall}%
        </div>
      </div>
      <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-blue-500 rounded-full transition-all"
          style={{ width: `${progress.overall}%` }}
        />
      </div>
      <div className="flex items-center gap-3 text-[10px] text-zinc-500 tabular-nums flex-wrap">
        {progress.numeric && (
          <span>📊 {progress.numeric.current}/{progress.numeric.target}</span>
        )}
        {progress.habits && (
          <span>
            🔁 {progress.habits.thisMonthLogs}/
            {progress.habits.expectedThisMonth} ({progress.habits.percent}%)
          </span>
        )}
        {progress.todos && (
          <span>✅ {progress.todos.done}/{progress.todos.total}</span>
        )}
        {progress.timeInvested.weekMin > 0 && (
          <span>⏱️ 주 {hours(progress.timeInvested.weekMin)}h</span>
        )}
      </div>
    </Wrapper>
  );
};
