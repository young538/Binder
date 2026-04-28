import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/server/auth';
import { listLogsForRange, toggleHabit } from '@/lib/server/repos/habitLogs';

export async function GET(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const sp = req.nextUrl.searchParams;
  const startDate = sp.get('startDate');
  const endDate = sp.get('endDate');
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate & endDate required' }, { status: 400 });
  }
  const rows = await listLogsForRange(session.userId, startDate, endDate);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const body = (await req.json()) as { habitId: string; date: string };
  const added = await toggleHabit(session.userId, body.habitId, body.date);
  return NextResponse.json({ added });
}
