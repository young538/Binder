import { getUserRepositories } from '@/lib/server/repos';
import { readMutation } from '@/lib/server/validation';
import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/server/http';


export const GET = authenticated(async (session) => {
  const repositories = getUserRepositories(session.userId);
  const rows = await repositories.habits.list();
  return NextResponse.json(rows);
});

export const POST = authenticated(async (session, req: Request) => {
  const repositories = getUserRepositories(session.userId);
  const body = await readMutation(req, 'habits', session.userId);
  if (body instanceof Response) return body;
  const row = await repositories.habits.create(body);
  return NextResponse.json(row, { status: 201 });
});
