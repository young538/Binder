import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/server/http';
import { getDb } from '@/lib/server/db/client';
import { BackupService } from '@/lib/server/backup/service';

const backups = new BackupService(getDb);

export const GET = authenticated(async (session) => {
  return NextResponse.json(backups.exportFor(session.userId));
});
