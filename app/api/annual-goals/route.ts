import { getUserRepositories } from '@/lib/server/repos';
import { readMutation } from '@/lib/server/validation';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticated } from '@/lib/server/http';


export const GET = authenticated(async (session, req: NextRequest) => {
  const repositories = getUserRepositories(session.userId);
  const year = req.nextUrl.searchParams.get('year');
  if (!year) {
    return NextResponse.json({ error: 'year required' }, { status: 400 });
  }
  const rows = await repositories.annualGoals.listByYear(year);
  return NextResponse.json(rows);
});

export const POST = authenticated(async (session, req: Request) => {
  const repositories = getUserRepositories(session.userId);
  const body = await readMutation(req, 'annualGoalCreate', session.userId);
  if (body instanceof Response) return body;
  if (body.ensureSeven) {
    const rows = await repositories.annualGoals.ensureSeven(body.year);
    return NextResponse.json(rows);
  }
  const row = await repositories.annualGoals.create(body.year, body.order!);
  return NextResponse.json(row, { status: 201 });
});
