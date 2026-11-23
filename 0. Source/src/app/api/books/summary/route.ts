import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';

export const GET = authenticated(async session =>
  NextResponse.json(getUserRepositories(session.userId).insights.readingSummary()),
);
