import { getUserRepositories } from '@/lib/server/repos';
import { readMutation } from '@/lib/server/validation';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticated } from '@/lib/server/http';


export const GET = authenticated(async (session, req: NextRequest) => {
  const repositories = getUserRepositories(session.userId);
  const sp = req.nextUrl.searchParams;
  const type = sp.get('type') as 'daily' | 'weekly' | null;
  const dateOrWeek = sp.get('dateOrWeek');
  if (!type || !dateOrWeek) {
    return NextResponse.json({ error: 'type & dateOrWeek required' }, { status: 400 });
  }
  const row = await repositories.retrospectives.get(type, dateOrWeek);
  return NextResponse.json(row ?? null);
});

export const PUT = authenticated(async (session, req: Request) => {
  const repositories = getUserRepositories(session.userId);
  const body = await readMutation(req, 'retrospectives', session.userId);
  if (body instanceof Response) return body;
  const { type, dateOrWeek, ...data } = body;
  const row = await repositories.retrospectives.upsert(type, dateOrWeek, data);
  return NextResponse.json(row);
});
