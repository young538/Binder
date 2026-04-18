import { describe, it, expect } from 'vitest';
import { aggregateByCategory, aggregateByGoal, aggregateByDay } from '@/lib/aggregate';
import { TimeBlock } from '@/lib/types';

const mk = (p: Partial<TimeBlock>): TimeBlock => ({
  id: Math.random().toString(),
  date: '2026-04-18',
  startMin: 540,
  endMin: 600,
  text: '',
  categoryId: 'c1',
  createdAt: '',
  updatedAt: '',
  ...p,
});

describe('aggregate', () => {
  it('returns empty map for no blocks', () => {
    expect(aggregateByCategory([])).toEqual(new Map());
    expect(aggregateByGoal([])).toEqual(new Map());
    expect(aggregateByDay([])).toEqual(new Map());
  });

  it('sums minutes by category', () => {
    const blocks = [
      mk({ categoryId: 'c1', startMin: 540, endMin: 600 }),
      mk({ categoryId: 'c1', startMin: 600, endMin: 720 }),
      mk({ categoryId: 'c2', startMin: 720, endMin: 780 }),
    ];
    const result = aggregateByCategory(blocks);
    expect(result.get('c1')).toBe(180);
    expect(result.get('c2')).toBe(60);
  });

  it('buckets untagged blocks into null key', () => {
    const blocks = [
      mk({ goalId: 'g1', startMin: 0, endMin: 60 }),
      mk({ goalId: undefined, startMin: 60, endMin: 180 }),
    ];
    const result = aggregateByGoal(blocks);
    expect(result.get('g1')).toBe(60);
    expect(result.get(null)).toBe(120);
  });

  it('aggregates by date', () => {
    const blocks = [
      mk({ date: '2026-04-13', startMin: 0, endMin: 60 }),
      mk({ date: '2026-04-13', startMin: 60, endMin: 120 }),
      mk({ date: '2026-04-14', startMin: 0, endMin: 30 }),
    ];
    const result = aggregateByDay(blocks);
    expect(result.get('2026-04-13')).toBe(120);
    expect(result.get('2026-04-14')).toBe(30);
  });
});
