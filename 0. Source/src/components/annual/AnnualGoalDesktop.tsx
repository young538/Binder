'use client';
import React from 'react';
import { Trash2, Lock, ChevronDown, ChevronRight } from 'lucide-react';
import { MONTHS, H1, H2, formatSchedule } from './annualGoalPresentation';
import type { AnnualGoalViewModel } from './useAnnualGoals';

export function AnnualGoalDesktop({ goals, habitsByAnnualId, mandalartGoals, expandedId, setExpandedId, patch, patchMonthly, remove }: AnnualGoalViewModel) {
  return (
    <>
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
                    className={`border-t border-zinc-100 dark:border-zinc-800 group hover:bg-zinc-50/40 dark:hover:bg-zinc-800/20 ${isLinked ? 'bg-blue-50/20 dark:bg-blue-950/10' : ''
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
                          onBlur={e => patch(g, 'target', e.target.value === '' ? null : Number(e.target.value))}
                          placeholder="-"
                          readOnly={isLinked}
                          title={isLinked ? '🔁 습관 스케줄에서 자동 계산됨' : '연 목표 (월 목표 입력 시 자동 합산)'}
                          className={`min-w-0 bg-transparent outline-none px-0 py-1 rounded text-center tabular-nums text-base font-bold text-blue-800 dark:text-blue-200 ${isLinked ? 'cursor-not-allowed' : 'focus:bg-blue-100 dark:focus:bg-blue-900/40'
                            }`}
                          style={{ width: 'calc(100% - 32px)' }}
                        />
                        <input
                          type="text"
                          defaultValue={g.metric ?? ''}
                          onBlur={e => patch(g, 'metric', e.target.value.trim() || null)}
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
                          className={`p-1 border-r border-zinc-100 dark:border-zinc-900 ${i < 6 ? 'bg-blue-50/30 dark:bg-blue-950/10' : 'bg-amber-50/30 dark:bg-amber-950/10'
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
                              className={`w-full bg-transparent outline-none px-0 py-0.5 rounded text-center tabular-nums text-sm font-semibold ${isLinked
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
                            onChange={e => patch(g, 'parentGoalId', e.target.value || null)}
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
                            onBlur={e => patch(g, 'deadline', e.target.value.trim() || null)}
                            placeholder="예: 2026-12-31"
                            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <label className="text-zinc-500 font-medium">실천 내용</label>
                          <input
                            type="text"
                            defaultValue={g.action ?? ''}
                            onBlur={e => patch(g, 'action', e.target.value.trim() || null)}
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
    </>
  );
}
