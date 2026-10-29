import { SearchPage } from '@/components/search/SearchPage';
import { isSearchKind } from '@/lib/search/types';

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';
  const kind = typeof params.type === 'string' && isSearchKind(params.type) ? params.type : '';
  return <SearchPage key={`${query}:${kind}`} query={query} kind={kind} />;
}
