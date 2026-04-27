'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { AnnualGoal, Habit, HabitSchedule, Weekday } from '@/lib/types';
import { listHabits, createHabit, updateHabit, deleteHabit } from '@/lib/repo/habits';
import { listByYear as listAnnualGoalsByYear } from '@/lib/repo/annualGoals';
import { onDirty } from '@/lib/repo/events';
import { useBinder } from '@/store';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const ALL_WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

type ScheduleKind = HabitSchedule['kind'];

const kindLabel: Record<ScheduleKind, string> = {
  daily: '매일',
  weekdays: '요일',
  perWeek: '주 N회',
  perMonth: '월 N회',
};

const getSchedule = (h: Habit): HabitSchedule => h.schedule ?? { kind: 'daily' };

export const HabitEditor = () => {
  const { goals, categories } = useBinder();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [annualGoals, setAnnualGoals] = useState<AnnualGoal[]>([]);

  const reload = async () => {
    const year = String(new Date().getFullYear());
    const [hs, ags] = await Promise.all([
      listHabits(),
      listAnnualGoalsByYear(year),
    ]);
    setHabits(hs);
    setAnnualGoals(ags);
  };

  useEffect(() => {
    reload();
    const unsubscribe = onDirty(() => {
      reload();
    });
    return unsubscribe;
  }, []);

  const add = async () => {
    await createHabit({
      name: '새 습관',
      color: '#d9ead3',
      order: habits.length,
      schedule: { kind: 'daily' },
    });
    reload();
  };
  const update = async (id: string, patch: Partial<Omit<Habit, 'id'>>) => {
    await updateHabit(id, patch);
    reload();
  };
  const remove = async (id: string) => {
    if (!confirm('습관 삭제? 관련 체크 기록도 모두 삭제됩니다.')) return;
    await deleteHabit(id);
    reload();
  };

  const changeKind = (h: Habit, kind: ScheduleKind) => {
    let schedule: HabitSchedule;
    if (kind === 'daily') schedule = { kind: 'daily' };
    else if (kind === 'weekdays') {
      const prev = getSchedule(h);
      schedule = { kind: 'weekdays', days: prev.kind === 'weekdays' ? prev.days : [1, 2, 3, 4, 5] };
    } else if (kind === 'perWeek') {
      const prev = getSchedule(h);
      schedule = { kind: 'perWeek', count: prev.kind === 'perWeek' ? prev.count : 3 };
    } else {
      const prev = getSchedule(h);
      schedule = { kind: 'perMonth', count: prev.kind === 'perMonth' ? prev.count : 4 };
    }
    update(h.id, { schedule });
  };

  const toggleDayInSchedule = (h: Habit, d: Weekday) => {
    const s = getSchedule(h);
    if (s.kind !== 'weekdays') return;
    const next = s.days.includes(d)
      ? s.days.filter(x => x !== d)
      : ([...s.days, d].sort() as Weekday[]);
    if (next.length === 0) return; // keep at least one
    update(h.id, { schedule: { kind: 'weekdays', days: next } });
  };

  const changeCount = (h: Habit, count: number) => {
    const s = getSchedule(h);
    if (s.kind !== 'perWeek' && s.kind !== 'perMonth') return;
    const c = Math.max(1, Math.min(99, count));
    update(h.id, { schedule: { ...s, count: c } });
  };

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5">
      <h2 className="text-base font-semibold mb-1 text-zinc-800 dark:text-zinc-50">습관</h2>
      <p className="text-xs text-zinc-500 mb-3">
        매일 · 요일 지정 · 주 N회 · 월 N회 중 선택해 관리하세요.
      </p>
      <ul className="space-y-3">
        {habits.length === 0 && (
          <li className="text-sm text-zinc-400 py-2">습관이 없어요. 추가해보세요.</li>
        )}
        {habits.map((h) => {
          const sched = getSchedule(h);
          return (
            <li key={h.id} className="border border-zinc-100 dark:border-zinc-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="color"
                  value={h.color}
                  onChange={(e) => update(h.id, { color: e.target.value })}
                  className="w-9 h-9 rounded-md border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                />
                <input
                  type="text"
                  defaultValue={h.name}
                  onBlur={(e) => update(h.id, { name: e.target.value.trim() || '습관' })}
                  className="flex-1 min-w-[140px] border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => remove(h.id)}
                  aria-label="삭제"
                  className="p-2 text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div>
                <div className="text-[10px] text-zinc-500 mb-1">빈도</div>
                <div className="flex gap-1 flex-wrap">
                  {(['daily', 'weekdays', 'perWeek', 'perMonth'] as ScheduleKind[]).map(k => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => changeKind(h, k)}
                      className={`px-2.5 py-1 rounded-md text-xs border transition ${
                        sched.kind === k
                          ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/40 dark:border-blue-700 dark:text-blue-300'
                          : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {kindLabel[k]}
                    </button>
                  ))}
                </div>
                {sched.kind === 'weekdays' && (
                  <div className="flex gap-1 mt-2">
                    {ALL_WEEKDAYS.map(d => {
                      const on = sched.days.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleDayInSchedule(h, d)}
                          className={`w-7 h-7 rounded-md text-xs border transition ${
                            on
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
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={sched.count}
                      onChange={e => changeCount(h, Number(e.target.value))}
                      className="w-16 border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1 text-sm bg-white dark:bg-zinc-950 tabular-nums"
                    />
                    <span className="text-xs text-zinc-500">
                      {sched.kind === 'perWeek' ? '회/주' : '회/월'}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={h.categoryId ?? ''}
                  onChange={(e) => update(h.id, { categoryId: e.target.value || undefined })}
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
                  onChange={(e) => update(h.id, { parentGoalId: e.target.value || undefined })}
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
                  onChange={(e) => update(h.id, { annualGoalId: e.target.value || undefined })}
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
                const linked = annualGoals.find(a => a.id === h.annualGoalId);
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
            </li>
          );
        })}
      </ul>
      <button
        onClick={add}
        className="mt-4 flex items-center gap-1.5 px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
      >
        <Plus size={14} /> 습관 추가
      </button>
    </section>
  );
};
