import { authenticated } from '@/lib/server/http';
import { getDb } from '@/lib/server/db/client';
import { SearchRepository } from '@/lib/server/search/repository';
import { isSearchKind } from '@/lib/search/types';

export const GET = authenticated(async (session, request: Request) => {
  const params = new URL(request.url).searchParams;
  const query = (params.get('q') ?? '').trim();
  const kind = params.get('type') || undefined;
  const offset = Number(params.get('offset') ?? 0);
  if (!query || query.length > 100 || (kind && !isSearchKind(kind)) || !Number.isSafeInteger(offset) || offset < 0 || offset > 10000) {
    return Response.json({ error: '검색어는 1~100자, 검색 범위와 페이지는 올바른 값이어야 합니다.' }, { status: 400 });
  }
  const result = new SearchRepository(getDb(), session.userId).search(query, kind && isSearchKind(kind) ? kind : undefined, offset);
  return Response.json(result);
});
