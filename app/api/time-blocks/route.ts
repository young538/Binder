import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/server/auth';
import { getTimeBlocksInRange, createTimeBlock } from '@/lib/server/repos/timeBlocks';

export async function GET(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const sp = req.nextUrl.searchParams;
  const startDate = sp.get('startDate');
  const endDate = sp.get('endDate');
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate & endDate required' }, { status: 400 });
  }
  const rows = await getTimeBlocksInRange(session.userId, startDate, endDate);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const body = await req.json();
  const row = await createTimeBlock(session.userId, body);
  return NextResponse.json(row, { status: 201 });
}
