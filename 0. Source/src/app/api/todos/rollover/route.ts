import { createGoogleTasksSyncService } from '@/lib/server/googleCalendar/tasksSyncService';
import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';
import { readMutation } from '@/lib/server/validation';

export const POST = authenticated(async (session, request: Request) => {
  const body = await readMutation(request, 'todoRollover', session.userId);
  if (body instanceof Response) return body;
  const repositories = getUserRepositories(session.userId);
  const result = await repositories.todos.rollover(body.date, body.ids);
  const tasksSync = createGoogleTasksSyncService(repositories, request);
  for (const movedId of body.ids) {
    const row = repositories.todos.getById(movedId);
    if (row && row.scope === 'day' && row.scopeKey === result.date) {
      await tasksSync.pushUpdatedTodo(row);
    }
  }
  return Response.json(result);
});
