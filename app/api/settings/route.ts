import { readMutation, ValidationError } from '@/lib/server/validation';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db/client';
import { authenticated } from '@/lib/server/http';
import { SettingsRepository } from '@/lib/server/repos/settings';

export const GET = authenticated(async (session) => {
  return NextResponse.json(new SettingsRepository(getDb(), session.userId).get());
});

export const PATCH = authenticated(async (session, req: Request) => {
  const patch = await readMutation(req, 'settings', session.userId, true);
  if (patch instanceof Response) return patch;
  try {
    return NextResponse.json(new SettingsRepository(getDb(), session.userId).update(patch));
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
});
