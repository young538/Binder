import { TimeBlock } from './types';

const duration = (b: TimeBlock) => b.endMin - b.startMin;

export const aggregateByCategory = (blocks: TimeBlock[]): Map<string, number> => {
  const map = new Map<string, number>();
  for (const b of blocks) {
    map.set(b.categoryId, (map.get(b.categoryId) ?? 0) + duration(b));
  }
  return map;
};

export const aggregateByGoal = (blocks: TimeBlock[]): Map<string | null, number> => {
  const map = new Map<string | null, number>();
  for (const b of blocks) {
    const key = b.goalId ?? null;
    map.set(key, (map.get(key) ?? 0) + duration(b));
  }
  return map;
};

export const aggregateByDay = (blocks: TimeBlock[]): Map<string, number> => {
  const map = new Map<string, number>();
  for (const b of blocks) {
    map.set(b.date, (map.get(b.date) ?? 0) + duration(b));
  }
  return map;
};

export const aggregateByTodo = (blocks: TimeBlock[]): Map<string | null, number> => {
  const map = new Map<string | null, number>();
  for (const b of blocks) {
    const key = b.todoId ?? null;
    map.set(key, (map.get(key) ?? 0) + duration(b));
  }
  return map;
};
