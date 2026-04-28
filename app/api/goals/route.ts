import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/server/auth';
import { listGoals, createGoal } from '@/lib/server/repos/goals';

export async function GET() {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const rows = await listGoals(session.userId);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const body = await req.json();
  const row = await createGoal(session.userId, body);
  return NextResponse.json(row, { status: 201 });
}
