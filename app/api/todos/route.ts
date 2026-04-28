import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/server/auth';
import { listTodos, listDayTodosInRange, createTodo } from '@/lib/server/repos/todos';
import type { TodoScope } from '@/lib/types';

export async function GET(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const sp = req.nextUrl.searchParams;
  const startDate = sp.get('startDate');
  const endDate = sp.get('endDate');
  if (startDate && endDate) {
    const rows = await listDayTodosInRange(session.userId, startDate, endDate);
    return NextResponse.json(rows);
  }
  const scope = sp.get('scope') as TodoScope | null;
  const scopeKey = sp.get('scopeKey');
  const parentGoalId = sp.get('parentGoalId');
  const rows = await listTodos(session.userId, {
    scope: scope ?? undefined,
    scopeKey: scopeKey ?? undefined,
    parentGoalId: parentGoalId ?? undefined,
  });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const body = await req.json();
  const row = await createTodo(session.userId, body);
  return NextResponse.json(row, { status: 201 });
}
