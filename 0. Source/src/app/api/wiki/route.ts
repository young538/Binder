import { authenticated } from '@/lib/server/http';
import { WikiService } from '@/lib/server/wiki/service';

export const GET = authenticated(async (session) => {
  const index = new WikiService(session.userId, session.username).getIndex();
  return Response.json(index);
});
