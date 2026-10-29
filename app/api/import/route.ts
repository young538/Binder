import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/server/http';
import { getDb } from '@/lib/server/db/client';
import { ValidationError } from '@/lib/server/validation';
import { BackupService } from '@/lib/server/backup/service';

const backups = new BackupService(getDb);

export const POST = authenticated(async (session, req: Request) => {
  let raw: unknown;
  try { raw = await req.json(); } catch {
    return NextResponse.json({ error: '잘못된 JSON 본문' }, { status: 400 });
  }
  try {
    return NextResponse.json(backups.importFor(session.userId, raw));
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[POST /api/import] transaction failed', error);
    return NextResponse.json(
      { error: '가져오기 중 오류가 발생해 모든 변경이 롤백되었습니다' },
      { status: 500 },
    );
  }
});
