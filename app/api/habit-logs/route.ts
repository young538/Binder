import { getUserRepositories } from '@/lib/server/repos';
import { readMutation } from '@/lib/server/validation';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticated } from '@/lib/server/http';


export const GET = authenticated(async (session, req: NextRequest) => {
  const repositories = getUserRepositories(session.userId);
  const sp = req.nextUrl.searchParams;
  const startDate = sp.get('startDate');
  const endDate = sp.get('endDate');
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate & endDate required' }, { status: 400 });
  }
  const rows = await repositories.habitLogs.listInRange(startDate, endDate);
  return NextResponse.json(rows);
});

export const POST = authenticated(async (session, req: Request) => {
  const repositories = getUserRepositories(session.userId);
  const body = await readMutation(req, 'habitLogs', session.userId);
  if (body instanceof Response) return body;
  const added = await repositories.habitLogs.toggle(body.habitId, body.date);
  return NextResponse.json({ added });
});
