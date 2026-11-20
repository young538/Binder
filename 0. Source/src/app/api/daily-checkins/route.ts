import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';
import { isDate, readMutation } from '@/lib/server/validation';

export const GET = authenticated(async (session, req: NextRequest) => {
  const repositories = getUserRepositories(session.userId);
  const sp = req.nextUrl.searchParams;
  const date = sp.get('date');
  const startDate = sp.get('startDate');
  const endDate = sp.get('endDate');

  if (date) {
    if (!isDate(date)) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    return NextResponse.json(repositories.dailyCheckins.getByDate(date));
  }
  if (startDate && endDate) {
    if (!isDate(startDate) || !isDate(endDate)) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
    }
    return NextResponse.json(repositories.dailyCheckins.listInRange(startDate, endDate));
  }
  return NextResponse.json({ error: 'date or startDate & endDate required' }, { status: 400 });
});

export const PUT = authenticated(async (session, req: Request) => {
  const body = await readMutation(req, 'dailyCheckins', session.userId);
  if (body instanceof Response) return body;
  const repositories = getUserRepositories(session.userId);
  const row = repositories.dailyCheckins.upsert(body);
  return NextResponse.json(row);
});
