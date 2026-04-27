import { NextResponse } from 'next/server';
import { toggleTodoDone } from '@/lib/server/repos/todos';

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const row = await toggleTodoDone(id);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}
