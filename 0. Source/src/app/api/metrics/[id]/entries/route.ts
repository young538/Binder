import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';
import { readMutation } from '@/lib/server/validation';

export const POST = authenticated(async (session, req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const body = await readMutation(req, 'metricEntries', session.userId);
  if (body instanceof Response) return body;
  if (body.metricId !== id) {
    return NextResponse.json({ error: 'metricId mismatch' }, { status: 400 });
  }
  const repositories = getUserRepositories(session.userId);
  const entry = repositories.metrics.upsertEntry(body);
  return NextResponse.json(entry, { status: 201 });
});

export const DELETE = authenticated(async (session, req: NextRequest) => {
  const entryId = req.nextUrl.searchParams.get('entryId');
  if (!entryId) {
    return NextResponse.json({ error: 'entryId required' }, { status: 400 });
  }
  const repositories = getUserRepositories(session.userId);
  repositories.metrics.deleteEntry(entryId);
  return NextResponse.json({ ok: true });
});
