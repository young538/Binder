import { db } from './db';
import { getSettings } from './repo/settings';
import { newId } from './utils/id';

// 기본 카테고리 = 원본 3P 바인더 컬러(예시).html 정의 그대로
const DEFAULT_CATEGORIES = [
  { name: '주원씽', color: '#f4cccc' }, // 연빨강
  { name: '부원씽', color: '#fce5cd' }, // 연주황 — 예: 부동산 손품/임장/공부
  { name: '강의',   color: '#fff2cc' }, // 연노랑 — 강의 수강, 과제
  { name: '개인',   color: '#d9ead3' }, // 연초록 — 개인정비, 이동, 식사
  { name: '성장',   color: '#c9daf8' }, // 연파랑 — 독서, 운동, 플래너
  { name: '사람',   color: '#d9d2e9' }, // 연보라 — 친구, 가족, 커뮤니티
  { name: '재미',   color: '#ead1dc' }, // 연분홍 — 블로그, 가계부
  { name: '낭비',   color: '#d9d9d9' }, // 연회색 — 인터넷쇼핑, 드라마, 유튜브
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
