import 'server-only';

// PATCH body 정리: undefined 값은 "변경 없음"으로 취급해 제거한다.
// 명시적 연결 해제는 null 로 전달한다 (JSON 을 통과하는 유일한 해제 의사).
//   { categoryId: null } → DB null 로 저장 (연결 해제)
//   { categoryId: 'x' }  → 해당 값으로 저장
//   키 생략             → 변경 없음
//
// 왜 필요한가: drizzle + better-sqlite3 조합에서 set() 에 undefined 가
// 들어가면 드라이버 바인딩 오류 또는 무시로 이어져, 연결 해제 의도가
// DB 에 반영되지 않는다. UI select 의 "없음" 옵션은 반드시 null 을 보낸다.
export const stripUndefined = <T extends object>(patch: T): Partial<T> => {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
};
