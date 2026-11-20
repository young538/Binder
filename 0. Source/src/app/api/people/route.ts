import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';
import { readMutation } from '@/lib/server/validation';

export const GET = authenticated(async (session) => {
  const repositories = getUserRepositories(session.userId);
  return NextResponse.json(repositories.people.list());
});

export const POST = authenticated(async (session, req: Request) => {
  const body = await readMutation(req, 'people', session.userId);
  if (body instanceof Response) return body;
  const repositories = getUserRepositories(session.userId);
  const row = repositories.people.create(body);
  return NextResponse.json(row, { status: 201 });
});
