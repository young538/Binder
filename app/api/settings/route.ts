import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/server/db/client';
import { settings } from '@/lib/server/db/schema';

const DEFAULTS = {
  key: 'main' as const,
  firstDayOfWeek: 'mon',
  gridMinutes: 30,
  dayStartHour: 6,
  dayEndHour: 23,
  theme: 'light',
};

export async function GET() {
  const db = getDb();
  const row = await db.select().from(settings).where(eq(settings.key, 'main')).get();
  if (!row) {
    return NextResponse.json(DEFAULTS);
  }
  return NextResponse.json(row);
}

interface SettingsPatch {
  firstDayOfWeek?: 'mon' | 'sun';
  gridMinutes?: 30 | 60;
  dayStartHour?: number;
  dayEndHour?: number;
  theme?: 'light' | 'dark';
}

export async function PATCH(req: Request) {
  const patch = (await req.json()) as SettingsPatch;
  const db = getDb();
  const existing = await db.select().from(settings).where(eq(settings.key, 'main')).get();
  if (existing) {
    await db.update(settings).set(patch).where(eq(settings.key, 'main')).run();
  } else {
    await db.insert(settings).values({ ...DEFAULTS, ...patch }).run();
  }
  const row = await db.select().from(settings).where(eq(settings.key, 'main')).get();
  return NextResponse.json(row);
}
