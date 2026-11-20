import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';
import { isDate, readMutation } from '@/lib/server/validation';
import type { NoteKind } from '@/lib/types';

const KINDS: NoteKind[] = ['principle', 'decision', 'insight', 'reference'];

export const GET = authenticated(async (session, req: NextRequest) => {
  const repositories = getUserRepositories(session.userId);
  const sp = req.nextUrl.searchParams;
  const dueDate = sp.get('dueDecisionsDate');
  if (dueDate) {
    if (!isDate(dueDate)) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    return NextResponse.json(repositories.notes.listDueDecisions(dueDate));
  }
  const kindParam = sp.get('kind');
  const kind = kindParam && KINDS.includes(kindParam as NoteKind) ? (kindParam as NoteKind) : undefined;
  const goalId = sp.get('goalId') ?? undefined;
  const projectId = sp.get('projectId') ?? undefined;
  return NextResponse.json(repositories.notes.list({ kind, goalId, projectId }));
});

export const POST = authenticated(async (session, req: Request) => {
  const body = await readMutation(req, 'notes', session.userId);
  if (body instanceof Response) return body;
  const repositories = getUserRepositories(session.userId);
  const row = repositories.notes.create(body);
  return NextResponse.json(row, { status: 201 });
});
