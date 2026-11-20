'use client';
import { Plus, Trash2, Lock } from 'lucide-react';
import { MONTHS, formatSchedule } from './annualGoalPresentation';
import type { AnnualGoalViewModel } from './useAnnualGoals';

export function AnnualGoalMobile({ goals, habitsByAnnualId, mandalartGoals, patch, patchMonthly, addRow, remove }: AnnualGoalViewModel) {
  return (
    <>
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
              className={`bg-white dark:bg-zinc-900 border rounded-xl p-3 shadow-sm ${isLinked ? 'border-blue-300 dark:border-blue-800' : 'border-zinc-200 dark:border-zinc-800'
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
                  onChange={(e) => patch(g, 'parentGoalId', e.target.value || null)}
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
                    onBlur={(e) => patch(g, 'deadline', e.target.value.trim() || null)}
                    placeholder="-"
                    className="bg-zinc-50 dark:bg-zinc-800/50 rounded px-2 py-1 mt-0.5 outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wide">수치화</span>
                  <input
                    type="text"
                    defaultValue={g.metric ?? ''}
                    onBlur={(e) => patch(g, 'metric', e.target.value.trim() || null)}
                    placeholder="-"
                    className="bg-zinc-50 dark:bg-zinc-800/50 rounded px-2 py-1 mt-0.5 outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </label>
                <label className="flex flex-col col-span-2">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wide">실천 내용</span>
                  <input
                    type="text"
                    defaultValue={g.action ?? ''}
                    onBlur={(e) => patch(g, 'action', e.target.value.trim() || null)}
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
                      patch(g, 'target', e.target.value === '' ? null : Number(e.target.value))
                    }
                    placeholder="-"
                    readOnly={isLinked}
                    title={isLinked ? '🔁 습관 스케줄에서 자동 계산됨' : '월 목표 입력 시 자동 합산'}
                    className={`bg-blue-50 dark:bg-blue-950/30 rounded px-2 py-1.5 mt-0.5 outline-none tabular-nums text-base font-bold text-blue-800 dark:text-blue-200 ${isLinked ? 'cursor-not-allowed' : 'focus:ring-1 focus:ring-blue-500'
                      }`}
                  />
                </label>
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wide">달성률</span>
                  <div
                    className={`mt-0.5 px-2 py-1 rounded tabular-nums font-semibold text-sm
                      ${pct === null
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
                      className={`rounded-md text-center px-1 py-1 ${i < 6
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
                        className={`w-full bg-transparent outline-none px-0 py-1 tabular-nums text-center text-sm font-semibold ${isLinked ? 'cursor-not-allowed text-blue-700 dark:text-blue-300' : 'text-zinc-700 dark:text-zinc-200 focus:bg-blue-100 dark:focus:bg-blue-900/40'
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
    </>
  );
}
