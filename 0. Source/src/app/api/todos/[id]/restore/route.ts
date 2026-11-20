import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';

export const POST = authenticated(async (session, _request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  return Response.json(await getUserRepositories(session.userId).todos.restore(id));
});
