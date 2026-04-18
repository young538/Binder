import { Goal } from './types';

const CORE_RING_POSITIONS: [number, number][] = [
  [3, 3], [3, 4], [3, 5],
  [4, 3],         [4, 5],
  [5, 3], [5, 4], [5, 5],
];

const OUTER_CENTERS: [number, number][] = [
  [1, 1], [1, 4], [1, 7],
  [4, 1],         [4, 7],
  [7, 1], [7, 4], [7, 7],
];

const SUB_OFFSETS: [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

export const buildMandalartMap = (goals: Goal[]): (Goal | null)[][] => {
  const grid: (Goal | null)[][] = Array.from({ length: 9 }, () => Array(9).fill(null));

  const oneThing = goals.find(g => g.level === 'oneThing') ?? null;
  grid[4][4] = oneThing;

  const cores = goals
    .filter(g => g.level === 'mandalartCore' && g.parentId === oneThing?.id)
    .sort((a, b) => a.order - b.order);

  cores.forEach((core, idx) => {
    if (idx < CORE_RING_POSITIONS.length) {
      const [r, c] = CORE_RING_POSITIONS[idx];
      grid[r][c] = core;
    }
    if (idx < OUTER_CENTERS.length) {
      const [cr, cc] = OUTER_CENTERS[idx];
      grid[cr][cc] = core;

      const subs = goals
        .filter(g => g.level === 'mandalartSub' && g.parentId === core.id)
        .sort((a, b) => a.order - b.order);

      subs.forEach((sub, i) => {
        if (i < SUB_OFFSETS.length) {
          const [dr, dc] = SUB_OFFSETS[i];
          grid[cr + dr][cc + dc] = sub;
        }
      });
    }
  });

  return grid;
};

export { CORE_RING_POSITIONS, OUTER_CENTERS, SUB_OFFSETS };
