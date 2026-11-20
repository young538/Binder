import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';
import { isDate, readMutation } from '@/lib/server/validation';

export const GET = authenticated(async (session, req: NextRequest) => {
  const repositories = getUserRepositories(session.userId);
  const sp = req.nextUrl.searchParams;
  const startDate = sp.get('startDate');
  const endDate = sp.get('endDate');
  if ((startDate && !isDate(startDate)) || (endDate && !isDate(endDate))) {
    return NextResponse.json({ error: 'Invalid date filter' }, { status: 400 });
  }
  return NextResponse.json(
    repositories.lifeEvents.list(
      startDate || endDate ? { startDate: startDate ?? undefined, endDate: endDate ?? undefined } : undefined,
    ),
  );
});

export const POST = authenticated(async (session, req: Request) => {
  const body = await readMutation(req, 'lifeEvents', session.userId);
  if (body instanceof Response) return body;
  const repositories = getUserRepositories(session.userId);
  const row = repositories.lifeEvents.create(body);
  return NextResponse.json(row, { status: 201 });
});
