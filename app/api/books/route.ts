import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireSession } from '@/lib/server/auth';
import { listBooksByYear, createBook } from '@/lib/server/repos/books';

export async function GET(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const year = req.nextUrl.searchParams.get('year');
  if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 });
  const rows = await listBooksByYear(session.userId, year);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const body = await req.json();
  const row = await createBook(session.userId, body);
  return NextResponse.json(row, { status: 201 });
}
