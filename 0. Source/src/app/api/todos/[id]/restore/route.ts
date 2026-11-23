import { createGoogleTasksSyncService } from '@/lib/server/googleCalendar/tasksSyncService';
import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';

export const POST = authenticated(async (session, request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const repositories = getUserRepositories(session.userId);
  const restored = await repositories.todos.restore(id);
  if (!restored) return Response.json(null);
  const cleared =
    restored.googleTaskId || restored.googleTaskListId
      ? (repositories.todos.setGoogleTaskLink(restored.id, {
          googleTaskListId: null,
          googleTaskId: null,
          googleTaskUpdatedAt: null,
        }) ?? restored)
      : restored;
  const synced = await createGoogleTasksSyncService(repositories, request).pushCreatedTodo(cleared);
  return Response.json(synced);
});
