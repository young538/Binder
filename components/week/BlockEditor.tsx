'use client';
import { useId } from 'react';
import { X, Trash2, Link2, Copy } from 'lucide-react';
import { minutesToTimeStr } from '@/lib/utils/date';
import { GoalPicker } from '@/components/common/GoalPicker';
import { useBlockEditor, type BlockEditorProps } from './useBlockEditor';

export const BlockEditor = (props: BlockEditorProps) => {
  const { initial, existing, onCopyToNextDay } = props;
  const titleId = useId();
  const slotLabel = existing
    ? null
    : `${initial.date} ${initial.kind === 'actual' ? '실제' : '계획'} ${minutesToTimeStr(initial.startMin)}–${minutesToTimeStr(initial.endMin)}`;
  const { text, setText, categoryId, setCategoryId, goalId, setGoalId, kind, setKind, todoId, setTodoId, startStr, setStartStr, endStr, setEndStr, dayTodos, pending, error, close, save, remove, categories } = useBlockEditor(props);
  return (
    <div
      className="fixed inset-0 bg-zinc-900/25 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={pending}
        className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id={titleId} className="text-lg font-semibold text-zinc-800 dark:text-zinc-50">
            {existing ? '블록 편집' : '블록 추가'}
          </h3>
          <button
            onClick={close}
            aria-label="닫기"
            disabled={pending}
            className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className="text-xs text-zinc-500 mb-4">
          {slotLabel ?? initial.date}
        </div>

        <fieldset disabled={pending} className="space-y-4 min-w-0 disabled:opacity-60">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
              종류
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                aria-pressed={kind === 'plan'}
                onClick={() => setKind('plan')}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition ${
                  kind === 'plan'
                    ? 'bg-blue-50 border-blue-400 text-blue-700 dark:bg-blue-950/40 dark:border-blue-600 dark:text-blue-300'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                계획
              </button>
              <button
                type="button"
                aria-pressed={kind === 'actual'}
                onClick={() => setKind('actual')}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition ${
                  kind === 'actual'
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-600 dark:text-emerald-300'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                실제
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
              시간
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                aria-label="시작"
                value={startStr}
                onChange={(e) => setStartStr(e.target.value)}
                className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 flex-1 min-w-0 text-sm bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-zinc-400 text-sm">~</span>
              <input
                type="time"
                aria-label="종료 (00:00은 자정)"
                value={endStr}
                onChange={(e) => setEndStr(e.target.value)}
                className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 flex-1 min-w-0 text-sm bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">종료 00:00은 이 날의 자정이에요.</p>
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
                const id = e.target.value || null;
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
                  {t.status === 'done' ? '✓ ' : ''}
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
        </fieldset>

        {error && <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {pending && <p role="status" className="mt-4 text-sm text-zinc-500">처리 중이에요…</p>}

        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          {existing && (
            <div className="flex items-center gap-1 mr-auto">
              <button
                onClick={remove}
                disabled={pending}
                className="flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg text-sm font-medium"
              >
                <Trash2 size={14} /> 삭제
              </button>
              {onCopyToNextDay && (
                <button
                  onClick={() => onCopyToNextDay(existing)}
                  disabled={pending}
                  className="flex items-center gap-1 px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-sm font-medium"
                >
                  <Copy size={14} /> 다음날로 복사...
                </button>
              )}
            </div>
          )}
          <button
            onClick={close}
            disabled={pending}
            className="ml-auto px-4 py-2 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            취소
          </button>
          <button
            onClick={save}
            disabled={pending}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
};
