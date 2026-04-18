'use client';
import { useState } from 'react';
import { useBinder } from '@/store';
import { buildMandalartMap, CORE_RING_POSITIONS, OUTER_CENTERS, SUB_OFFSETS } from '@/lib/mandalart';
import { GoalCell } from './GoalCell';
import { createGoal, updateGoal, deleteGoal } from '@/lib/repo/goals';
import { Goal, GoalLevel } from '@/lib/types';

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

  const map = buildMandalartMap(goals);
  const oneThing = goals.find(g => g.level === 'oneThing');

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

  const isCenter = (r: number, c: number) => r === 4 && c === 4;
  const isCore = (r: number, c: number) =>
    CORE_RING_POSITIONS.some(([cr, cc]) => cr === r && cc === c) ||
    OUTER_CENTERS.some(([cr, cc]) => cr === r && cc === c);

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🎯 만다라트</h1>
      <div className="grid grid-cols-9 gap-0.5">
        {map.flatMap((row, r) => row.map((cell, c) => (
          <GoalCell key={`${r}-${c}`} goal={cell}
            isCenter={isCenter(r, c)} isCore={isCore(r, c)}
            onClick={() => open(r, c)} />
        )))}
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          onClick={() => setEdit(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-lg p-5 w-full max-w-sm space-y-3"
            onClick={e => e.stopPropagation()}>
            <h3 className="font-bold">{edit.goal ? '목표 편집' : '목표 추가'} [{edit.level}]</h3>
            <input value={title} autoFocus
              onChange={e => setTitle(e.target.value)}
              className="border rounded px-2 py-1 w-full" />
            <div className="flex gap-2 justify-end">
              {edit.goal && <button onClick={remove} className="text-red-600 mr-auto">삭제</button>}
              <button onClick={() => setEdit(null)} className="px-3 py-1 border rounded">취소</button>
              <button onClick={save} className="px-3 py-1 bg-blue-600 text-white rounded">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
