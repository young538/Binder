'use client';
import { Reorder, useDragControls } from 'motion/react';
import { GripVertical, Trash2 } from 'lucide-react';
import type { AnnualGoal, Category, Goal, Habit, HabitSchedule, Weekday } from '@/lib/types';
import { habitScheduleLabel } from '@/lib/utils/habitSchedule';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const ALL_WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export type ScheduleKind = HabitSchedule['kind'];

const kindLabel: Record<ScheduleKind, string> = {
  daily: '매일',
  weekdays: '요일',
  perWeek: '주 N회',
  perMonth: '월 N회',
};

export const getSchedule = (h: Habit): HabitSchedule => h.schedule ?? { kind: 'daily' };

export interface RowHandlers {
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Omit<Habit, 'id'>>) => void;
  onChangeKind: (h: Habit, kind: ScheduleKind) => void;
  onToggleDay: (h: Habit, d: Weekday) => void;
  onChangeCount: (h: Habit, count: number) => void;
}

export const HabitRow = ({
  h,
  annualGoals,
  goals,
  categories,
  handlers,
}: {
  h: Habit;
  annualGoals: AnnualGoal[];
  goals: Goal[];
  categories: Category[];
  handlers: RowHandlers;
}) => {
  const controls = useDragControls();
  const sched = getSchedule(h);

  return (
    <Reorder.Item
      value={h}
      as="li"
      dragListener={false}
      dragControls={controls}
      whileDrag={{
        scale: 1.02,
        boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
        zIndex: 40,
      }}
      className="relative list-none rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 space-y-2"
    >
      {/* 1행: 손잡이 / 색상 / 이름 / 빈도 칩 / 삭제 */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onPointerDown={(e) => controls.start(e)}
          aria-label="순서 변경"
          data-drag-handle
          className="shrink-0 p-1.5 -ml-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical size={18} />
        </button>
        <input
          type="color"
          value={h.color}
          onChange={(e) => handlers.onUpdate(h.id, { color: e.target.value })}
          className="shrink-0 w-7 h-7 rounded-md border border-zinc-200 dark:border-zinc-700 cursor-pointer bg-transparent p-0"
        />
        <input
          type="text"
          defaultValue={h.name}
          onBlur={(e) => handlers.onUpdate(h.id, { name: e.target.value.trim() || '습관' })}
          className="flex-1 min-w-0 rounded-lg border border-transparent px-2 py-1.5 text-sm font-medium bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/60 focus:bg-white dark:focus:bg-zinc-950 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
        <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-300 tabular-nums">
          {habitScheduleLabel(sched)}
        </span>
        <button
          type="button"
          onClick={() => handlers.onRemove(h.id)}
          aria-label="삭제"
          className="shrink-0 p-2 text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* 2행: 빈도 설정 / 연결 */}
      <div className="pl-8 space-y-2">
        <div className="flex gap-1 flex-wrap">
          {(['daily', 'weekdays', 'perWeek', 'perMonth'] as ScheduleKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => handlers.onChangeKind(h, k)}
              className={`px-2.5 py-1 rounded-md text-xs border transition ${sched.kind === k
                  ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/40 dark:border-blue-700 dark:text-blue-300'
                  : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
            >
              {kindLabel[k]}
            </button>
          ))}
        </div>
        {sched.kind === 'weekdays' && (
          <div className="flex gap-1">
            {ALL_WEEKDAYS.map((d) => {
              const on = sched.days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => handlers.onToggleDay(h, d)}
                  className={`w-7 h-7 rounded-md text-xs border transition ${on
                      ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/40 dark:border-blue-700 dark:text-blue-300'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                >
                  {DAY_LABELS[d]}
                </button>
              );
            })}
          </div>
        )}
        {(sched.kind === 'perWeek' || sched.kind === 'perMonth') && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={99}
              value={sched.count}
              onChange={(e) => handlers.onChangeCount(h, Number(e.target.value))}
              className="w-16 border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1 text-sm bg-white dark:bg-zinc-950 tabular-nums"
            />
            <span className="text-xs text-zinc-500">
              {sched.kind === 'perWeek' ? '회/주' : '회/월'}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={h.categoryId ?? ''}
            onChange={(e) => handlers.onUpdate(h.id, { categoryId: e.target.value || null })}
            className="text-xs border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 bg-white dark:bg-zinc-950"
            title="카테고리"
          >
            <option value="">카테고리 없음</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={h.parentGoalId ?? ''}
            onChange={(e) => handlers.onUpdate(h.id, { parentGoalId: e.target.value || null })}
            className="text-xs border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 bg-white dark:bg-zinc-950 max-w-[180px]"
            title="상위 목표"
          >
            <option value="">(상위 목표 없음)</option>
            <optgroup label="원씽">
              {goals.filter((g) => g.level === 'oneThing').map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </optgroup>
            <optgroup label="코어">
              {goals.filter((g) => g.level === 'mandalartCore').map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </optgroup>
            <optgroup label="서브">
              {goals.filter((g) => g.level === 'mandalartSub').map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </optgroup>
          </select>
          <select
            value={h.annualGoalId ?? ''}
            onChange={(e) => handlers.onUpdate(h.id, { annualGoalId: e.target.value || null })}
            className="text-xs border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 bg-white dark:bg-zinc-950 max-w-[200px]"
            title="연간 목표 자동 집계"
          >
            <option value="">🎯 연간 목표 연결 없음</option>
            {annualGoals.map((ag) => (
              <option key={ag.id} value={ag.id}>
                🎯 {ag.title || '(제목 없음)'}
                {ag.target ? ` · 월 ${(ag.target / 12).toFixed(1)}${ag.metric ?? ''}` : ''}
              </option>
            ))}
          </select>
        </div>

        {h.annualGoalId && (() => {
          const linked = annualGoals.find((a) => a.id === h.annualGoalId);
          if (!linked || !linked.target) return null;
          const monthIdx = new Date().getMonth();
          const monthTarget = linked.monthlyTargets?.[monthIdx] ?? linked.target / 12;
          const monthActual = linked.monthlyActuals?.[monthIdx] ?? 0;
          const percent = monthTarget > 0 ? Math.min(100, Math.round((monthActual / monthTarget) * 100)) : 0;
          return (
            <div className="text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50/60 dark:bg-blue-950/20 px-2 py-1 rounded-md tabular-nums">
              🎯 이번 달 {monthActual}/{monthTarget.toFixed(1)}{linked.metric ?? ''} ({percent}%)
            </div>
          );
        })()}
      </div>
    </Reorder.Item>
  );
};
