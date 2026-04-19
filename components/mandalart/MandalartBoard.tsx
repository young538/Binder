'use client';
import { useEffect, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useBinder } from '@/store';
import { buildMandalartMap, CORE_RING_POSITIONS, OUTER_CENTERS, SUB_OFFSETS } from '@/lib/mandalart';
import { GoalCell } from './GoalCell';
import { createGoal, updateGoal, deleteGoal } from '@/lib/repo/goals';
import { Goal, GoalLevel } from '@/lib/types';
import { listByParentGoal as listTodosByGoal, createTodo } from '@/lib/repo/todos';
import { listHabits, createHabit } from '@/lib/repo/habits';
import { listAllRoutines, createRoutine } from '@/lib/repo/routines';
import {
  listByYear as listAnnualGoalsByYear,
  createAnnualGoal,
  updateAnnualGoal,
} from '@/lib/repo/annualGoals';

interface PendingEdit {
  row: number;
  col: number;
  goal: Goal | null;
  level: GoalLevel;
  parentId?: string;
  order: number;
}

interface ConnectedCounts {
  todos: number;
  habits: number;
  routines: number;
  annualGoals: number;
}

export const MandalartBoard = () => {
  const { goals, reload } = useBinder();
  const [edit, setEdit] = useState<PendingEdit | null>(null);
  const [title, setTitle] = useState('');
  const [connectedCounts, setConnectedCounts] = useState<ConnectedCounts>({
    todos: 0,
    habits: 0,
    routines: 0,
    annualGoals: 0,
  });
  const [allCounts, setAllCounts] = useState<Map<string, number>>(new Map());

  const map = buildMandalartMap(goals);
  const oneThing = goals.find(g => g.level === 'oneThing');

  const recomputeAllCounts = async () => {
    const year = String(new Date().getFullYear());
    const [habits, routines, ags] = await Promise.all([
      listHabits(),
      listAllRoutines(),
      listAnnualGoalsByYear(year),
    ]);
    const m = new Map<string, number>();
    const bump = (id?: string) => {
      if (!id) return;
      m.set(id, (m.get(id) ?? 0) + 1);
    };
    for (const h of habits) bump(h.parentGoalId);
    for (const r of routines) bump(r.parentGoalId);
    for (const a of ags) bump(a.parentGoalId);
    setAllCounts(m);
  };

  useEffect(() => {
    recomputeAllCounts();
  }, [goals]);

  useEffect(() => {
    if (!edit?.goal) return;
    const goalId = edit.goal.id;
    (async () => {
      const year = String(new Date().getFullYear());
      const [todos, habits, routines, ags] = await Promise.all([
        listTodosByGoal(goalId),
        listHabits().then(hs => hs.filter(h => h.parentGoalId === goalId)),
        listAllRoutines().then(rs => rs.filter(r => r.parentGoalId === goalId)),
        listAnnualGoalsByYear(year).then(as => as.filter(a => a.parentGoalId === goalId)),
      ]);
      setConnectedCounts({
        todos: todos.length,
        habits: habits.length,
        routines: routines.length,
        annualGoals: ags.length,
      });
    })();
  }, [edit?.goal?.id]);

  const classify = (r: number, c: number): Pick<PendingEdit, 'level' | 'parentId' | 'order'> | null => {
    if (r === 4 && c === 4) return { level: 'oneThing', order: 0 };

    const coreIdx = CORE_RING_POSITIONS.findIndex(([cr, cc]) => cr === r && cc === c);
    if (coreIdx >= 0) return { level: 'mandalartCore', parentId: oneThing?.id, order: coreIdx };

    const outerIdx = OUTER_CENTERS.findIndex(([cr, cc]) => cr === r && cc === c);
    if (outerIdx >= 0) return { level: 'mandalartCore', parentId: oneThing?.id, order: outerIdx };

    const outerParent = OUTER_CENTERS.findIndex(([cr, cc]) =>
      Math.abs(cr - r) <= 1 && Math.abs(cc - c) <= 1 && !(cr === r && cc === c)
    );
    if (outerParent < 0) return null;
    const [cr, cc] = OUTER_CENTERS[outerParent];
    const subIdx = SUB_OFFSETS.findIndex(([dr, dc]) => cr + dr === r && cc + dc === c);
    if (subIdx < 0) return null;

    const parentCore = goals
      .filter(g => g.level === 'mandalartCore' && g.parentId === oneThing?.id)
      .sort((a, b) => a.order - b.order)[outerParent];

    return { level: 'mandalartSub', parentId: parentCore?.id, order: subIdx };
  };

  const open = (r: number, c: number) => {
    const meta = classify(r, c);
    if (!meta) return;
    if (meta.level !== 'oneThing' && !meta.parentId) {
      alert('먼저 상위 목표를 입력해야 합니다.');
      return;
    }
    setEdit({ row: r, col: c, goal: map[r][c], ...meta });
    setTitle(map[r][c]?.title ?? '');
  };

  const save = async () => {
    if (!edit) return;
    if (!title.trim()) { setEdit(null); return; }
    if (edit.goal) {
      await updateGoal(edit.goal.id, { title });
    } else {
      await createGoal({ title, level: edit.level, parentId: edit.parentId, order: edit.order });
    }
    await reload();
    setEdit(null);
  };

  const remove = async () => {
    if (!edit?.goal) return;
    if (!confirm('삭제할까요? 하위 목표도 함께 삭제돼요.')) return;
    const toDelete = [edit.goal.id];
    const collectChildren = (id: string) => {
      goals.filter(g => g.parentId === id).forEach(g => {
        toDelete.push(g.id);
        collectChildren(g.id);
      });
    };
    collectChildren(edit.goal.id);
    for (const id of toDelete) await deleteGoal(id);
    await reload();
    setEdit(null);
  };

  const addAnnualGoalForGoal = async () => {
    if (!edit?.goal) return;
    const year = String(new Date().getFullYear());
    const existing = await listAnnualGoalsByYear(year);
    const order = existing.length > 0 ? Math.max(...existing.map(g => g.order)) + 1 : 1;
    const created = await createAnnualGoal(year, order);
    await updateAnnualGoal(created.id, {
      parentGoalId: edit.goal.id,
      title: edit.goal.title,
    });
    setConnectedCounts(c => ({ ...c, annualGoals: c.annualGoals + 1 }));
    await recomputeAllCounts();
  };

  const addHabitForGoal = async () => {
    if (!edit?.goal) return;
    const habits = await listHabits();
    await createHabit({
      name: edit.goal.title || '새 습관',
      color: edit.goal.color || '#d9ead3',
      order: habits.length,
      parentGoalId: edit.goal.id,
    });
    setConnectedCounts(c => ({ ...c, habits: c.habits + 1 }));
    await recomputeAllCounts();
  };

  const addRoutineForGoal = async () => {
    if (!edit?.goal) return;
    const routines = await listAllRoutines();
    const dayRoutines = routines.filter(r => r.dayOfWeek === 1);
    await createRoutine({
      name: edit.goal.title || '새 루틴',
      dayOfWeek: 1,
      order: dayRoutines.length,
      parentGoalId: edit.goal.id,
    });
    setConnectedCounts(c => ({ ...c, routines: c.routines + 1 }));
    await recomputeAllCounts();
  };

  const addTodoForGoal = async () => {
    if (!edit?.goal) return;
    const year = String(new Date().getFullYear());
    await createTodo({
      title: edit.goal.title || '새 할 일',
      scope: 'year',
      scopeKey: year,
      status: 'pending',
      order: 0,
      parentGoalId: edit.goal.id,
    });
    setConnectedCounts(c => ({ ...c, todos: c.todos + 1 }));
  };

  const isCenter = (r: number, c: number) => r === 4 && c === 4;
  const isCore = (r: number, c: number) =>
    CORE_RING_POSITIONS.some(([cr, cc]) => cr === r && cc === c) ||
    OUTER_CENTERS.some(([cr, cc]) => cr === r && cc === c);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 text-zinc-800 dark:text-zinc-50">🎯 만다라트</h1>
      <p className="text-sm text-zinc-500 mb-6">인생 한 문장 → 8개 핵심 목표 → 각 목표의 세부 8개</p>

      <div className="grid grid-cols-9 gap-1 p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        {map.flatMap((row, r) => row.map((cell, c) => (
          <GoalCell key={`${r}-${c}`} goal={cell}
            isCenter={isCenter(r, c)} isCore={isCore(r, c)}
            connectionCount={cell ? (allCounts.get(cell.id) ?? 0) : 0}
            onClick={() => open(r, c)} />
        )))}
      </div>

      {edit && (
        <div className="fixed inset-0 bg-zinc-900/25 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setEdit(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-wide">
                  {edit.level === 'oneThing' ? '원씽 (인생 한 문장)'
                    : edit.level === 'mandalartCore' ? '코어 목표'
                    : '서브 목표'}
                </div>
                <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-50">
                  {edit.goal ? '목표 편집' : '목표 추가'}
                </h3>
              </div>
              <button onClick={() => setEdit(null)}
                className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500">
                <X size={18} />
              </button>
            </div>

            <input value={title} autoFocus
              onChange={e => setTitle(e.target.value)}
              placeholder="목표 제목을 입력하세요"
              className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 w-full text-sm bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500" />

            {edit.goal && (
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 mt-3 space-y-1.5">
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
                  이 목표에 연결된 것들
                </div>
                <button onClick={addAnnualGoalForGoal}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-300 text-sm transition">
                  <span>🎯 연간 수치 목표 추가</span>
                  <span className="text-xs text-zinc-500 tabular-nums">현재 {connectedCounts.annualGoals}개</span>
                </button>
                <button onClick={addHabitForGoal}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-300 text-sm transition">
                  <span>🔁 습관 추가</span>
                  <span className="text-xs text-zinc-500 tabular-nums">현재 {connectedCounts.habits}개</span>
                </button>
                <button onClick={addRoutineForGoal}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:border-amber-300 text-sm transition">
                  <span>📅 주간 루틴 추가</span>
                  <span className="text-xs text-zinc-500 tabular-nums">현재 {connectedCounts.routines}개</span>
                </button>
                <button onClick={addTodoForGoal}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-300 text-sm transition">
                  <span>✅ TODO 추가</span>
                  <span className="text-xs text-zinc-500 tabular-nums">현재 {connectedCounts.todos}개</span>
                </button>
                <p className="text-[10px] text-zinc-400 pt-1">
                  추가 후 설정/해당 페이지에서 세부 정보를 편집하세요.
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              {edit.goal && (
                <button onClick={remove}
                  className="flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg text-sm font-medium mr-auto">
                  <Trash2 size={14} /> 삭제
                </button>
              )}
              <button onClick={() => setEdit(null)}
                className="ml-auto px-4 py-2 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                취소
              </button>
              <button onClick={save}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
