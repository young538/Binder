'use client';
import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Lock, ChevronDown, ChevronRight } from 'lucide-react';
import { AnnualGoal, Habit, HabitSchedule } from '@/lib/types';
import {
  listByYear,
  createAnnualGoal,
  updateAnnualGoal,
  deleteAnnualGoal,
  ensureSeven,
} from '@/lib/repo/annualGoals';
import { listHabits } from '@/lib/repo/habits';
import { onDirty } from '@/lib/repo/events';
import { useBinder } from '@/store';

interface Props { year: string; }

const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const H1 = [0, 1, 2, 3, 4, 5];
const H2 = [6, 7, 8, 9, 10, 11];

const formatSchedule = (s: HabitSchedule | undefined): string => {
  if (!s || s.kind === 'daily') return '매일';
  if (s.kind === 'weekdays') return `주 ${s.days.length}일`;
  if (s.kind === 'perWeek') return `주 ${s.count}회`;
  return `월 ${s.count}회`;
};

export const AnnualGoalTable = ({ year }: Props) => {
  const { goals: mandalartGoals } = useBinder();
  const [goals, setGoals] = useState<AnnualGoal[]>([]);
  const [habitsByAnnualId, setHabitsByAnnualId] = useState<Map<string, Habit[]>>(new Map());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const reload = async () => {
    const [gs, hs] = await Promise.all([listByYear(year), listHabits()]);
    setGoals(gs);
    const m = new Map<string, Habit[]>();
    for (const h of hs) {
      if (!h.annualGoalId) continue;
      if (!m.has(h.annualGoalId)) m.set(h.annualGoalId, []);
      m.get(h.annualGoalId)!.push(h);
    }
    setHabitsByAnnualId(m);
  };

  useEffect(() => {
    ensureSeven(year).then(() => reload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  // 다른 컴포넌트에서 habit/annualGoal이 바뀌면 자동 반영
  useEffect(() => {
    const unsubscribe = onDirty(() => {
      reload();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const patch = async (g: AnnualGoal, field: keyof AnnualGoal, value: unknown) => {
    await updateAnnualGoal(g.id, { [field]: value } as Partial<AnnualGoal>);
    reload();
  };

  const patchMonthly = async (
    g: AnnualGoal,
    type: 'monthlyTargets' | 'monthlyActuals',
    idx: number,
    value: string,
  ) => {
    const arr = [...g[type]];
    arr[idx] = value === '' ? null : Number(value);
    const patch: Partial<AnnualGoal> = { [type]: arr };
    // 월 목표 입력 시 연 목표(target)를 자동 합산
    if (type === 'monthlyTargets') {
      const sum = arr.reduce<number>((s, v) => s + (v ?? 0), 0);
      if (sum > 0) patch.target = sum;
    }
    await updateAnnualGoal(g.id, patch);
    reload();
  };

  const addRow = async () => {
    const order = goals.length ? Math.max(...goals.map(g => g.order)) + 1 : 1;
    await createAnnualGoal(year, order);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm('삭제할까요?')) return;
    await deleteAnnualGoal(id);
    reload();
  };

  return (
    <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-50">{year}년 목표</h2>
        <button
          onClick={addRow}
          className="hidden md:flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          <Plus size={12} /> 행 추가
        </button>
      </div>

      {/* Desktop / tablet table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-xs border-collapse table-fixed" style={{ minWidth: '1220px' }}>
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400">
              <th className="p-2 w-8 border-r border-zinc-200 dark:border-zinc-800"></th>
              <th className="p-2 text-left border-r border-zinc-200 dark:border-zinc-800 w-[160px]">이루고 싶은 일</th>
              <th className="p-2 w-[104px] border-r border-zinc-200 dark:border-zinc-800 bg-blue-100/60 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-sm font-bold">목표</th>
              <th colSpan={6} className="p-1 bg-blue-50 dark:bg-blue-950/30 border-r border-zinc-200 dark:border-zinc-800">상반기</th>
              <th colSpan={6} className="p-1 bg-amber-50 dark:bg-amber-950/30 border-r border-zinc-200 dark:border-zinc-800">하반기</th>
              <th rowSpan={2} className="p-2 w-[68px] border-l border-zinc-200 dark:border-zinc-700 border-r border-zinc-200 dark:border-zinc-800 align-middle text-sm">달성률</th>
              <th rowSpan={2} className="p-2 w-8"></th>
            </tr>
            <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 text-xs font-medium">
              <th colSpan={3} className="border-r border-zinc-200 dark:border-zinc-800"></th>
              {H1.map(i => (
                <th key={i} className="p-1 w-[68px] border-r border-zinc-100 dark:border-zinc-900 bg-blue-50/50 dark:bg-blue-950/20">{MONTHS[i]}</th>
              ))}
              {H2.map(i => (
                <th key={i} className="p-1 w-[68px] border-r border-zinc-100 dark:border-zinc-900 bg-amber-50/50 dark:bg-amber-950/20">{MONTHS[i]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {goals.map(g => {
              const linked = habitsByAnnualId.get(g.id) ?? [];
              const isLinked = linked.length > 0;
              const expanded = expandedId === g.id;
              return (
              <React.Fragment key={g.id}>
              <tr
                className={`border-t border-zinc-100 dark:border-zinc-800 group hover:bg-zinc-50/40 dark:hover:bg-zinc-800/20 ${
                  isLinked ? 'bg-blue-50/20 dark:bg-blue-950/10' : ''
                }`}
              >
                <td className="p-1 text-center border-r border-zinc-100 dark:border-zinc-900">
                  <button
                    onClick={() => setExpandedId(expanded ? null : g.id)}
                    className="p-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    aria-label={expanded ? '접기' : '상세 펼치기'}
                    title="상위목표 · 기한 · 실천내용 편집"
                  >
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <div className="text-[10px] text-zinc-400 tabular-nums">{g.order}</div>
                </td>
                <td className="p-1 border-r border-zinc-100 dark:border-zinc-900">
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      defaultValue={g.title}
                      onBlur={e => patch(g, 'title', e.target.value.trim())}
                      placeholder="이루고 싶은 일"
                      className="flex-1 min-w-0 bg-transparent text-zinc-800 dark:text-zinc-50 font-medium outline-none focus:bg-blue-50 dark:focus:bg-blue-950/30 px-1 rounded"
                    />
                    {isLinked && (
                      <span
                        title={`🔁 ${linked.map(h => `${h.name} (${formatSchedule(h.schedule)})`).join(', ')}`}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 whitespace-nowrap shrink-0"
                      >
                        🔁 {linked.length}
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-1 border-r border-zinc-100 dark:border-zinc-900 bg-blue-50/40 dark:bg-blue-950/20">
                  <div className="flex items-center justify-center gap-0.5">
                    {isLinked && <Lock size={11} className="text-blue-400 shrink-0" />}
                    <input
                      key={g.target ?? 'empty'}
                      type="number"
                      defaultValue={g.target ?? ''}
                      onBlur={e => patch(g, 'target', e.target.value === '' ? undefined : Number(e.target.value))}
                      placeholder="-"
                      readOnly={isLinked}
                      title={isLinked ? '🔁 습관 스케줄에서 자동 계산됨' : '연 목표 (월 목표 입력 시 자동 합산)'}
                      className={`min-w-0 bg-transparent outline-none px-0 py-1 rounded text-center tabular-nums text-base font-bold text-blue-800 dark:text-blue-200 ${
                        isLinked ? 'cursor-not-allowed' : 'focus:bg-blue-100 dark:focus:bg-blue-900/40'
                      }`}
                      style={{ width: 'calc(100% - 32px)' }}
                    />
                    <input
                      type="text"
                      defaultValue={g.metric ?? ''}
                      onBlur={e => patch(g, 'metric', e.target.value.trim() || undefined)}
                      placeholder="단위"
                      className="w-8 bg-transparent outline-none px-0 rounded text-center text-[11px] text-blue-700 dark:text-blue-300 focus:bg-blue-100 dark:focus:bg-blue-900/40"
                      title="단위 (권, kg, 회 등)"
                    />
                  </div>
                </td>
                {g.monthlyTargets.map((val, i) => {
                  const actual = g.monthlyActuals[i];
                  return (
                    <td
                      key={i}
                      className={`p-1 border-r border-zinc-100 dark:border-zinc-900 ${
                        i < 6 ? 'bg-blue-50/30 dark:bg-blue-950/10' : 'bg-amber-50/30 dark:bg-amber-950/10'
                      }`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <input
                          key={`${val ?? 'empty'}-${isLinked ? 'L' : 'M'}`}
                          type="number"
                          defaultValue={val ?? ''}
                          onBlur={e => patchMonthly(g, 'monthlyTargets', i, e.target.value)}
                          placeholder="계"
                          readOnly={isLinked}
                          title={isLinked ? '🔁 습관에서 자동 계산됨' : '월별 목표'}
                          className={`w-full bg-transparent outline-none px-0 py-0.5 rounded text-center tabular-nums text-sm font-semibold ${
                            isLinked
                              ? 'cursor-not-allowed text-blue-700 dark:text-blue-300'
                              : 'text-zinc-700 dark:text-zinc-200 focus:bg-blue-100 dark:focus:bg-blue-900/40'
                          }`}
                        />
                        <div className="h-px bg-zinc-200 dark:bg-zinc-700 mx-0.5"></div>
                        <input
                          type="number"
                          defaultValue={actual ?? ''}
                          onBlur={e => patchMonthly(g, 'monthlyActuals', i, e.target.value)}
                          placeholder="실"
                          title="월별 실적 (습관 체크 시 자동 증가)"
                          className="w-full bg-transparent outline-none focus:bg-emerald-100 dark:focus:bg-emerald-900/40 px-0 py-0.5 rounded text-center tabular-nums text-sm font-bold text-emerald-700 dark:text-emerald-300"
                        />
                      </div>
                    </td>
                  );
                })}
                <td className="p-2 text-center border-l border-zinc-200 dark:border-zinc-700 border-r border-zinc-100 dark:border-zinc-900">
                  {(() => {
                    if (!g.target || g.target <= 0) return <span className="text-zinc-400 text-sm">-</span>;
                    const sum = g.monthlyActuals.reduce<number>((s, v) => s + (v ?? 0), 0);
                    const pct = Math.round((sum / g.target) * 100);
                    const cls = pct >= 100
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : pct >= 50
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-zinc-600 dark:text-zinc-300';
                    return <span className={`text-base font-bold tabular-nums ${cls}`}>{pct}%</span>;
                  })()}
                </td>
                <td className="p-1 text-center">
                  <button
                    onClick={() => remove(g.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-red-600 transition"
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
              {expanded && (
                <tr className="bg-zinc-50/80 dark:bg-zinc-800/40 border-t border-zinc-100 dark:border-zinc-900">
                  <td></td>
                  <td colSpan={15} className="p-3">
                    <div className="grid grid-cols-[auto_1fr] md:grid-cols-[auto_1fr_auto_1fr] gap-x-3 gap-y-2 text-xs items-center">
                      <label className="text-zinc-500 font-medium">상위 목표</label>
                      <select
                        value={g.parentGoalId ?? ''}
                        onChange={e => patch(g, 'parentGoalId', e.target.value || undefined)}
                        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">(없음)</option>
                        <optgroup label="원씽">
                          {mandalartGoals.filter(mg => mg.level === 'oneThing').map(mg => (
                            <option key={mg.id} value={mg.id}>{mg.title}</option>
                          ))}
                        </optgroup>
                        <optgroup label="코어">
                          {mandalartGoals.filter(mg => mg.level === 'mandalartCore').map(mg => (
                            <option key={mg.id} value={mg.id}>{mg.title}</option>
                          ))}
                        </optgroup>
                        <optgroup label="서브">
                          {mandalartGoals.filter(mg => mg.level === 'mandalartSub').map(mg => (
                            <option key={mg.id} value={mg.id}>{mg.title}</option>
                          ))}
                        </optgroup>
                      </select>
                      <label className="text-zinc-500 font-medium">달성 기한</label>
                      <input
                        type="text"
                        defaultValue={g.deadline ?? ''}
                        onBlur={e => patch(g, 'deadline', e.target.value.trim() || undefined)}
                        placeholder="예: 2026-12-31"
                        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <label className="text-zinc-500 font-medium">실천 내용</label>
                      <input
                        type="text"
                        defaultValue={g.action ?? ''}
                        onBlur={e => patch(g, 'action', e.target.value.trim() || undefined)}
                        placeholder="어떻게 달성할지"
                        className="col-span-1 md:col-span-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </td>
                </tr>
              )}
              </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden p-3 space-y-3">
        {goals.map((g) => {
          const sum = g.monthlyActuals.reduce<number>((s, v) => s + (v ?? 0), 0);
          const pct = g.target && g.target > 0 ? Math.round((sum / g.target) * 100) : null;
          const linked = habitsByAnnualId.get(g.id) ?? [];
          const isLinked = linked.length > 0;
          return (
            <div
              key={g.id}
              className={`bg-white dark:bg-zinc-900 border rounded-xl p-3 shadow-sm ${
                isLinked ? 'border-blue-300 dark:border-blue-800' : 'border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <div className="flex items-start gap-2 mb-2">
                <span className="text-xs text-zinc-400 tabular-nums w-6 shrink-0 pt-1">{g.order}.</span>
                <input
                  type="text"
                  defaultValue={g.title}
                  onBlur={(e) => patch(g, 'title', e.target.value.trim())}
                  placeholder="이루고 싶은 일"
                  className="flex-1 bg-transparent font-semibold outline-none focus:bg-blue-50 dark:focus:bg-blue-950/30 px-2 py-1 rounded text-zinc-800 dark:text-zinc-50"
                />
                <button
                  onClick={() => remove(g.id)}
                  className="p-1.5 text-zinc-400 hover:text-red-600 rounded"
                  aria-label="삭제"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              {isLinked && (
                <div className="mb-2 text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 px-2 py-1 rounded flex items-center gap-1">
                  <Lock size={10} />
                  <span>🔁 {linked.map(h => `${h.name} · ${formatSchedule(h.schedule)}`).join(', ')} 에서 자동 계산</span>
                </div>
              )}

              <label className="flex flex-col text-xs mb-2">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wide">상위 목표</span>
                <select
                  value={g.parentGoalId ?? ''}
                  onChange={(e) => patch(g, 'parentGoalId', e.target.value || undefined)}
                  className="bg-zinc-50 dark:bg-zinc-800/50 rounded px-2 py-1 mt-0.5 outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">(없음)</option>
                  <optgroup label="원씽">
                    {mandalartGoals.filter(mg => mg.level === 'oneThing').map(mg => (
                      <option key={mg.id} value={mg.id}>{mg.title}</option>
                    ))}
                  </optgroup>
                  <optgroup label="코어">
                    {mandalartGoals.filter(mg => mg.level === 'mandalartCore').map(mg => (
                      <option key={mg.id} value={mg.id}>{mg.title}</option>
                    ))}
                  </optgroup>
                  <optgroup label="서브">
                    {mandalartGoals.filter(mg => mg.level === 'mandalartSub').map(mg => (
                      <option key={mg.id} value={mg.id}>{mg.title}</option>
                    ))}
                  </optgroup>
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                <label className="flex flex-col">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wide">달성 기한</span>
                  <input
                    type="text"
                    defaultValue={g.deadline ?? ''}
                    onBlur={(e) => patch(g, 'deadline', e.target.value.trim() || undefined)}
                    placeholder="-"
                    className="bg-zinc-50 dark:bg-zinc-800/50 rounded px-2 py-1 mt-0.5 outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wide">수치화</span>
                  <input
                    type="text"
                    defaultValue={g.metric ?? ''}
                    onBlur={(e) => patch(g, 'metric', e.target.value.trim() || undefined)}
                    placeholder="-"
                    className="bg-zinc-50 dark:bg-zinc-800/50 rounded px-2 py-1 mt-0.5 outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </label>
                <label className="flex flex-col col-span-2">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wide">실천 내용</span>
                  <input
                    type="text"
                    defaultValue={g.action ?? ''}
                    onBlur={(e) => patch(g, 'action', e.target.value.trim() || undefined)}
                    placeholder="-"
                    className="bg-zinc-50 dark:bg-zinc-800/50 rounded px-2 py-1 mt-0.5 outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-[10px] text-blue-700 dark:text-blue-300 uppercase tracking-wide font-bold">연 목표</span>
                  <input
                    key={g.target ?? 'empty'}
                    type="number"
                    defaultValue={g.target ?? ''}
                    onBlur={(e) =>
                      patch(g, 'target', e.target.value === '' ? undefined : Number(e.target.value))
                    }
                    placeholder="-"
                    readOnly={isLinked}
                    title={isLinked ? '🔁 습관 스케줄에서 자동 계산됨' : '월 목표 입력 시 자동 합산'}
                    className={`bg-blue-50 dark:bg-blue-950/30 rounded px-2 py-1.5 mt-0.5 outline-none tabular-nums text-base font-bold text-blue-800 dark:text-blue-200 ${
                      isLinked ? 'cursor-not-allowed' : 'focus:ring-1 focus:ring-blue-500'
                    }`}
                  />
                </label>
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wide">달성률</span>
                  <div
                    className={`mt-0.5 px-2 py-1 rounded tabular-nums font-semibold text-sm
                      ${
                        pct === null
                          ? 'text-zinc-400'
                          : pct >= 100
                            ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
                            : pct >= 50
                              ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/30'
                              : 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800'
                      }`}
                  >
                    {pct === null ? '-' : `${pct}%`}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">월별 계획/실적</div>
                <div className="grid grid-cols-4 gap-1.5 text-xs">
                  {MONTHS.map((m, i) => (
                    <div
                      key={i}
                      className={`rounded-md text-center px-1 py-1 ${
                        i < 6
                          ? 'bg-blue-50/60 dark:bg-blue-950/20'
                          : 'bg-amber-50/60 dark:bg-amber-950/20'
                      }`}
                    >
                      <div className="text-[10px] text-zinc-600 dark:text-zinc-400 font-medium pt-0.5">{m}</div>
                      <input
                        key={`${g.monthlyTargets[i] ?? 'empty'}-${isLinked ? 'L' : 'M'}`}
                        type="number"
                        defaultValue={g.monthlyTargets[i] ?? ''}
                        onBlur={(e) => patchMonthly(g, 'monthlyTargets', i, e.target.value)}
                        placeholder="계"
                        readOnly={isLinked}
                        className={`w-full bg-transparent outline-none px-0 py-1 tabular-nums text-center text-sm font-semibold ${
                          isLinked ? 'cursor-not-allowed text-blue-700 dark:text-blue-300' : 'text-zinc-700 dark:text-zinc-200 focus:bg-blue-100 dark:focus:bg-blue-900/40'
                        }`}
                      />
                      <div className="h-px bg-zinc-200 dark:bg-zinc-700 mx-1"></div>
                      <input
                        type="number"
                        defaultValue={g.monthlyActuals[i] ?? ''}
                        onBlur={(e) => patchMonthly(g, 'monthlyActuals', i, e.target.value)}
                        placeholder="실"
                        className="w-full bg-transparent outline-none px-0 py-1 tabular-nums text-center text-sm font-bold text-emerald-700 dark:text-emerald-300 focus:bg-emerald-100 dark:focus:bg-emerald-900/40"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        <button
          onClick={addRow}
          className="w-full flex items-center justify-center gap-1.5 py-3 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl text-sm text-zinc-600 dark:text-zinc-400 hover:border-blue-400 hover:text-blue-600"
        >
          <Plus size={14} /> 행 추가
        </button>
      </div>

      <div className="px-4 py-2 text-[10px] text-zinc-500 bg-zinc-50 dark:bg-zinc-800/30">
        💡 각 월 셀의 위 숫자=계획(목표), 아래=실적. 월 계획을 입력하면 연 목표가 자동 합산됩니다. 달성률 = Σ실적 / 목표.
      </div>
    </section>
  );
};
