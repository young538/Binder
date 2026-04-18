import { db } from './db';
import { getSettings } from './repo/settings';
import { newId } from './utils/id';

const DEFAULT_CATEGORIES = [
  { name: '업무',      color: '#c9daf8' },
  { name: '건강/운동', color: '#d9ead3' },
  { name: '학습',      color: '#fff2cc' },
  { name: '개인',      color: '#ead1dc' },
  { name: '휴식',      color: '#fce5cd' },
  { name: '기타',      color: '#f4cccc' },
];

export const seedIfEmpty = async () => {
  const count = await db.categories.count();
  if (count === 0) {
    await db.categories.bulkPut(
      DEFAULT_CATEGORIES.map((c, i) => ({ id: newId(), order: i, ...c }))
    );
  }
  await getSettings();
};
