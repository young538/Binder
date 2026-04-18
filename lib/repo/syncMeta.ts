import { db } from '../db';

export const getSyncMeta = async () => db.syncMeta.get('main');

export const markSynced = async (syncedAt: string) => {
  const existing = await getSyncMeta();
  await db.syncMeta.put({
    key: 'main',
    dirty: false,
    lastSyncedAt: syncedAt,
    deviceId: existing?.deviceId ?? crypto.randomUUID(),
  });
};
