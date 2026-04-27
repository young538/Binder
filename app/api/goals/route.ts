import { NextResponse } from 'next/server';
import { listGoals, createGoal } from '@/lib/server/repos/goals';

export async function GET() {
  const rows = await listGoals();
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const row = await createGoal(body);
  return NextResponse.json(row, { status: 201 });
}
