import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/server/db/client';
import { settings } from '@/lib/server/db/schema';
import { requireSession } from '@/lib/server/auth';

const DEFAULTS = {
  firstDayOfWeek: 'mon' as const,
  gridMinutes: 30 as const,
  dayStartHour: 6,
  dayEndHour: 23,
  theme: 'light' as const,
};

export async function GET() {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const db = getDb();
  const row = await db.select().from(settings).where(eq(settings.userId, session.userId)).get();
  if (!row) {
    return NextResponse.json(DEFAULTS);
  }
  // Strip userId from response — client only needs the settings values
  const { userId: _u, ...rest } = row;
  void _u;
  return NextResponse.json(rest);
}

interface SettingsPatch {
  firstDayOfWeek?: 'mon' | 'sun';
  gridMinutes?: 30 | 60;
  dayStartHour?: number;
  dayEndHour?: number;
  theme?: 'light' | 'dark';
}

export async function PATCH(req: Request) {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const patch = (await req.json()) as SettingsPatch;
  const db = getDb();
  const existing = await db.select().from(settings).where(eq(settings.userId, session.userId)).get();
  if (existing) {
    await db.update(settings).set(patch).where(eq(settings.userId, session.userId)).run();
  } else {
    await db.insert(settings).values({ ...DEFAULTS, ...patch, userId: session.userId }).run();
  }
  const row = await db.select().from(settings).where(eq(settings.userId, session.userId)).get();
  if (!row) return NextResponse.json({ error: 'Settings not found' }, { status: 500 });
  const { userId: _u, ...rest } = row;
  void _u;
  return NextResponse.json(rest);
}
