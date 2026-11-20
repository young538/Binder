import { describe, it, expect } from 'vitest';
import { buildMandalartMap } from '@/lib/mandalart';
import { Goal } from '@/lib/types';

const USER_ID = 'test-user';

const mk = (id: string, level: Goal['level'], parentId?: string, order = 0, title = id): Goal => ({
  id, userId: USER_ID, title, level, parentId, order, createdAt: '', updatedAt: '',
});

describe('buildMandalartMap', () => {
  it('returns 9x9 grid', () => {
    const map = buildMandalartMap([]);
    expect(map.length).toBe(9);
    expect(map[0].length).toBe(9);
  });

  it('places oneThing at center (4,4)', () => {
    const goals = [mk('one', 'oneThing')];
    const map = buildMandalartMap(goals);
    expect(map[4][4]?.id).toBe('one');
  });

  it('places 8 cores around oneThing in center 3x3', () => {
    const goals = [
      mk('one', 'oneThing'),
      ...Array.from({ length: 8 }, (_, i) => mk(`core${i}`, 'mandalartCore', 'one', i)),
    ];
    const map = buildMandalartMap(goals);
    const centerRing = [[3,3],[3,4],[3,5],[4,3],[4,5],[5,3],[5,4],[5,5]];
    const placedCoreIds = centerRing.map(([r, c]) => map[r][c]?.id).filter(Boolean);
    expect(placedCoreIds.sort()).toEqual(
      Array.from({ length: 8 }, (_, i) => `core${i}`).sort()
    );
  });

  it('places core mirrors at outer block centers', () => {
    const goals = [
      mk('one', 'oneThing'),
      ...Array.from({ length: 8 }, (_, i) => mk(`core${i}`, 'mandalartCore', 'one', i)),
    ];
    const map = buildMandalartMap(goals);
    const outerCenters: [number, number][] = [[1,1],[1,4],[1,7],[4,1],[4,7],[7,1],[7,4],[7,7]];
    outerCenters.forEach(([r, c], i) => {
      expect(map[r][c]?.id).toBe(`core${i}`);
    });
  });

  it('places subs around outer core center', () => {
    const goals = [
      mk('one', 'oneThing'),
      mk('core0', 'mandalartCore', 'one', 0),
      ...Array.from({ length: 8 }, (_, i) => mk(`sub${i}`, 'mandalartSub', 'core0', i)),
    ];
    const map = buildMandalartMap(goals);
    // Outer block (0,0) center = (1,1). Subs at offsets [-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]
    // Row 0: cols 0, 1, 2 = sub0, sub1, sub2
    expect(map[0][0]?.id).toBe('sub0');
    expect(map[0][1]?.id).toBe('sub1');
    expect(map[0][2]?.id).toBe('sub2');
    expect(map[1][0]?.id).toBe('sub3');
    expect(map[1][2]?.id).toBe('sub4');
    expect(map[2][0]?.id).toBe('sub5');
    expect(map[2][1]?.id).toBe('sub6');
    expect(map[2][2]?.id).toBe('sub7');
  });
});
