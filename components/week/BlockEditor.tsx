'use client';
import { useState } from 'react';
import { TimeBlock } from '@/lib/types';
import { createTimeBlock, updateTimeBlock, deleteTimeBlock } from '@/lib/repo/timeBlocks';
import { useBinder } from '@/store';
import { minutesToTimeStr, timeStrToMinutes, snapToGrid } from '@/lib/utils/date';
import { GoalPicker } from '@/components/common/GoalPicker';

interface Props {
  initial: { date: string; startMin: number; endMin: number };
  existing?: TimeBlock;
  onClose: () => void;
  onSaved: () => void;
}

export const BlockEditor = ({ initial, existing, onClose, onSaved }: Props) => {
  const { categories, settings } = useBinder();
  const [text, setText] = useState(existing?.text ?? '');
  const [categoryId, setCategoryId] = useState(
    existing?.categoryId ?? categories[0]?.id ?? '',
  );
  const [goalId, setGoalId] = useState<string | undefined>(existing?.goalId);
  const [startStr, setStartStr] = useState(
    minutesToTimeStr(existing?.startMin ?? initial.startMin),
  );
  const [endStr, setEndStr] = useState(
    minutesToTimeStr(existing?.endMin ?? initial.endMin),
  );

  const save = async () => {
    const grid = settings?.gridMinutes ?? 30;
    const startMin = snapToGrid(timeStrToMinutes(startStr), grid);
    const endMin = snapToGrid(timeStrToMinutes(endStr), grid);
    if (endMin <= startMin) {
      alert('종료가 시작보다 빨라요');
      return;
    }
    if (existing) {
      await updateTimeBlock(existing.id, { text, categoryId, goalId, startMin, endMin });
    } else {
      await createTimeBlock({
        date: initial.date,
        startMin,
        endMin,
        text,
        categoryId,
        goalId,
      });
    }
    onSaved();
    onClose();
  };

  const remove = async () => {
    if (!existing) return;
    if (!confirm('삭제할까요?')) return;
    await deleteTimeBlock(existing.id);
    onSaved();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-lg p-5 max-w-sm w-full space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold">{existing ? '블록 편집' : '블록 추가'}</h3>
        <div className="text-xs text-gray-500">{initial.date}</div>

        <div className="flex gap-2">
          <input
            type="time"
            value={startStr}
            onChange={(e) => setStartStr(e.target.value)}
            className="border rounded px-2 py-1 flex-1"
          />
          <span className="self-center">~</span>
          <input
            type="time"
            value={endStr}
            onChange={(e) => setEndStr(e.target.value)}
            className="border rounded px-2 py-1 flex-1"
          />
        </div>

        <input
          type="text"
          placeholder="내용"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          className="border rounded px-2 py-1 w-full"
        />

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="border rounded px-2 py-1 w-full"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <GoalPicker value={goalId} onChange={setGoalId} />

        <div className="flex gap-2 justify-end pt-2">
          {existing && (
            <button onClick={remove} className="text-red-600 mr-auto">
              삭제
            </button>
          )}
          <button onClick={onClose} className="px-3 py-1 rounded border">
            취소
          </button>
          <button onClick={save} className="px-3 py-1 rounded bg-blue-600 text-white">
            저장
          </button>
        </div>
      </div>
    </div>
  );
};
