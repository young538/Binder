import { getUserRepositories } from '@/lib/server/repos';
import { readMutation } from '@/lib/server/validation';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticated } from '@/lib/server/http';

import type { FocusScope } from '@/lib/types';

export const GET = authenticated(async (session, req: NextRequest) => {
  const repositories = getUserRepositories(session.userId);
  const sp = req.nextUrl.searchParams;
  const scope = sp.get('scope') as FocusScope | null;
  const scopeKey = sp.get('scopeKey');
  if (!scope || !scopeKey) {
    return NextResponse.json({ error: 'scope & scopeKey required' }, { status: 400 });
  }
  const row = await repositories.focusNotes.get(scope, scopeKey);
  return NextResponse.json(row ?? null);
});

export const PUT = authenticated(async (session, req: Request) => {
  const repositories = getUserRepositories(session.userId);
  const body = await readMutation(req, 'focusNotes', session.userId);
  if (body instanceof Response) return body;
  const row = await repositories.focusNotes.upsert(body.scope, body.scopeKey, body.text);
  return NextResponse.json(row);
});
