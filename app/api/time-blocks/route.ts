import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getTimeBlocksInRange, createTimeBlock } from '@/lib/server/repos/timeBlocks';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const startDate = sp.get('startDate');
  const endDate = sp.get('endDate');
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate & endDate required' }, { status: 400 });
  }
  const rows = await getTimeBlocksInRange(startDate, endDate);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const row = await createTimeBlock(body);
  return NextResponse.json(row, { status: 201 });
}
