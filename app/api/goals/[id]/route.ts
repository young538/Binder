import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/server/auth';
import { updateGoal, deleteGoal } from '@/lib/server/repos/goals';

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const { id } = await ctx.params;
  const patch = await req.json();
  const row = await updateGoal(session.userId, id, patch);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const { id } = await ctx.params;
  await deleteGoal(session.userId, id);
  return NextResponse.json({ ok: true });
}
