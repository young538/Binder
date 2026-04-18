'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { AnnualGoal } from '@/lib/types';
import {
  listByYear,
  createAnnualGoal,
  updateAnnualGoal,
  deleteAnnualGoal,
  ensureSeven,
} from '@/lib/repo/annualGoals';

interface Props { year: string; }

const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const H1 = [0, 1, 2, 3, 4, 5];
const H2 = [6, 7, 8, 9, 10, 11];

export const AnnualGoalTable = ({ year }: Props) => {
  const [goals, setGoals] = useState<AnnualGoal[]>([]);

  const reload = () => listByYear(year).then(setGoals);

  useEffect(() => {
    ensureSeven(year).then(setGoals);
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
    await updateAnnualGoal(g.id, { [type]: arr });
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
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{year}년 목표</h2>
        <button
          onClick={addRow}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          <Plus size={12} /> 행 추가
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse" style={{ minWidth: '1200px' }}>
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400">
              <th className="p-2 w-8 border-r border-zinc-200 dark:border-zinc-800">#</th>
              <th className="p-2 text-left border-r border-zinc-200 dark:border-zinc-800 min-w-[180px]">이루고 싶은 일</th>
              <th className="p-2 w-24 border-r border-zinc-200 dark:border-zinc-800">달성 기한</th>
              <th className="p-2 text-left border-r border-zinc-200 dark:border-zinc-800 min-w-[160px]">실천 내용</th>
              <th className="p-2 text-left border-r border-zinc-200 dark:border-zinc-800 min-w-[120px]">수치화</th>
              <th className="p-2 w-16 border-r border-zinc-200 dark:border-zinc-800">목표</th>
              <th colSpan={6} className="p-1 bg-blue-50 dark:bg-blue-950/30 border-r border-zinc-200 dark:border-zinc-800">상반기</th>
              <th colSpan={6} className="p-1 bg-amber-50 dark:bg-amber-950/30 border-r border-zinc-200 dark:border-zinc-800">하반기</th>
              <th rowSpan={2} className="p-2 w-16 border-l border-zinc-200 dark:border-zinc-700 border-r border-zinc-200 dark:border-zinc-800 align-middle">달성률</th>
              <th rowSpan={2} className="p-2 w-8"></th>
            </tr>
            <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 text-[10px]">
              <th colSpan={6} className="border-r border-zinc-200 dark:border-zinc-800"></th>
              {H1.map(i => (
                <th key={i} className="p-1 w-14 border-r border-zinc-100 dark:border-zinc-900 bg-blue-50/50 dark:bg-blue-950/20">{MONTHS[i]}</th>
              ))}
              {H2.map(i => (
                <th key={i} className="p-1 w-14 border-r border-zinc-100 dark:border-zinc-900 bg-amber-50/50 dark:bg-amber-950/20">{MONTHS[i]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {goals.map(g => (
              <tr
                key={g.id}
                className="border-t border-zinc-100 dark:border-zinc-800 group hover:bg-zinc-50/40 dark:hover:bg-zinc-800/20"
              >
                <td className="p-1 text-center text-zinc-400 border-r border-zinc-100 dark:border-zinc-900">{g.order}</td>
                <td className="p-1 border-r border-zinc-100 dark:border-zinc-900">
                  <input
                    type="text"
                    defaultValue={g.title}
                    onBlur={e => patch(g, 'title', e.target.value.trim())}
                    placeholder="이루고 싶은 일"
                    className="w-full bg-transparent text-zinc-900 dark:text-zinc-50 font-medium outline-none focus:bg-blue-50 dark:focus:bg-blue-950/30 px-1 rounded"
                  />
                </td>
                <td className="p-1 border-r border-zinc-100 dark:border-zinc-900">
                  <input
                    type="text"
                    defaultValue={g.deadline ?? ''}
                    onBlur={e => patch(g, 'deadline', e.target.value.trim() || undefined)}
                    placeholder="-"
                    className="w-full bg-transparent outline-none focus:bg-blue-50 dark:focus:bg-blue-950/30 px-1 rounded text-center text-zinc-700 dark:text-zinc-300"
                  />
                </td>
                <td className="p-1 border-r border-zinc-100 dark:border-zinc-900">
                  <input
                    type="text"
                    defaultValue={g.action ?? ''}
                    onBlur={e => patch(g, 'action', e.target.value.trim() || undefined)}
                    placeholder="실천 내용"
                    className="w-full bg-transparent outline-none focus:bg-blue-50 dark:focus:bg-blue-950/30 px-1 rounded text-zinc-700 dark:text-zinc-300"
                  />
                </td>
                <td className="p-1 border-r border-zinc-100 dark:border-zinc-900">
                  <input
                    type="text"
                    defaultValue={g.metric ?? ''}
                    onBlur={e => patch(g, 'metric', e.target.value.trim() || undefined)}
                    placeholder="수치화"
                    className="w-full bg-transparent outline-none focus:bg-blue-50 dark:focus:bg-blue-950/30 px-1 rounded text-zinc-700 dark:text-zinc-300"
                  />
                </td>
                <td className="p-1 border-r border-zinc-100 dark:border-zinc-900">
                  <input
                    type="number"
                    defaultValue={g.target ?? ''}
                    onBlur={e => patch(g, 'target', e.target.value === '' ? undefined : Number(e.target.value))}
                    placeholder="-"
                    className="w-full bg-transparent outline-none focus:bg-blue-50 dark:focus:bg-blue-950/30 px-1 rounded text-center tabular-nums text-zinc-800 dark:text-zinc-200"
                  />
                </td>
                {g.monthlyTargets.map((val, i) => {
                  const actual = g.monthlyActuals[i];
                  return (
                    <td
                      key={i}
                      className={`p-0.5 border-r border-zinc-100 dark:border-zinc-900 ${
                        i < 6 ? 'bg-blue-50/30 dark:bg-blue-950/10' : 'bg-amber-50/30 dark:bg-amber-950/10'
                      }`}
                    >
                      <div className="flex flex-col">
                        <input
                          type="number"
                          defaultValue={val ?? ''}
                          onBlur={e => patchMonthly(g, 'monthlyTargets', i, e.target.value)}
                          placeholder="계"
                          title="월별 목표"
                          className="w-full bg-transparent outline-none focus:bg-blue-100 dark:focus:bg-blue-900/40 px-0.5 rounded text-center tabular-nums text-[11px]"
                        />
                        <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-0.5 mx-0.5"></div>
                        <input
                          type="number"
                          defaultValue={actual ?? ''}
                          onBlur={e => patchMonthly(g, 'monthlyActuals', i, e.target.value)}
                          placeholder="실"
                          title="월별 실적"
                          className="w-full bg-transparent outline-none focus:bg-emerald-100 dark:focus:bg-emerald-900/40 px-0.5 rounded text-center tabular-nums text-[11px] font-medium"
                        />
                      </div>
                    </td>
                  );
                })}
                <td className="p-1 text-center border-l border-zinc-200 dark:border-zinc-700 border-r border-zinc-100 dark:border-zinc-900">
                  {(() => {
                    if (!g.target || g.target <= 0) return <span className="text-zinc-400">-</span>;
                    const sum = g.monthlyActuals.reduce<number>((s, v) => s + (v ?? 0), 0);
                    const pct = Math.round((sum / g.target) * 100);
                    const cls = pct >= 100
                      ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                      : pct >= 50
                        ? 'text-amber-600 dark:text-amber-400 font-semibold'
                        : 'text-zinc-500';
                    return <span className={`text-xs tabular-nums ${cls}`}>{pct}%</span>;
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
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 text-[10px] text-zinc-500 bg-zinc-50 dark:bg-zinc-800/30">
        💡 각 월 셀의 위 숫자=계획(목표), 아래=실적. 달성률 = Σ실적 / 목표.
      </div>
    </section>
  );
};
