'use client';
import { Fragment, useState, type ReactNode } from 'react';
import { NotebookPen, Pencil, Plus } from 'lucide-react';
import { useBinder } from '@/store';
import { toIsoDate, minutesToTimeStr, WEEKDAYS_KO } from '@/lib/utils/date';
import { TimeBlock, TimeBlockKind, Todo } from '@/lib/types';
import { addDays } from 'date-fns';
import { BlockEditor } from '@/components/week/BlockEditor';
import { DailyRetroSheet } from '@/components/week/DailyRetroSheet';
import { tint } from '@/lib/utils/color';
import { TimeGridGeometry } from '@/lib/time-grid/geometry';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { useTimeGridInteraction } from './useTimeGridInteraction';

interface Props {
  dates: Date[];
  blocks: TimeBlock[];
  beforeGrid?: (onMakeBlock: (todo: Todo) => void) => ReactNode;
}

const ROW_HEIGHT = 32; // px per grid row

interface EditorState {
  date: string;
  startMin: number;
  endMin: number;
  kind: TimeBlockKind;
  existing?: TimeBlock;
  prefilledTodoId?: string;
  prefilledText?: string;
  categoryId?: string | null;
  goalId?: string | null;
}

const addDaysToIsoDate = (date: string, amount: number) => {
  const [year, month, day] = date.split('-').map(Number);
  return toIsoDate(addDays(new Date(year, month - 1, day), amount));
};

