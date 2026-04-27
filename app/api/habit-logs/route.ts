import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { listLogsForRange, toggleHabit } from '@/lib/server/repos/habitLogs';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const startDate = sp.get('startDate');
  const endDate = sp.get('endDate');
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate & endDate required' }, { status: 400 });
  }
  const rows = await listLogsForRange(startDate, endDate);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = (await req.json()) as { habitId: string; date: string };
  const added = await toggleHabit(body.habitId, body.date);
  return NextResponse.json({ added });
}
