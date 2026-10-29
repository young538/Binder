import { getUserRepositories } from '@/lib/server/repos';
import { readMutation } from '@/lib/server/validation';
import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/server/http';


export const PATCH = authenticated(async (session, req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const repositories = getUserRepositories(session.userId);
  const { id } = await ctx.params;
  const patch = await readMutation(req, 'books', session.userId, true, id);
  if (patch instanceof Response) return patch;
  const row = await repositories.books.update(id, patch);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
});

export const DELETE = authenticated(async (session, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const repositories = getUserRepositories(session.userId);
  const { id } = await ctx.params;
  await repositories.books.delete(id);
  return NextResponse.json({ ok: true });
});
