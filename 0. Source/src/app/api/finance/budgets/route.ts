import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';
import { isMonth, readMutation } from '@/lib/server/validation';

export const GET = authenticated(async (session, req: Request) => {
  const yyyymm = new URL(req.url).searchParams.get('yyyymm');
  if (yyyymm && !isMonth(yyyymm)) {
    return NextResponse.json({ error: 'Invalid yyyymm' }, { status: 400 });
  }
  const repositories = getUserRepositories(session.userId);
  return NextResponse.json(repositories.finance.listBudgets(yyyymm ?? undefined));
});

export const PUT = authenticated(async (session, req: Request) => {
  const body = await readMutation(req, 'financeBudgets', session.userId);
  if (body instanceof Response) return body;
  const repositories = getUserRepositories(session.userId);
  const saved = repositories.finance.upsertBudget(body);
  return NextResponse.json(saved);
});

export const DELETE = authenticated(async (session, req: Request) => {
  const id = new URL(req.url).searchParams.get('id');
  if (!id || !id.trim()) {
    return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
  }
  const repositories = getUserRepositories(session.userId);
  return NextResponse.json(repositories.finance.deleteBudget(id));
});
