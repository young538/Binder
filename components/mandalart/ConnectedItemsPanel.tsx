'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { Goal, AnnualGoal, HabitSchedule } from '@/lib/types';
import { listHabits, createHabit } from '@/lib/repo/habits';
import {
  listByYear as listAnnualGoalsByYear,
  createAnnualGoal,
  updateAnnualGoal,
  deleteAnnualGoal,
} from '@/lib/repo/annualGoals';

interface Props {
  goal: Goal;
  onChange?: () => void;
}

const INPUT_CLS =
  'border border-zinc-200 dark:border-zinc-700 rounded-md px-2.5 py-1.5 w-full text-sm bg-white dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-blue-400';

// Pick a sensible default habit schedule for a given annual target.
// target 12 → perMonth: 1, target 60 → perMonth: 5, etc. Cap perMonth at ~28,
// otherwise switch to daily.
const scheduleForAnnualTarget = (target: number): HabitSchedule => {
  const perMonth = Math.round(target / 12);
  if (perMonth >= 28) return { kind: 'daily' };
  if (perMonth <= 0) return { kind: 'perMonth', count: 1 };
  return { kind: 'perMonth', count: perMonth };
};

const formatSchedule = (s: HabitSchedule): string => {
  if (s.kind === 'daily') return '매일';
  if (s.kind === 'weekdays') return `${s.days.length}일/주`;
  if (s.kind === 'perWeek') return `주 ${s.count}회`;
  return `월 ${s.count}회`;
};

export const ConnectedItemsPanel = ({ goal, onChange }: Props) => {
  const [annualGoals, setAnnualGoals] = useState<AnnualGoal[]>([]);
  const [adding, setAdding] = useState(false);

  const [agTitle, setAgTitle] = useState('');
  const [agMetric, setAgMetric] = useState('');
  const [agTarget, setAgTarget] = useState('');
  const [agDeadline, setAgDeadline] = useState('');
  const [agAlsoCreateHabit, setAgAlsoCreateHabit] = useState(true);

  const reload = async () => {
    const year = String(new Date().getFullYear());
    const a = await listAnnualGoalsByYear(year).then(as => as.filter(x => x.parentGoalId === goal.id));
    setAnnualGoals(a);
  };

  useEffect(() => {
    reload();
    setAdding(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal.id]);

  const openAdd = () => {
    setAgTitle(goal.title);
    setAgMetric('');
    setAgTarget('');
    setAgDeadline('');
    setAgAlsoCreateHabit(true);
    setAdding(true);
  };

  const saveAnnualGoal = async () => {
    if (!agTitle.trim()) return;
    const year = String(new Date().getFullYear());
    const existing = await listAnnualGoalsByYear(year);
    const order = existing.length > 0 ? Math.max(...existing.map(g => g.order)) + 1 : 1;
    const created = await createAnnualGoal(year, order);
    const targetNum = agTarget ? Number(agTarget) : undefined;
    await updateAnnualGoal(created.id, {
      parentGoalId: goal.id,
      title: agTitle.trim(),
      metric: agMetric.trim() || undefined,
      target: targetNum,
      deadline: agDeadline || undefined,
    });
    if (agAlsoCreateHabit && targetNum && targetNum > 0) {
      const all = await listHabits();
      await createHabit({
        name: agTitle.trim(),
        color: goal.color || '#cfe2f3',
        order: all.length,
        schedule: scheduleForAnnualTarget(targetNum),
        parentGoalId: goal.id,
        annualGoalId: created.id,
      });
    }
    setAdding(false);
    await reload();
    onChange?.();
  };

  const removeAnnualGoal = async (id: string) => {
    if (!confirm('연간 목표를 삭제할까요?')) return;
    await deleteAnnualGoal(id);
    await reload();
    onChange?.();
  };

  return (
    <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 mt-3 space-y-2">
      <div className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
        이 목표의 연간 계획
      </div>

      <div className="rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 px-2.5 py-1.5">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">🎯 연간 수치 목표</span>
          <span className="text-xs text-zinc-500 tabular-nums">{annualGoals.length}개</span>
        </div>
        {annualGoals.length > 0 && (
          <div className="p-1.5 border-b border-zinc-100 dark:border-zinc-800 space-y-0.5">
            {annualGoals.map(ag => {
              const recommended = ag.target && ag.target > 0 ? scheduleForAnnualTarget(ag.target) : null;
              return (
                <ItemRow key={ag.id} onDelete={() => removeAnnualGoal(ag.id)}>
                  <span className="font-medium">{ag.title || '(제목 없음)'}</span>
                  {ag.target !== undefined && (
                    <span className="text-xs text-zinc-500">
                      {' · '}목표 {ag.target}
                      {ag.metric ?? ''}
                    </span>
                  )}
                  {recommended && (
                    <span className="text-xs text-blue-600 dark:text-blue-400">
                      {' · 🔁 '}
                      {formatSchedule(recommended)}
                    </span>
                  )}
                  {ag.deadline && (
                    <span className="text-xs text-zinc-500"> · ~{ag.deadline}</span>
                  )}
                </ItemRow>
              );
            })}
          </div>
        )}
        {adding ? (
          <div className="p-2 bg-zinc-50/50 dark:bg-zinc-900/50">
            <div className="space-y-2">
              <input
                value={agTitle}
                onChange={e => setAgTitle(e.target.value)}
                placeholder="제목 (예: 책 60권 읽기)"
                className={INPUT_CLS}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={agMetric}
                  onChange={e => setAgMetric(e.target.value)}
                  placeholder="단위 (권, kg, 회)"
                  className={INPUT_CLS}
                />
                <input
                  value={agTarget}
                  onChange={e => setAgTarget(e.target.value)}
                  placeholder="목표 수치"
                  type="number"
                  className={INPUT_CLS}
                />
              </div>
              <input
                value={agDeadline}
                onChange={e => setAgDeadline(e.target.value)}
                type="date"
                className={INPUT_CLS}
              />
              {agTarget && Number(agTarget) > 0 && (
                <label className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400 bg-blue-50/60 dark:bg-blue-950/20 px-2 py-1.5 rounded-md border border-blue-100 dark:border-blue-900/40">
                  <input
                    type="checkbox"
                    checked={agAlsoCreateHabit}
                    onChange={e => setAgAlsoCreateHabit(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">
                      🔁 {formatSchedule(scheduleForAnnualTarget(Number(agTarget)))} 습관도 함께 만들기
                    </span>
                    <br />
                    <span className="text-[10px]">
                      습관 체크 시 이 목표에 자동 집계
                    </span>
                  </span>
                </label>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="px-3 py-1 rounded-md text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={saveAnnualGoal}
                  className="px-3 py-1 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white ml-auto"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={openAdd}
            className="w-full flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-blue-50 dark:text-zinc-400 dark:hover:bg-blue-950/30 hover:text-blue-700 transition"
          >
            <Plus size={12} /> 연간 목표 추가
          </button>
        )}
      </div>

      <p className="text-[10px] text-zinc-400 pt-1">
        습관/TODO는 연간·주간·설정 화면에서 관리하세요.
      </p>
    </div>
  );
};

const ItemRow = ({
  children,
  onDelete,
}: {
  children: ReactNode;
  onDelete: () => void;
}) => (
  <div className="flex items-center justify-between px-2 py-1 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-sm text-zinc-700 dark:text-zinc-300">
    <div className="flex-1 truncate">{children}</div>
    <button
      type="button"
      onClick={onDelete}
      className="p-1 text-zinc-400 hover:text-red-600 rounded"
      aria-label="삭제"
    >
      <Trash2 size={13} />
    </button>
  </div>
);
