import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';
import { isDate } from '@/lib/server/validation';
import { toIsoDate } from '@/lib/utils/date';

export const GET = authenticated(async (session, req: NextRequest) => {
  const date = req.nextUrl.searchParams.get('date') ?? toIsoDate(new Date());
  if (!isDate(date)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }
  const repositories = getUserRepositories(session.userId);
  return NextResponse.json(repositories.dashboard.snapshot(date as string));
});
