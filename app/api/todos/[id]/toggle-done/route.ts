import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/server/auth';
import { toggleTodoDone } from '@/lib/server/repos/todos';

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const { id } = await ctx.params;
  const row = await toggleTodoDone(session.userId, id);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}
