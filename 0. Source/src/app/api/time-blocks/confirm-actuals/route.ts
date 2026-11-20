import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';
import { readMutation } from '@/lib/server/validation';

export const POST = authenticated(async (session, req: Request) => {
  const body = await readMutation(req, 'timeBlockConfirmActuals', session.userId);
  if (body instanceof Response) return body;
  const repositories = getUserRepositories(session.userId);
  const result = repositories.timeBlocks.confirmPlansAsActual(body.date, body.blockIds);
  return NextResponse.json(result);
});
