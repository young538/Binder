import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/server/auth';

export async function GET() {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }
  return NextResponse.json({ userId: session.userId, username: session.username });
}
