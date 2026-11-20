import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';
import { isDate, readMutation } from '@/lib/server/validation';

export const GET = authenticated(async (session, req: NextRequest) => {
  const date = req.nextUrl.searchParams.get('date');
  if (!isDate(date)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }
  const repositories = getUserRepositories(session.userId);
  return NextResponse.json(repositories.eveningShutdown.snapshot(date as string));
});

export const POST = authenticated(async (session, req: Request) => {
  const body = await readMutation(req, 'eveningShutdownApply', session.userId);
  if (body instanceof Response) return body;
  const repositories = getUserRepositories(session.userId);
  return NextResponse.json(repositories.eveningShutdown.apply(body));
});
