import { authenticated } from '@/lib/server/http';
import { WikiService } from '@/lib/server/wiki/service';

export const GET = authenticated(async (session, request: Request) => {
  const relPath = new URL(request.url).searchParams.get('path') ?? '';
  const detail = new WikiService(session.userId, session.username).getPage(relPath);
  return Response.json(detail);
});
