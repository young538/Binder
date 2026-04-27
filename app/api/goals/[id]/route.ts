import { NextResponse } from 'next/server';
import { updateGoal, deleteGoal } from '@/lib/server/repos/goals';

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const patch = await req.json();
  const row = await updateGoal(id, patch);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  await deleteGoal(id);
  return NextResponse.json({ ok: true });
}
