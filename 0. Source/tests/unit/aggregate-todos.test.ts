import { describe, it, expect } from 'vitest';
import { aggregateByTodo } from '@/lib/aggregate';
import { TimeBlock } from '@/lib/types';

const USER_ID = 'test-user';

const mk = (p: Partial<TimeBlock>): TimeBlock => ({
  id: Math.random().toString(),
  userId: USER_ID,
  date: '2026-04-18',
  startMin: 540,
  endMin: 600,
  text: '',
  kind: 'plan',
  categoryId: 'c1',
  createdAt: '',
  updatedAt: '',
  ...p,
});

describe('aggregateByTodo', () => {
  it('aggregates duration per todoId, untagged under null', () => {
    const blocks = [
      mk({ todoId: 't1', startMin: 0, endMin: 60 }),
      mk({ todoId: 't1', startMin: 60, endMin: 120 }),
      mk({ todoId: 't2', startMin: 120, endMin: 180 }),
      mk({ todoId: undefined, startMin: 180, endMin: 210 }),
    ];
    const r = aggregateByTodo(blocks);
    expect(r.get('t1')).toBe(120);
    expect(r.get('t2')).toBe(60);
    expect(r.get(null)).toBe(30);
  });

  it('empty input returns empty map', () => {
    expect(aggregateByTodo([])).toEqual(new Map());
  });
});
