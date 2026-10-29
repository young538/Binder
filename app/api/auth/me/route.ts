import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/server/http';

export const GET = authenticated(async (session) => {
  return NextResponse.json({ userId: session.userId, username: session.username });
});
