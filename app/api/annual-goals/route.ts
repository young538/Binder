import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  listAnnualGoalsByYear,
  createAnnualGoal,
  ensureSeven,
} from '@/lib/server/repos/annualGoals';

export async function GET(req: NextRequest) {
  const year = req.nextUrl.searchParams.get('year');
  if (!year) {
    return NextResponse.json({ error: 'year required' }, { status: 400 });
  }
  const rows = await listAnnualGoalsByYear(year);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    year: string;
    order: number;
    ensureSeven?: boolean;
  };
  if (body.ensureSeven) {
    const rows = await ensureSeven(body.year);
    return NextResponse.json(rows);
  }
  const row = await createAnnualGoal(body.year, body.order);
  return NextResponse.json(row, { status: 201 });
}
