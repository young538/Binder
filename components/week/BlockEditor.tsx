'use client';
import { useEffect, useState } from 'react';
import { X, Trash2, Link2 } from 'lucide-react';
import { TimeBlock, Todo } from '@/lib/types';
import {
  createTimeBlock,
  updateTimeBlock,
  deleteTimeBlock,
} from '@/lib/repo/timeBlocks';
import { listByScope } from '@/lib/repo/todos';
import { useBinder } from '@/store';
import {
  minutesToTimeStr,
  timeStrToMinutes,
  snapToGrid,
} from '@/lib/utils/date';
import { GoalPicker } from '@/components/common/GoalPicker';

interface Props {
  initial: { date: string; startMin: number; endMin: number };
  existing?: TimeBlock;
  prefilledTodoId?: string;
  prefilledText?: string;
  onClose: () => void;
  onSaved: () => void;
}

export const BlockEditor = ({
  initial,
  existing,
  prefilledTodoId,
  prefilledText,
  onClose,
  onSaved,
}: Props) => {
  const { categories, settings } = useBinder();
  const [text, setText] = useState(existing?.text ?? prefilledText ?? '');
  const [categoryId, setCategoryId] = useState(
    existing?.categoryId ?? categories[0]?.id ?? '',
  );
  const [goalId, setGoalId] = useState<string | undefined>(existing?.goalId);
  const [todoId, setTodoId] = useState<string | undefined>(
    existing?.todoId ?? prefilledTodoId,
  );
  const [startStr, setStartStr] = useState(
    minutesToTimeStr(existing?.startMin ?? initial.startMin),
  );
  const [endStr, setEndStr] = useState(
    minutesToTimeStr(existing?.endMin ?? initial.endMin),
  );
  const [dayTodos, setDayTodos] = useState<Todo[]>([]);

  useEffect(() => {
    listByScope('day', initial.date).then(setDayTodos);
  }, [initial.date]);

  const save = async () => {
    const grid = settings?.gridMinutes ?? 30;
    const startMin = snapToGrid(timeStrToMinutes(startStr), grid);
    const endMin = snapToGrid(timeStrToMinutes(endStr), grid);
    if (endMin <= startMin) {
      alert('종료가 시작보다 빨라요');
      return;
    }
    if (existing) {
      await updateTimeBlock(existing.id, {
        text,
        categoryId,
        goalId,
        todoId,
        startMin,
        endMin,
      });
    } else {
      await createTimeBlock({
        date: initial.date,
        startMin,
        endMin,
        text,
        categoryId,
        goalId,
        todoId,
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
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {existing ? '블록 편집' : '블록 추가'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className="text-xs text-zinc-500 mb-4">{initial.date}</div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
              시간
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={startStr}
                onChange={(e) => setStartStr(e.target.value)}
                className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 flex-1 text-sm bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-zinc-400 text-sm">~</span>
              <input
                type="time"
                value={endStr}
                onChange={(e) => setEndStr(e.target.value)}
                className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 flex-1 text-sm bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
              내용
            </label>
            <input
              type="text"
              placeholder="내용"
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
              className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 w-full text-sm bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
              카테고리
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const active = categoryId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCategoryId(c.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition ${
                      active
                        ? 'border-zinc-900 dark:border-white ring-1 ring-zinc-900 dark:ring-white'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: c.color }}
                    />
                    <span className="text-zinc-800 dark:text-zinc-200">{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
              TODO 연결 (이 날의 할 일)
            </label>
            <select
              value={todoId ?? ''}
              onChange={(e) => {
                const id = e.target.value || undefined;
                setTodoId(id);
                if (id && !text) {
                  const t = dayTodos.find((x) => x.id === id);
                  if (t) setText(t.title);
                }
              }}
              className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 w-full text-sm bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">(연결 없음)</option>
              {dayTodos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.done ? '✓ ' : ''}
                  {t.title || '(제목 없음)'}
                </option>
              ))}
            </select>
            {todoId && (
              <div className="flex items-center gap-1 mt-1.5 text-xs text-blue-600">
                <Link2 size={12} />
                <span>{dayTodos.find((t) => t.id === todoId)?.title ?? '...'}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
              목표 연결
            </label>
            <GoalPicker value={goalId} onChange={setGoalId} />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          {existing && (
            <button
              onClick={remove}
              className="flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg text-sm font-medium mr-auto"
            >
              <Trash2 size={14} /> 삭제
            </button>
          )}
          <button
            onClick={onClose}
            className="ml-auto px-4 py-2 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            취소
          </button>
          <button
            onClick={save}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
};
