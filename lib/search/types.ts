export const SEARCH_KINDS = {
  todos: '할 일', goals: '목표', annualGoals: '연간 목표', habits: '습관',
  books: '독서', focusNotes: '포커스 노트', retrospectives: '회고', timeBlocks: '시간표', categories: '카테고리',
} as const;
export type SearchKind = keyof typeof SEARCH_KINDS;
export const isSearchKind = (value: string): value is SearchKind => Object.hasOwn(SEARCH_KINDS, value);
export interface SearchResult { kind: SearchKind; id: string; title: string; excerpt: string; period: string; href: string }
export interface SearchResults { items: SearchResult[]; offset: number; hasMore: boolean }
export const SEARCH_PAGE_SIZE = 20;
