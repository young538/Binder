import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/server/auth';
import {
  listAnnualGoalsByYear,
  createAnnualGoal,
  ensureSeven,
} from '@/lib/server/repos/annualGoals';

export async function GET(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const year = req.nextUrl.searchParams.get('year');
  if (!year) {
    return NextResponse.json({ error: 'year required' }, { status: 400 });
  }
  const rows = await listAnnualGoalsByYear(session.userId, year);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const body = (await req.json()) as {
    year: string;
    order: number;
    ensureSeven?: boolean;
  };
  if (body.ensureSeven) {
    const rows = await ensureSeven(session.userId, body.year);
    return NextResponse.json(rows);
  }
  const row = await createAnnualGoal(session.userId, body.year, body.order);
  return NextResponse.json(row, { status: 201 });
}
