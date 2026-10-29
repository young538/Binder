import { getUserRepositories } from '@/lib/server/repos';
import { readMutation } from '@/lib/server/validation';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticated } from '@/lib/server/http';

import type { TodoScope } from '@/lib/types';

export const GET = authenticated(async (session, req: NextRequest) => {
  const repositories = getUserRepositories(session.userId);
  const sp = req.nextUrl.searchParams;
  const startDate = sp.get('startDate');
  const endDate = sp.get('endDate');
  if (startDate && endDate) {
    const rows = await repositories.todos.listDaysInRange(startDate, endDate);
    return NextResponse.json(rows);
  }
  const scope = sp.get('scope') as TodoScope | null;
  const scopeKey = sp.get('scopeKey');
  const parentGoalId = sp.get('parentGoalId');
  const rows = await repositories.todos.list({
    scope: scope ?? undefined,
    scopeKey: scopeKey ?? undefined,
    parentGoalId: parentGoalId ?? undefined,
  });
  return NextResponse.json(rows);
});

export const POST = authenticated(async (session, req: Request) => {
  const repositories = getUserRepositories(session.userId);
  const body = await readMutation(req, 'todos', session.userId);
  if (body instanceof Response) return body;
  const row = await repositories.todos.create(body);
  return NextResponse.json(row, { status: 201 });
});
