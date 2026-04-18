import Dexie, { Table } from 'dexie';
import { Goal, TimeBlock, Category, Retrospective, Settings } from './types';

export interface SyncMeta {
  key: 'main';
  dirty: boolean;
  lastSyncedAt: string | null;
  deviceId: string;
}

export interface AuthToken {
  key: 'google';
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface Snapshot {
  id: string;
  createdAt: string;
  data: string;
}

class BinderDb extends Dexie {
  goals!: Table<Goal, string>;
  categories!: Table<Category, string>;
  timeBlocks!: Table<TimeBlock, string>;
  retrospectives!: Table<Retrospective, string>;
  settings!: Table<Settings & { key: 'main' }, 'main'>;
  syncMeta!: Table<SyncMeta, 'main'>;
  authTokens!: Table<AuthToken, 'google'>;
  snapshots!: Table<Snapshot, string>;

  constructor() {
    super('BinderDb');
    this.version(1).stores({
      goals: 'id, parentId, level, order',
      categories: 'id, order',
      timeBlocks: 'id, date, categoryId, goalId',
      retrospectives: 'id, type, dateOrWeek, [type+dateOrWeek]',
      settings: 'key',
      syncMeta: 'key',
      authTokens: 'key',
      snapshots: 'id, createdAt',
    });
  }
}

export const db = new BinderDb();

const dirtyListeners: (() => void)[] = [];

export const onDirty = (fn: () => void) => {
  dirtyListeners.push(fn);
  return () => {
    const idx = dirtyListeners.indexOf(fn);
    if (idx >= 0) dirtyListeners.splice(idx, 1);
  };
};

export const markDirty = async () => {
  const existing = await db.syncMeta.get('main');
  await db.syncMeta.put({
    key: 'main',
    dirty: true,
    lastSyncedAt: existing?.lastSyncedAt ?? null,
    deviceId: existing?.deviceId ?? crypto.randomUUID(),
  });
  dirtyListeners.forEach(fn => fn());
};
