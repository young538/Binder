'use client';
import { useEffect, useRef, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useBinder } from '@/store';
import { buildMandalartMap, CORE_RING_POSITIONS, OUTER_CENTERS, SUB_OFFSETS } from '@/lib/mandalart';
import { GoalCell } from './GoalCell';
import { ConnectedItemsPanel } from './ConnectedItemsPanel';
import { createGoal, updateGoal, deleteGoal } from '@/lib/repo/goals';
import { Goal, GoalLevel } from '@/lib/types';
import { listHabits } from '@/lib/repo/habits';
import { listByYear as listAnnualGoalsByYear } from '@/lib/repo/annualGoals';

interface PendingEdit {
  row: number;
  col: number;
  goal: Goal | null;
  level: GoalLevel;
  parentId?: string;
  order: number;
}

export const MandalartBoard = () => {
  const { goals, reload } = useBinder();
  const [edit, setEdit] = useState<PendingEdit | null>(null);
  const [title, setTitle] = useState('');
  const [allCounts, setAllCounts] = useState<Map<string, number>>(new Map());

  const map = buildMandalartMap(goals);
  const oneThing = goals.find(g => g.level === 'oneThing');

  const recomputeAllCounts = async () => {
    const year = String(new Date().getFullYear());
    const [habits, ags] = await Promise.all([
      listHabits(),
      listAnnualGoalsByYear(year),
    ]);
    const m = new Map<string, number>();
    const bump = (id?: string) => {
      if (!id) return;
      m.set(id, (m.get(id) ?? 0) + 1);
    };
    for (const h of habits) bump(h.parentGoalId);
    for (const a of ags) bump(a.parentGoalId);
    setAllCounts(m);
  };

  useEffect(() => {
    recomputeAllCounts();
  }, [goals]);

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

  // 키보드 단축키: ESC = 취소, Enter = 저장.
  // save 는 매 렌더 새로 만들어지므로 ref 로 latest 유지.
  const saveRef = useRef<() => void>(() => {});
  saveRef.current = save;

  useEffect(() => {
    if (!edit) return; // 모달이 떠 있을 때만 핸들러 등록
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setEdit(null);
        return;
      }
      if (e.key === 'Enter') {
        if (e.target instanceof HTMLTextAreaElement) return;
        if (e.isComposing) return;
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [edit]);

  const isCenter = (r: number, c: number) => r === 4 && c === 4;
  const isCore = (r: number, c: number) =>
    CORE_RING_POSITIONS.some(([cr, cc]) => cr === r && cc === c) ||
    OUTER_CENTERS.some(([cr, cc]) => cr === r && cc === c);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 text-zinc-800 dark:text-zinc-50">🎯 One-Thing 보드</h1>
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
              <ConnectedItemsPanel goal={edit.goal} onChange={recomputeAllCounts} />
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
