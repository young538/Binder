import { createGoogleTasksSyncService } from '@/lib/server/googleCalendar/tasksSyncService';
import { getUserRepositories } from '@/lib/server/repos';
import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/server/http';

export const POST = authenticated(async (session, req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const repositories = getUserRepositories(session.userId);
  const { id } = await ctx.params;
  const row = await repositories.todos.toggleDone(id);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const synced = await createGoogleTasksSyncService(repositories, req).pushUpdatedTodo(row);
  return NextResponse.json(synced);
});
