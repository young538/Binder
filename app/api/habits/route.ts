import { NextResponse } from 'next/server';
import { listHabits, createHabit } from '@/lib/server/repos/habits';

export async function GET() {
  const rows = await listHabits();
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const row = await createHabit(body);
  return NextResponse.json(row, { status: 201 });
}
