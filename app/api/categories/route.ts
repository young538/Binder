import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/server/auth';
import { listCategories, createCategory } from '@/lib/server/repos/categories';

export async function GET() {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const rows = await listCategories(session.userId);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const body = await req.json();
  const row = await createCategory(session.userId, body);
  return NextResponse.json(row, { status: 201 });
}
