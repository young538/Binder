import { NextResponse } from 'next/server';
import { updateAnnualGoal, deleteAnnualGoal } from '@/lib/server/repos/annualGoals';

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const patch = await req.json();
  const row = await updateAnnualGoal(id, patch);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  await deleteAnnualGoal(id);
  return NextResponse.json({ ok: true });
}
