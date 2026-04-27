import { NextResponse } from 'next/server';
import { listCategories, createCategory } from '@/lib/server/repos/categories';

export async function GET() {
  const rows = await listCategories();
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const row = await createCategory(body);
  return NextResponse.json(row, { status: 201 });
}
