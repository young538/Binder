import type { Settings, TimeBlock } from '@/lib/types';

type Interval = Pick<TimeBlock, 'startMin' | 'endMin'>;

/** Immutable coordinate system shared by the daily and weekly time grids. */
export class TimeGridGeometry {
  readonly startMin: number;
  readonly endMin: number;
  readonly totalRows: number;
  readonly gridMinutes: number;

  constructor(settings: Pick<Settings, 'dayStartHour' | 'dayEndHour' | 'gridMinutes'>, readonly rowHeight = 32) {
    this.startMin = settings.dayStartHour * 60;
    this.endMin = settings.dayEndHour * 60;
    this.gridMinutes = settings.gridMinutes;
    this.totalRows = (this.endMin - this.startMin) / this.gridMinutes;
  }

  minuteAt(row: number): number {
    return this.startMin + row * this.gridMinutes;
  }

  rowAt(minute: number): number {
    return (minute - this.startMin) / this.gridMinutes;
  }

  range(firstRow: number, lastRow = firstRow): Interval {
    return {
      startMin: this.minuteAt(Math.min(firstRow, lastRow)),
      endMin: this.minuteAt(Math.max(firstRow, lastRow) + 1),
    };
  }

  dragStart(block: Interval, rowDelta: number): number {
    const duration = block.endMin - block.startMin;
    // A clipped block can still move horizontally at its original time.
    const earliest = Math.min(this.startMin, block.startMin);
    const latest = Math.max(this.endMin - duration, block.startMin);
    return Math.min(latest, Math.max(earliest, block.startMin + rowDelta * this.gridMinutes));
  }

  visiblePosition(block: Interval): { top: number; height: number } | null {
    const start = Math.max(this.startMin, block.startMin);
    const end = Math.min(this.endMin, block.endMin);
    if (end <= start) return null;
    const pixels = (end - start) / this.gridMinutes * this.rowHeight;
    const inset = pixels > 2 ? 1 : 0;
    return { top: this.rowAt(start) * this.rowHeight + inset, height: pixels - inset * 2 };
  }
}
