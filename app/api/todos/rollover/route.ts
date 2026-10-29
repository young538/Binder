import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';
import { readMutation } from '@/lib/server/validation';

export const POST = authenticated(async (session, request: Request) => {
  const body = await readMutation(request, 'todoRollover', session.userId);
  if (body instanceof Response) return body;
  return Response.json(await getUserRepositories(session.userId).todos.rollover(body.date, body.ids));
});
