'use client';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { TimeBlock, TimeBlockKind } from '@/lib/types';
import { createTimeBlock, updateTimeBlock } from '@/lib/repo/timeBlocks';
import { TimeGridGeometry } from '@/lib/time-grid/geometry';
import { TimeBlockCommands } from '@/lib/time-grid/commands';

const BLOCK_DRAG_THRESHOLD = 4;
const blockCommands = new TimeBlockCommands({ create: createTimeBlock, update: updateTimeBlock });
interface DragState {
  pointerId: number;
  date: string;
  kind: TimeBlockKind;
  startRow: number;
  currentRow: number;
}

interface BlockDragState {
  pointerId: number;
  block: TimeBlock;
  startClientX: number;
  startClientY: number;
  targetDate: string;
  targetKind: TimeBlockKind;
  targetRow: number;
  mode: 'move' | 'copy';
  hasMoved: boolean;
}

/** Pointer lifecycle, cancellation and click suppression shared by daily and weekly grids. */
export function useTimeGridInteraction(
  geometry: TimeGridGeometry,
  onSelectSlot: (date: string, kind: TimeBlockKind, row: number) => void,
  onCreateRange: (date: string, kind: TimeBlockKind, start: number, end: number) => void,
) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [blockDrag, setBlockDrag] = useState<BlockDragState | null>(null);
  const blockDragRef = useRef<BlockDragState | null>(null);
  const suppressBlockClickId = useRef<string | null>(null);
  // 드래그 생성 직후 잔여 클릭 무시용.
  const suppressSlotClickUntil = useRef(0);

  useEffect(() => {
    const cancelDrag = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || (!drag && !blockDragRef.current)) return;
      suppressSlotClickUntil.current = Date.now() + 500;
      blockDragRef.current = null;
      setBlockDrag(null);
      setDrag(null);
    };
    const finishPointer = (event: PointerEvent) => {
      if (drag?.pointerId !== event.pointerId) return;
      const target = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
      const column = target?.closest<HTMLElement>('[data-time-column]');
      if (column?.dataset.date !== drag.date || column?.dataset.kind !== drag.kind) {
        suppressSlotClickUntil.current = Date.now() + 500;
      }
      setDrag(null);
    };
    window.addEventListener('keydown', cancelDrag);
    window.addEventListener('pointerup', finishPointer);
    window.addEventListener('pointercancel', finishPointer);
    return () => {
      window.removeEventListener('keydown', cancelDrag);
      window.removeEventListener('pointerup', finishPointer);
      window.removeEventListener('pointercancel', finishPointer);
    };
  }, [drag]);

  const resolveBlockDragTarget = (
    clientX: number,
    clientY: number,
    block: TimeBlock,
  ) => {
    const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const column = element?.closest<HTMLElement>('[data-time-column]');
    const date = column?.dataset.date;
    const kind = column?.dataset.kind as TimeBlockKind | undefined;
    if (!column || !date || (kind !== 'plan' && kind !== 'actual')) return null;

    const rect = column.getBoundingClientRect();
    return {
      date,
      kind,
      row: geometry.dragRow(clientY - rect.top, block),
    };
  };

  const commitBlockDrag = async (state: BlockDragState) => {
    const { block, targetDate, targetKind, targetRow, mode } = state;
    await blockCommands.transfer(block, {
      date: targetDate, kind: targetKind, startMin: geometry.minuteAt(targetRow),
    }, mode);

  };

  const handleColumnPointerDown = (e: ReactPointerEvent<HTMLElement>, dateStr: string, kind: TimeBlockKind) => {
    if (e.button !== 0) return;
    if (blockDrag) return;
    if (drag) return; // 멀티터치 방지: 이미 드래그 중이면 새 포인터 무시
    if ((e.target as HTMLElement).closest('[data-block]')) return;
    // Empty columns do not capture mouse pointers, so repeated
    // clicks can start a range without retargeting double-clicks.
    const rowAttr = (e.target as HTMLElement).getAttribute('data-row');
    if (rowAttr == null) return;
    const row = Number(rowAttr);
    if (Number.isNaN(row)) return;
    setDrag({ pointerId: e.pointerId, date: dateStr, kind, startRow: row, currentRow: row });
  };

  const handleColumnPointerMove = (e: ReactPointerEvent<HTMLElement>, dateStr: string, kind: TimeBlockKind) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (drag.date !== dateStr || drag.kind !== kind) return;
    // 캡처를 잡는 순간 후속 pointermove/up의 타깃이 컬럼으로 고정되어
    // elementFromPoint 좌표 추적과 click/dblclick 버블링이 깨진다.
    // 캡처 없이 elementFromPoint로 행을 추적한다.
    const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    if (target?.closest('[data-time-column]') !== e.currentTarget) return;
    // Number(null) === 0 함정: data-row 없는 요소(블록 등) 위로 이동 시 0 으로 점프하던 문제
    const rowAttr = target?.getAttribute('data-row');
    if (rowAttr == null) return;
    const row = Number(rowAttr);
    if (Number.isNaN(row)) return;
    if (row !== drag.currentRow) {
      setDrag({ ...drag, currentRow: row });
    }
  };

  const handleColumnPointerUp = (e: ReactPointerEvent<HTMLElement>, dateStr: string, kind: TimeBlockKind) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (drag.date !== dateStr || drag.kind !== kind) return;
    const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    if (target?.closest('[data-time-column]') !== e.currentTarget) {
      suppressSlotClickUntil.current = Date.now() + 500;
      setDrag(null);
      return;
    }
    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture?.(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch { /* already released */ }
    const minRow = Math.min(drag.startRow, drag.currentRow);
    const maxRow = Math.max(drag.startRow, drag.currentRow);
    const { startMin, endMin } = geometry.range(minRow, maxRow);
    const snapshot = drag;
    setDrag(null);
    // 드래그(범위 선택)는 명시적 생성 의도로 보고 즉시 편집 진입.
    if (maxRow !== minRow) {
      suppressSlotClickUntil.current = Date.now() + 500;
      onCreateRange(snapshot.date, snapshot.kind, startMin, endMin);
      return;
    }
    // 단순 탭/클릭: 선택만 하고 편집은 열지 않는다.
    // 더블클릭 진입은 onDoubleClick이 담당한다.
    onSelectSlot(dateStr, kind, minRow);
  };

  const handleColumnPointerCancel = (e: ReactPointerEvent<HTMLElement>) => {
    if (drag && drag.pointerId !== e.pointerId) return;
    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture?.(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch { /* already released */ }
    setDrag(null);
  };

  const handleBlockPointerDown = (e: ReactPointerEvent<HTMLElement>, b: TimeBlock) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (drag || blockDragRef.current) return;
    const targetRow = geometry.fitRow(Math.round(geometry.rowAt(b.startMin)), b);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch { /* pointer may already be captured */ }
    const nextDrag = {
      pointerId: e.pointerId,
      block: b,
      startClientX: e.clientX,
      startClientY: e.clientY,
      targetDate: b.date,
      targetKind: b.kind ?? 'plan',
      targetRow,
      mode: e.altKey || e.ctrlKey || e.metaKey ? 'copy' : 'move',
      hasMoved: false,
    } satisfies BlockDragState;
    blockDragRef.current = nextDrag;
    setBlockDrag(nextDrag);
  };

  const handleBlockPointerMove = (e: ReactPointerEvent<HTMLElement>, b: TimeBlock) => {
    const current = blockDragRef.current;
    if (!current || current.pointerId !== e.pointerId || current.block.id !== b.id) {
      return;
    }
    const moved =
      current.hasMoved ||
      Math.hypot(e.clientX - current.startClientX, e.clientY - current.startClientY) >=
      BLOCK_DRAG_THRESHOLD;
    const target = resolveBlockDragTarget(e.clientX, e.clientY, current.block);
    const nextDrag = {
      ...current,
      hasMoved: moved,
      mode: e.altKey || e.ctrlKey || e.metaKey ? 'copy' : 'move',
      ...(target
        ? {
          targetDate: target.date,
          targetKind: target.kind,
          targetRow: target.row,
        }
        : {}),
    } satisfies BlockDragState;
    blockDragRef.current = nextDrag;
    setBlockDrag(nextDrag);
  };

  const handleBlockPointerUp = (e: ReactPointerEvent<HTMLElement>, b: TimeBlock) => {
    const current = blockDragRef.current;
    if (!current || current.pointerId !== e.pointerId || current.block.id !== b.id) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch { /* already released */ }

    const moved =
      current.hasMoved ||
      Math.hypot(e.clientX - current.startClientX, e.clientY - current.startClientY) >=
      BLOCK_DRAG_THRESHOLD;
    const target = resolveBlockDragTarget(e.clientX, e.clientY, current.block);
    const finalState: BlockDragState = {
      ...current,
      hasMoved: moved,
      mode: e.altKey || e.ctrlKey || e.metaKey ? 'copy' : 'move',
      ...(target
        ? {
          targetDate: target.date,
          targetKind: target.kind,
          targetRow: target.row,
        }
        : {}),
    };

    blockDragRef.current = null;
    setBlockDrag(null);
    if (!moved) return;

    suppressBlockClickId.current = b.id;
    window.setTimeout(() => {
      if (suppressBlockClickId.current === b.id) {
        suppressBlockClickId.current = null;
      }
    }, 0);

    void commitBlockDrag(finalState).catch(() => {
      alert('블록을 옮기지 못했어요');
    });
  };

  const handleBlockPointerCancel = (e: ReactPointerEvent<HTMLElement>, b: TimeBlock) => {
    const current = blockDragRef.current;
    if (!current || current.pointerId !== e.pointerId || current.block.id !== b.id) {
      return;
    }
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch { /* already released */ }
    blockDragRef.current = null;
    setBlockDrag(null);
  };
  const canSelectSlot = () => Date.now() >= suppressSlotClickUntil.current;
  const canSelectBlock = (id: string) => suppressBlockClickId.current !== id;
  return { drag, blockDrag, canSelectSlot, canSelectBlock, handleColumnPointerDown, handleColumnPointerMove, handleColumnPointerUp, handleColumnPointerCancel, handleBlockPointerDown, handleBlockPointerMove, handleBlockPointerUp, handleBlockPointerCancel };
}
