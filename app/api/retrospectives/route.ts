import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/server/auth';
import { getRetrospective, upsertRetrospective } from '@/lib/server/repos/retrospectives';

export async function GET(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const sp = req.nextUrl.searchParams;
  const type = sp.get('type') as 'daily' | 'weekly' | null;
  const dateOrWeek = sp.get('dateOrWeek');
  if (!type || !dateOrWeek) {
    return NextResponse.json({ error: 'type & dateOrWeek required' }, { status: 400 });
  }
  const row = await getRetrospective(session.userId, type, dateOrWeek);
  return NextResponse.json(row ?? null);
}

export async function PUT(req: Request) {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const body = (await req.json()) as {
    type: 'daily' | 'weekly';
    dateOrWeek: string;
    [key: string]: unknown;
  };
  const { type, dateOrWeek, ...data } = body;
  const row = await upsertRetrospective(session.userId, type, dateOrWeek, data);
  return NextResponse.json(row);
}
