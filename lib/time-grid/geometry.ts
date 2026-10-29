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

  durationRows(block: Interval): number {
    return Math.max(1, Math.round((block.endMin - block.startMin) / this.gridMinutes));
  }

  fitRow(row: number, block: Interval): number {
    const maximum = Math.max(0, this.totalRows - this.durationRows(block));
    return Math.min(maximum, Math.max(0, row));
  }

  dragRow(offsetY: number, block: Interval): number {
    return this.fitRow(Math.floor(offsetY / this.rowHeight), block);
  }

  blockPosition(block: Interval): { top: number; height: number } {
    return {
      top: this.rowAt(block.startMin) * this.rowHeight + 1,
      height: (block.endMin - block.startMin) / this.gridMinutes * this.rowHeight - 2,
    };
  }
}
