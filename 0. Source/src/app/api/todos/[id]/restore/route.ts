import { createGoogleTasksSyncService } from '@/lib/server/googleCalendar/tasksSyncService';
import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';

export const POST = authenticated(async (session, request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const repositories = getUserRepositories(session.userId);
  const restored = await repositories.todos.restore(id);
  if (!restored) return Response.json(null);
  const synced = await createGoogleTasksSyncService(repositories, request).pushCreatedTodo(restored);
  return Response.json(synced);
});
