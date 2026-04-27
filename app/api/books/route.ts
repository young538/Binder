import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { listBooksByYear, createBook } from '@/lib/server/repos/books';

export async function GET(req: NextRequest) {
  const year = req.nextUrl.searchParams.get('year');
  if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 });
  const rows = await listBooksByYear(year);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const row = await createBook(body);
  return NextResponse.json(row, { status: 201 });
}
