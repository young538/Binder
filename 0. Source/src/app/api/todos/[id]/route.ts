import { createGoogleTasksSyncService } from '@/lib/server/googleCalendar/tasksSyncService';
import { getUserRepositories } from '@/lib/server/repos';
import { readMutation } from '@/lib/server/validation';
import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/server/http';


export const PATCH = authenticated(async (session, req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const repositories = getUserRepositories(session.userId);
  const { id } = await ctx.params;
  const patch = await readMutation(req, 'todos', session.userId, true, id);
  if (patch instanceof Response) return patch;
  const updated = await repositories.todos.update(id, patch);
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const row = await createGoogleTasksSyncService(repositories, req).pushUpdatedTodo(updated);
  return NextResponse.json(row);
});

export const DELETE = authenticated(async (session, req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const repositories = getUserRepositories(session.userId);
  const { id } = await ctx.params;
  const existing = repositories.todos.getById(id);
  const result = await repositories.todos.delete(id);
  if (existing) {
    await createGoogleTasksSyncService(repositories, req).pushDeletedTodo(existing);
  }
  return NextResponse.json(result);
});
