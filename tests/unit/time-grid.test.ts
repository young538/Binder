// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { TimeGridGeometry } from '@/lib/time-grid/geometry';
import { TimeBlockCommands } from '@/lib/time-grid/commands';
import type { TimeBlock } from '@/lib/types';

describe('shared time grid geometry', () => {
  it('includes both drag endpoints regardless of drag direction', () => {
    const grid = new TimeGridGeometry({ dayStartHour: 6, dayEndHour: 24, gridMinutes: 30 });
    expect(grid.totalRows).toBe(36);
    expect(grid.range(3, 1)).toEqual({ startMin: 390, endMin: 480 });
    expect(grid.range(35)).toEqual({ startMin: 1410, endMin: 1440 });
    expect(grid.blockPosition({ startMin: 390, endMin: 450 })).toEqual({ top: 33, height: 62 });
  });

  it('clamps dragging within the configured grid while keeping duration', () => {
    const grid = new TimeGridGeometry({ dayStartHour: 6, dayEndHour: 23, gridMinutes: 60 });
    const block = { startMin: 540, endMin: 660 };
    expect(grid.dragRow(-100, block)).toBe(0);
    expect(grid.dragRow(10000, block)).toBe(15);
    expect(grid.minuteAt(15) + block.endMin - block.startMin).toBe(1380);
  });
});

describe('time block commands', () => {
  const block = { id: 'b', date: '2026-10-29', startMin: 540, endMin: 600, kind: 'plan', text: '할 일', categoryId: 'c', goalId: 'g', todoId: 't' } as TimeBlock;

  it('copies with a TODO link only within the same date', async () => {
    const writer = { create: vi.fn().mockResolvedValue({}), update: vi.fn() };
    const commands = new TimeBlockCommands(writer);
    await commands.transfer(block, { date: block.date, kind: 'actual', startMin: 600 }, 'copy');
    expect(writer.create).toHaveBeenLastCalledWith(expect.objectContaining({ todoId: 't', goalId: 'g', endMin: 660 }));
    await commands.transfer(block, { date: '2026-10-30', kind: 'plan', startMin: 600 }, 'copy');
    expect(writer.create).toHaveBeenLastCalledWith(expect.objectContaining({ todoId: undefined, categoryId: 'c', text: '할 일' }));
  });

  it('skips a no-op move and preserves existing links on a cross-date move', async () => {
    const writer = { create: vi.fn(), update: vi.fn().mockResolvedValue(undefined) };
    const commands = new TimeBlockCommands(writer);
    await commands.transfer(block, { date: block.date, kind: 'plan', startMin: 540 }, 'move');
    expect(writer.update).not.toHaveBeenCalled();
    await commands.transfer(block, { date: '2026-10-30', kind: 'actual', startMin: 600 }, 'move');
    expect(writer.update).toHaveBeenCalledExactlyOnceWith('b', { date: '2026-10-30', kind: 'actual', startMin: 600, endMin: 660 });
  });
});