export const TimeGrid = ({ dates, blocks, beforeGrid }: Props) => {
  const { categories, settings } = useBinder();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [retroDate, setRetroDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{
    date: string;
    kind: TimeBlockKind;
    row: number;
  } | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const today = toIsoDate(new Date());

  const { gridMinutes } = settings ?? DEFAULT_SETTINGS;
  const geometry = new TimeGridGeometry(settings ?? DEFAULT_SETTINGS, ROW_HEIGHT);
  const interaction = useTimeGridInteraction(geometry,
    (date, kind, row) => { setSelectedBlockId(null); setSelectedSlot({ date, kind, row }); },
    (date, kind, startMin, endMin) => {
      setSelectedSlot(null); setSelectedBlockId(null); setEditor({ date, kind, startMin, endMin });
    },
  );
  const { drag, blockDrag } = interaction;
  if (!settings) return null;
  const { totalRows } = geometry;

  const selectedSlotTime = selectedSlot ? geometry.range(selectedSlot.row) : null;
  const selectedBlock = selectedBlockId
    ? blocks.find((b) => b.id === selectedBlockId) ?? null
    : null;

  const catColor = (id: string) =>
    categories.find((c) => c.id === id)?.color ?? '#a1a1aa';

  const openEditorForSlot = (date: string, kind: TimeBlockKind, row: number) => {
    const startMin = geometry.minuteAt(row);
    // 선택 유지: 편집기가 열려도 어느 셀을 누른 건지 하이라이트가 남는다.
    // (닫기/취소 후에도 선택이 그대로 있어 이어서 작업 가능)
    setSelectedBlockId(null);
    setSelectedSlot({ date, kind, row });
    setEditor({ date, startMin, endMin: startMin + gridMinutes, kind });
  };

  const openEditorForBlock = (b: TimeBlock) => {
    setSelectedBlockId(b.id);
    setSelectedSlot(null);
    setEditor({
      date: b.date,
      startMin: b.startMin,
      endMin: b.endMin,
      kind: b.kind ?? 'plan',
      existing: b,
    });
  };

  const openFromTodo = (todo: Todo) => {
    const startMin = geometry.startMin;
    setSelectedSlot(null);
    setSelectedBlockId(null);
    setEditor({
      date: todo.scopeKey,
      startMin,
      endMin: startMin + gridMinutes,
      kind: 'plan',
      prefilledTodoId: todo.id,
      prefilledText: todo.title,
    });
  };

  const handleSaved = () => {};

  const blockDurationRows = (block: TimeBlock) =>
    geometry.durationRows(block);

  const closeEditor = () => {
    setEditor(null);
  };

  const copyBlockToNextDay = (block: TimeBlock) => {
    setEditor({
      date: addDaysToIsoDate(block.date, 1),
      startMin: block.startMin,
      endMin: block.endMin,
      kind: block.kind ?? 'plan',
      prefilledText: block.text,
      categoryId: block.categoryId,
      goalId: block.goalId,
    });
  };

  return (
    <div>
      {beforeGrid?.(openFromTodo)}

      {/* 2-column-per-day grid: each day is split into 계획 (plan) | 실제 (actual). */}
      {(selectedSlot || selectedBlock) && (
        <div
          data-testid="week-selection-bar"
          className="sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-blue-200 bg-blue-50/95 px-5 py-2 text-xs text-blue-900 backdrop-blur dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-100"
        >
          <span className="font-medium">
            {selectedBlock
              ? `선택: ${selectedBlock.text || '(내용 없음)'} · ${minutesToTimeStr(selectedBlock.startMin)}–${minutesToTimeStr(selectedBlock.endMin)}`
              : selectedSlot && selectedSlotTime
                ? `선택: ${selectedSlot.date} ${selectedSlot.kind === 'plan' ? '계획' : '실제'} ${minutesToTimeStr(selectedSlotTime.startMin)}–${minutesToTimeStr(selectedSlotTime.endMin)}`
                : ''}
          </span>
          <span className="text-blue-700/70 dark:text-blue-200/70">
            Enter로 편집 · 더블클릭으로도 편집
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              data-testid="week-selection-edit"
              onClick={() => {
                if (selectedBlock) {
                  openEditorForBlock(selectedBlock);
                  return;
                }
                if (selectedSlot) openEditorForSlot(selectedSlot.date, selectedSlot.kind, selectedSlot.row);
              }}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 font-semibold text-white transition hover:bg-blue-700"
            >
              <Pencil size={12} /> 편집
            </button>
            <button
              type="button"
              data-testid="week-selection-new"
              onClick={() => {
                if (selectedSlot) openEditorForSlot(selectedSlot.date, selectedSlot.kind, selectedSlot.row);
              }}
              disabled={!selectedSlot}
              title={selectedSlot ? '선택한 빈 슬롯에 블록 추가' : '빈 슬롯을 먼저 선택하세요'}
              className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-white px-2.5 py-1 font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-blue-800 dark:bg-zinc-950 dark:text-blue-200 dark:hover:bg-blue-950/60"
            >
              <Plus size={12} /> 새로 만들기
            </button>
          </span>
        </div>
      )}
      <div
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== 'F2') return;
          const target = e.target as HTMLElement | null;
          if (
            target &&
            (target.tagName === 'INPUT' ||
              target.tagName === 'TEXTAREA' ||
              target.tagName === 'SELECT' ||
              target.isContentEditable)
          ) {
            return;
          }
          if (selectedBlock) {
            e.preventDefault();
            openEditorForBlock(selectedBlock);
            return;
          }
          if (selectedSlot) {
            e.preventDefault();
            openEditorForSlot(selectedSlot.date, selectedSlot.kind, selectedSlot.row);
          }
        }}
        className="grid overflow-x-auto"
        style={{ gridTemplateColumns: `60px repeat(${dates.length * 2}, minmax(60px, 1fr))` }}
      >
        {/* Row 1: date header — spans 2 sub-cols */}
        <div className="bg-white dark:bg-zinc-950" style={{ gridColumn: 1, gridRow: 1 }}></div>
        {dates.map((d, i) => {
          const dateStr = toIsoDate(d);
          const isToday = dateStr === today;
          return (
            <div
              key={`h1-${i}`}
              className={`relative border-b border-zinc-200 dark:border-zinc-800 py-2 px-2 text-center
                ${isToday
                  ? 'bg-zinc-50 dark:bg-zinc-900/30'
                  : 'bg-white dark:bg-zinc-950'}
              `}
              style={{ gridColumn: `${i * 2 + 2} / span 2`, gridRow: 1 }}
            >
              <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                <span className="text-zinc-500 dark:text-zinc-400 mr-1">{WEEKDAYS_KO[(d.getDay() + 6) % 7]}</span>
                {d.getMonth() + 1}/{d.getDate()}
              </div>
              <button
                onClick={() => setRetroDate(dateStr)}
                title="회고"
                className="absolute top-1 right-1 p-1 rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <NotebookPen size={12} />
              </button>
            </div>
          );
        })}

        {/* Row 2: 계획 / 실제 sub-header */}
        <div style={{ gridColumn: 1, gridRow: 2 }}></div>
        {dates.map((_, i) => (
          <Fragment key={`h2-${i}`}>
            <div
              className="text-center text-[11px] py-1 text-zinc-500 dark:text-zinc-500 font-medium border-b border-zinc-100 dark:border-zinc-900"
              style={{ gridColumn: i * 2 + 2, gridRow: 2 }}
            >
              계획
            </div>
            <div
              className="text-center text-[11px] py-1 text-zinc-500 dark:text-zinc-500 font-medium border-b border-zinc-100 dark:border-zinc-900"
              style={{ gridColumn: i * 2 + 3, gridRow: 2 }}
            >
              실제
            </div>
          </Fragment>
        ))}

        {/* Time labels column (starts at row 3) */}
        {Array.from({ length: totalRows }).map((_, row) => {
          const startMin = geometry.minuteAt(row);
          const isHourMark = startMin % 60 === 0;
          return (
            <div
              key={`t-${row}`}
              className={`text-[11px] tabular-nums pr-2 text-right text-zinc-500 dark:text-zinc-500 border-r border-zinc-100 dark:border-zinc-900 ${
                isHourMark ? 'border-t border-zinc-200 dark:border-zinc-800' : 'border-t border-zinc-100/60 dark:border-zinc-900/40'
              }`}
              style={{ gridColumn: 1, gridRow: row + 3, height: ROW_HEIGHT }}
            >
              {isHourMark ? minutesToTimeStr(startMin) : ''}
            </div>
          );
        })}

        {/* Sub-columns for each day × {plan, actual} */}
        {dates.map((d, col) => {
          const dateStr = toIsoDate(d);
          const isToday = dateStr === today;
          const subCols: { kind: TimeBlockKind; gridColumn: number }[] = [
            { kind: 'plan', gridColumn: col * 2 + 2 },
            { kind: 'actual', gridColumn: col * 2 + 3 },
          ];
          return subCols.map(({ kind, gridColumn }) => {
            const subBlocks = blocks.filter(b => b.date === dateStr && (b.kind ?? 'plan') === kind);
            return (
              <div
                key={`col-${col}-${kind}`}
                data-time-column="true"
                data-date={dateStr}
                data-kind={kind}
                data-day-index={col}
                className={`relative touch-none select-none
                  ${isToday ? 'bg-zinc-50 dark:bg-zinc-900/30' : ''}
                  ${kind === 'plan'
                    ? 'border-r border-zinc-100/70 dark:border-zinc-900'
                    : 'border-r border-zinc-200 dark:border-zinc-800'}
                `}
                style={{ gridColumn, gridRow: `3 / span ${totalRows}` }}
                onPointerDown={e => interaction.handleColumnPointerDown(e, dateStr, kind)}
                onPointerMove={e => interaction.handleColumnPointerMove(e, dateStr, kind)}
                onPointerUp={e => interaction.handleColumnPointerUp(e, dateStr, kind)}
                onPointerCancel={e => interaction.handleColumnPointerCancel(e)}
              >
                {Array.from({ length: totalRows }).map((_, row) => {
                  const startMin = geometry.minuteAt(row);
                  const isHourMark = startMin % 60 === 0;
                  const isSelected =
                    selectedSlot?.date === dateStr &&
                    selectedSlot?.kind === kind &&
                    selectedSlot?.row === row;
                  return (
                    <div
                      key={row}
                      data-testid="time-slot"
                      data-row={row}
                      data-date={dateStr}
                      data-kind={kind}
                      data-day-index={col}
                      data-selected={isSelected ? 'true' : 'false'}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      aria-label={`${dateStr} ${kind === 'plan' ? '계획' : '실제'} ${minutesToTimeStr(startMin)} 슬롯${isSelected ? ' 선택됨' : ''}`}
                      className={`block w-full transition cursor-cell
                        ${drag || blockDrag ? '' : 'hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40'}
                        ${isHourMark ? 'border-t border-zinc-200 dark:border-zinc-800' : ''}
                        ${
                          isSelected
                            ? 'bg-blue-100/70 ring-2 ring-inset ring-blue-500 dark:bg-blue-950/50 dark:ring-blue-400'
                            : ''
                        }
                      `}
                      style={{ height: ROW_HEIGHT }}
                      onClick={() => {
                        if (!interaction.canSelectSlot()) return;
                        setSelectedBlockId(null);
                        setSelectedSlot({ date: dateStr, kind, row });
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (!interaction.canSelectSlot()) return;
                        openEditorForSlot(dateStr, kind, row);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'F2') {
                          // 그리드 레벨 핸들러와 중복 실행 방지: 여기서 직접 처리.
                          e.preventDefault();
                          e.stopPropagation();
                          openEditorForSlot(dateStr, kind, row);
                        }
                      }}
                    />
                  );
                })}

                {drag && drag.date === dateStr && drag.kind === kind && (() => {
                  const minRow = Math.min(drag.startRow, drag.currentRow);
                  const maxRow = Math.max(drag.startRow, drag.currentRow);
                  return (
                    <div
                      aria-hidden
                      className="absolute left-0 right-0 pointer-events-none rounded-md outline outline-2 outline-dashed outline-blue-400 bg-blue-100/50 dark:bg-blue-900/30"
                      style={{
                        top: minRow * ROW_HEIGHT,
                        height: (maxRow - minRow + 1) * ROW_HEIGHT,
                      }}
                    />
                  );
                })()}

                {blockDrag && blockDrag.targetDate === dateStr && blockDrag.targetKind === kind && (() => {
                  const heightRows = blockDurationRows(blockDrag.block);
                  return (
                    <div
                      aria-hidden
                      className={`absolute left-0.5 right-0.5 pointer-events-none rounded-md border-2 border-dashed ${
                        blockDrag.mode === 'copy'
                          ? 'border-emerald-500 bg-emerald-100/60 dark:bg-emerald-900/30'
                          : 'border-blue-500 bg-blue-100/60 dark:bg-blue-900/30'
                      }`}
                      style={{
                        top: blockDrag.targetRow * ROW_HEIGHT + 1,
                        height: heightRows * ROW_HEIGHT - 2,
                      }}
                    />
                  );
                })()}

                {subBlocks.map((b) => {
                  const spanRows = (b.endMin - b.startMin) / gridMinutes;
                  const color = catColor(b.categoryId);
                  const isPlan = (b.kind ?? 'plan') === 'plan';
                  const isDraggingThis = blockDrag?.block.id === b.id && blockDrag.hasMoved;
                  const isSelected = selectedBlockId === b.id;
                  return (
                    <button
                      key={b.id}
                      data-block="true"
                      data-testid="time-block"
                      data-block-id={b.id}
                      data-selected={isSelected ? 'true' : 'false'}
                      aria-label={`${b.text || '(내용 없음)'} 블록${isSelected ? ' 선택됨' : ''}`}
                      aria-pressed={isSelected}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!interaction.canSelectSlot()) return;
                        if (!interaction.canSelectBlock(b.id)) return;
                        setSelectedSlot(null);
                        setSelectedBlockId(b.id);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (!interaction.canSelectSlot()) return;
                        if (!interaction.canSelectBlock(b.id)) return;
                        openEditorForBlock(b);
                      }}
                      onPointerDown={e => interaction.handleBlockPointerDown(e, b)}
                      onPointerMove={e => interaction.handleBlockPointerMove(e, b)}
                      onPointerUp={e => interaction.handleBlockPointerUp(e, b)}
                      onPointerCancel={e => interaction.handleBlockPointerCancel(e, b)}
                      className={`absolute left-0.5 right-0.5 rounded-md text-left overflow-hidden transition
                        cursor-grab active:cursor-grabbing touch-none focus-visible:outline-2 focus-visible:outline-blue-500
                        ${isDraggingThis ? 'opacity-45' : ''}
                        ${
                          isSelected
                            ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-white dark:ring-blue-400 dark:ring-offset-zinc-950'
                            : ''
                        }
                        ${isPlan
                          ? 'border-2 border-dashed hover:shadow-sm'
                          : 'border-2 border-solid shadow-sm hover:shadow-md'}
                      `}
                      style={{
                        ...geometry.blockPosition(b),
                        background: tint.soft(color, isPlan ? 0.10 : 0.24),
                        borderColor: tint.bar(color),
                        borderLeftWidth: 3,
                        borderLeftStyle: 'solid',
                        borderLeftColor: tint.bar(color),
                      }}
                      title={b.text}
                    >
                      <div className="px-1.5 py-1">
                        <div className="text-[12px] font-semibold leading-tight text-zinc-800 dark:text-zinc-100 truncate">
                          {b.text || '(내용 없음)'}
                        </div>
                        {spanRows >= 2 && (
                          <div className="text-[10px] text-zinc-600 dark:text-zinc-400 mt-0.5 truncate">
                            {minutesToTimeStr(b.startMin)}–{minutesToTimeStr(b.endMin)}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          });
        })}
      </div>

      {editor && (
        <BlockEditor
          key={`${editor.existing?.id ?? 'new'}-${editor.date}-${editor.startMin}-${editor.endMin}-${editor.kind}-${editor.prefilledText ?? ''}`}
          initial={{
            date: editor.date,
            startMin: editor.startMin,
            endMin: editor.endMin,
            kind: editor.kind,
            text: editor.prefilledText,
            categoryId: editor.categoryId,
            goalId: editor.goalId,
            todoId: editor.prefilledTodoId,
          }}
          existing={editor.existing}
          prefilledTodoId={editor.prefilledTodoId}
          prefilledText={editor.prefilledText}
          onClose={closeEditor}
          onSaved={handleSaved}
          onCopyToNextDay={copyBlockToNextDay}
        />
      )}

      {retroDate && (
        <DailyRetroSheet date={retroDate} onClose={() => setRetroDate(null)} />
      )}
    </div>
  );
};
