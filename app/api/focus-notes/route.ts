import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getFocus, upsertFocus } from '@/lib/server/repos/focusNotes';
import type { FocusScope } from '@/lib/types';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const scope = sp.get('scope') as FocusScope | null;
  const scopeKey = sp.get('scopeKey');
  if (!scope || !scopeKey) {
    return NextResponse.json({ error: 'scope & scopeKey required' }, { status: 400 });
  }
  const row = await getFocus(scope, scopeKey);
  return NextResponse.json(row ?? null);
}

export async function PUT(req: Request) {
  const body = (await req.json()) as { scope: FocusScope; scopeKey: string; text: string };
  const row = await upsertFocus(body.scope, body.scopeKey, body.text);
  return NextResponse.json(row);
}
