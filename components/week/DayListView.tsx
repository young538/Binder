'use client';
import { WeeklyReview } from './WeeklyReview';
import { useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  NotebookPen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useBinder } from '@/store';
import { weekDates, toIsoDate, minutesToTimeStr } from '@/lib/utils/date';
import { useWeeklyData } from './WeeklyDataProvider';
import { TimeBlock, Todo } from '@/lib/types';
import { BlockEditor } from './BlockEditor';
import { DailyRetroSheet } from './DailyRetroSheet';
import { DayTodoColumn } from './DayTodoColumn';

interface Props {
  isoweek: string;
}

const DOW = ['월', '화', '수', '목', '금', '토', '일'];

interface EditorState {
  existing?: TimeBlock;
  date: string;
  startMin: number;
  endMin: number;
  prefilledTodoId?: string;
  prefilledText?: string;
}

export const DayListView = (props: Props) => <DayListSession key={props.isoweek} {...props} />;

const DayListSession = ({ isoweek }: Props) => {
  const { categories, settings } = useBinder();
  const { blocks, todos } = useWeeklyData();

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [retroOpen, setRetroOpen] = useState(false);
  const [todoOpen, setTodoOpen] = useState(true);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  // role=button div는 모바일에서 dblclick이 오지 않으므로 수동 더블탭 처리.
  const lastTap = useRef<{ id: string; time: number } | null>(null);

  const dates = weekDates(isoweek);
  const today = toIsoDate(new Date());
  const todayIdx = dates.findIndex((d) => toIsoDate(d) === today);

  const [dayIdx, setDayIdx] = useState(() => todayIdx >= 0 ? todayIdx : 0);

  const current = dates[dayIdx];
  const dateStr = toIsoDate(current);

  const dayTodoCount = todos.filter((todo) => todo.scopeKey === dateStr).length;

  const dayBlocks = blocks
    .filter((b) => b.date === dateStr)
    .sort((a, b) => a.startMin - b.startMin);
  const catColor = (id: string) =>
    categories.find((c) => c.id === id)?.color ?? '#a1a1aa';
  const catName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? '';

  const closeEditor = () => {
    setEditor(null);
  };

  const openAdd = () => {
    const start = (settings?.dayStartHour ?? 9) * 60;
    const grid = settings?.gridMinutes ?? 30;
    setSelectedBlockId(null);
    setEditor({ date: dateStr, startMin: start, endMin: start + grid });
  };

  const openEditorForBlock = (b: TimeBlock) => {
    setSelectedBlockId(b.id);
    setEditor({
      existing: b,
      date: b.date,
      startMin: b.startMin,
      endMin: b.endMin,
    });
  };

  const openFromTodo = (todo: Todo) => {
    const start = (settings?.dayStartHour ?? 9) * 60;
    const grid = settings?.gridMinutes ?? 30;
    setSelectedBlockId(null);
    setEditor({
      date: todo.scopeKey,
      startMin: start,
      endMin: start + grid,
      prefilledTodoId: todo.id,
      prefilledText: todo.title,
    });
  };

  const handleSaved = () => {};

  return (
    <div className="md:hidden bg-zinc-50 pb-[calc(76px+env(safe-area-inset-bottom))] dark:bg-zinc-950">
      <header className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setDayIdx((i) => Math.max(0, i - 1))}
          disabled={dayIdx === 0}
          className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 text-zinc-600 dark:text-zinc-400"
          aria-label="이전 날"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <div className="font-semibold text-zinc-800 dark:text-zinc-50">
            {current.getMonth() + 1}월 {current.getDate()}일{' '}
            <span className="text-zinc-500 font-normal">({DOW[dayIdx]})</span>
          </div>
          <button
            className="mt-1 text-xs text-blue-600 dark:text-blue-400 inline-flex items-center gap-1"
            onClick={() => setRetroOpen(true)}
          >
            <NotebookPen size={12} /> 📝 일일 회고
          </button>
        </div>
        <button
          onClick={() => setDayIdx((i) => Math.min(6, i + 1))}
          disabled={dayIdx === 6}
          className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 text-zinc-600 dark:text-zinc-400"
          aria-label="다음 날"
        >
          <ChevronRight size={20} />
        </button>
      </header>

      <WeeklyReview isoweek={isoweek} />

      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setTodoOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-zinc-800 dark:text-zinc-50"
        >
          <span className="flex items-center gap-1.5">
            📝 오늘 할 일
            <span className="text-xs text-zinc-500 font-normal">
              ({dayTodoCount})
            </span>
          </span>
          <span className="text-xs text-zinc-500 flex items-center gap-0.5">
            {todoOpen ? (
              <>
                접기 <ChevronUp size={14} />
              </>
            ) : (
              <>
                펼치기 <ChevronDown size={14} />
              </>
            )}
          </span>
        </button>
        {todoOpen && (
          <div className="border-t border-zinc-200 dark:border-zinc-800 max-h-64 overflow-y-auto">
            <DayTodoColumn
              dateStr={dateStr}
              onMakeBlock={openFromTodo}
            />
          </div>
        )}
      </div>

      <ul className="p-4 space-y-2">
        {dayBlocks.length === 0 && (
          <li className="p-8 text-center text-sm text-zinc-400 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
            아직 기록이 없어요
          </li>
        )}
        {dayBlocks.map((b) => {
          const isSelected = selectedBlockId === b.id;
          return (
            <li key={b.id}>
              <div
                role="button"
                tabIndex={0}
                data-testid="day-block"
                data-block-id={b.id}
                data-selected={isSelected ? 'true' : 'false'}
                aria-label={`${b.text || '(내용 없음)'} 블록${isSelected ? ' 선택됨' : ''}`}
                aria-pressed={isSelected}
                onClick={() => {
                  const now = Date.now();
                  const prev = lastTap.current;
                  lastTap.current = { id: b.id, time: now };
                  setSelectedBlockId(b.id);
                  if (prev && prev.id === b.id && now - prev.time < 400) {
                    lastTap.current = null;
                    openEditorForBlock(b);
                  }
                }}
                onDoubleClick={() => openEditorForBlock(b)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'F2') {
                    e.preventDefault();
                    openEditorForBlock(b);
                  }
                }}
                className={`flex w-full items-stretch overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-blue-500 dark:bg-zinc-900 ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/60 dark:border-blue-400 dark:ring-blue-400/50'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div
                  className="w-1.5 self-stretch"
                  style={{ background: catColor(b.categoryId) }}
                />
                <div className="min-w-0 flex-1 p-3">
                  <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                    {b.text || '(내용 없음)'}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="tabular-nums">
                      {minutesToTimeStr(b.startMin)} – {minutesToTimeStr(b.endMin)}
                    </span>
                    {catName(b.categoryId) && (
                      <>
                        <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                        <span>{catName(b.categoryId)}</span>
                      </>
                    )}
                  </div>
                  {isSelected && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        data-testid="day-block-edit"
                        data-block-id={b.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditorForBlock(b);
                        }}
                        onDoubleClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-blue-700"
                      >
                        <Pencil size={12} /> 편집
                      </button>
                      <span className="text-[11px] text-zinc-400">
                        Enter·더블클릭으로도 편집
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div
        className="fixed left-4 right-4 z-20"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)' }}
      >
        <button
          onClick={openAdd}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-lg flex items-center justify-center gap-1.5"
        >
          <Plus size={18} /> 블록 추가
        </button>
      </div>

      {editor && (
        <BlockEditor
          initial={{
            date: editor.date,
            startMin: editor.startMin,
            endMin: editor.endMin,
          }}
          existing={editor.existing}
          prefilledTodoId={editor.prefilledTodoId}
          prefilledText={editor.prefilledText}
          onClose={closeEditor}
          onSaved={handleSaved}
        />
      )}
      {retroOpen && (
        <DailyRetroSheet date={dateStr} onClose={() => setRetroOpen(false)} />
      )}
    </div>
  );
};
