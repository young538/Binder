import 'server-only';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { parseReadingEntry, type ReadingEntry } from '@/lib/reading';
import type { DatabaseSession } from '../db/connection';
import { retrospectives } from '../db/schema';

export function listDailyReadings(db: DatabaseSession, userId: string, dates?: string[]) {
  const reading = sql<string>`json_extract(${retrospectives.template}, '$.reading')`;
  const rows = db.select({ id: retrospectives.id, date: retrospectives.dateOrWeek, reading })
    .from(retrospectives).where(and(
      eq(retrospectives.userId, userId), eq(retrospectives.type, 'daily'),
      sql`json_type(${retrospectives.template}, '$.reading') = 'text'`,
      dates ? inArray(retrospectives.dateOrWeek, dates) : undefined,
    )).orderBy(asc(retrospectives.dateOrWeek)).all();
  return rows.flatMap(row => row.reading.trim() ? [{
    id: row.id, date: row.date, entry: parseReadingEntry(row.reading, 0),
  }] : []);
}

export function updateDailyReading(db: DatabaseSession, userId: string, id: string, entry: ReadingEntry, updatedAt: string) {
  db.update(retrospectives).set({
    template: sql`json_set(${retrospectives.template}, '$.reading', ${JSON.stringify(entry)})`,
    updatedAt,
  }).where(and(eq(retrospectives.userId, userId), eq(retrospectives.id, id))).run();
}
