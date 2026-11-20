'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { getGoalReview } from '@/lib/repo/insights';
import { toIsoDate } from '@/lib/utils/date';
import { todoHref } from '@/lib/todos/planning';
import { fieldClass } from '@/components/common/Dialog';
import { isDate } from '@/lib/validation/mutations';

export function GoalReviewPage() {
  const [date, setDate] = useState(() => toIsoDate(new Date()));
  const [onlyInactive, setOnlyInactive] = useState(false);
  const { value, loading, error, refresh } = useAsyncResource(`goalReview:${date}`, () => getGoalReview(date), null, ['goals', 'todos', 'habits', 'habitLogs', 'timeBlocks']);
  const goals = value?.goals.filter(row => !onlyInactive || row.inactive) ?? [];
  return <div className="mx-auto max-w-5xl space-y-5 p-4 pb-24 md:p-6">
    <header className="space-y-2"><Link href="/mandalart" className="text-sm text-blue-600">← One-Thing 보드</Link><h1 className="text-2xl font-bold">목표 실행 점검</h1><p className="text-sm leading-6 text-zinc-500">각 목표와 하위 목표의 최근 14일 실행 기록을 함께 확인하세요. 미완료 할 일은 기간에 관계없이 표시합니다.</p></header>
    <div className="flex flex-wrap items-end gap-4">
      <label className="text-sm">기준 날짜<input type="date" aria-label="목표 점검 기준 날짜" value={date} onChange={event => { if (isDate(event.target.value)) setDate(event.target.value); }} className={fieldClass} /></label>
      <label className="flex items-center gap-2 py-2 text-sm"><input type="checkbox" checked={onlyInactive} onChange={event => setOnlyInactive(event.target.checked)} />실행 기록 없는 목표만</label>
    </div>
    {loading && <p className="text-sm text-zinc-500">불러오는 중…</p>}
    {!!error && <button className="text-sm text-red-600" onClick={() => void refresh()}>점검 결과를 불러오지 못했어요. 다시 시도</button>}
    {value && <p className="text-xs text-zinc-500">집계 기간 {value.start} ~ {value.end} · 상위 목표끼리 합산하면 하위 기록이 중복될 수 있습니다.</p>}
    {value && !goals.length && <p className="rounded-xl border border-zinc-200 p-6 text-sm text-zinc-500">표시할 목표가 없습니다.</p>}
    <div className="grid gap-4 md:grid-cols-2">{goals.map(row => <section key={row.goal.id} className="min-w-0 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="break-words font-semibold">{row.goal.title}</h2>{row.inactive && <span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">14일간 실행 기록 없음</span>}</div>
      <p className="mb-2 text-xs text-zinc-500">하위 목표 {row.descendantCount}개 포함</p>
      <div className="grid grid-cols-3 gap-2 rounded-lg bg-zinc-50 p-3 text-center text-sm dark:bg-zinc-800"><div>완료<br /><strong>{row.completedTodos}개</strong></div><div>습관 체크<br /><strong>{row.habits.reduce((sum, habit) => sum + habit.checks, 0)}회</strong></div><div>실제 시간<br /><strong>{(row.actualMinutes / 60).toFixed(1)}h</strong></div></div>
      <details className="mt-3"><summary className="cursor-pointer text-sm">미완료 {row.pendingTodos.length}개 · 연결 습관 {row.habits.length}개</summary>
        <ul className="mt-3 space-y-2 text-sm">{row.pendingTodos.map(todo => <li key={todo.id}><Link className="break-words text-blue-600 hover:underline" href={todoHref(todo)}>{todo.title} <span className="text-xs text-zinc-500">{todo.scope === 'inbox' ? '수집함' : todo.scopeKey}</span></Link></li>)}</ul>
        <ul className="mt-3 space-y-2 text-sm">{row.habits.map(habit => <li key={habit.id} className="flex justify-between gap-3"><span className="break-words">{habit.name}</span><span className="shrink-0 text-zinc-500">{habit.checks}회</span></li>)}</ul>
      </details>
    </section>)}</div>
  </div>;
}
