import { db, onDirty } from './db';
import { buildExport } from './exporter';
import { newId } from './utils/id';

const MAX_SNAPSHOTS = 5;
const AUTO_DEBOUNCE_MS = 30_000;

export interface SnapshotMeta {
  id: string;
  createdAt: string;
  kind: 'auto' | 'manual';
  label?: string;
}

const trimOld = async () => {
  const all = await db.snapshots.orderBy('createdAt').reverse().toArray();
  if (all.length > MAX_SNAPSHOTS) {
    const toDelete = all.slice(MAX_SNAPSHOTS).map(s => s.id);
    await db.snapshots.bulkDelete(toDelete);
  }
};

export const createSnapshot = async (
  kind: 'auto' | 'manual' = 'manual',
  label?: string
): Promise<SnapshotMeta> => {
  const data = await buildExport();
  const payload = { kind, label, ...data };
  const snap = {
    id: `${kind}-${newId()}`,
    createdAt: new Date().toISOString(),
    data: JSON.stringify(payload),
  };
  await db.snapshots.put(snap);
  await trimOld();
  return { id: snap.id, createdAt: snap.createdAt, kind, label };
};

export const listSnapshots = async (): Promise<SnapshotMeta[]> => {
  const items = await db.snapshots.orderBy('createdAt').reverse().toArray();
  return items.map(s => {
    let kind: 'auto' | 'manual' = 'auto';
    let label: string | undefined;
    try {
      const parsed = JSON.parse(s.data);
      if (parsed.kind === 'manual' || parsed.kind === 'auto') kind = parsed.kind;
      if (typeof parsed.label === 'string') label = parsed.label;
    } catch {
      /* ignore parse errors */
    }
    if (s.id.startsWith('manual-')) kind = 'manual';
    else if (s.id.startsWith('auto-')) kind = 'auto';
    return { id: s.id, createdAt: s.createdAt, kind, label };
  });
};

export const restoreSnapshot = async (id: string): Promise<void> => {
  const snap = await db.snapshots.get(id);
  if (!snap) throw new Error('스냅샷을 찾을 수 없어요');
  const data = JSON.parse(snap.data);

  // 복구 직전 상태를 자동으로 보존
  await createSnapshot('manual', '복구 직전');

  await db.transaction(
    'rw',
    [
      db.goals,
      db.categories,
      db.timeBlocks,
      db.retrospectives,
      db.todos,
      db.focusNotes,
      db.annualGoals,
      db.habits,
      db.habitLogs,
      db.routines,
      db.settings,
    ],
    async () => {
      await db.goals.clear();
      await db.categories.clear();
      await db.timeBlocks.clear();
      await db.retrospectives.clear();
      await db.todos.clear();
      await db.focusNotes.clear();
      await db.annualGoals.clear();
      await db.habits.clear();
      await db.habitLogs.clear();
      await db.routines.clear();
      await db.settings.clear();
      if (data.goals?.length) await db.goals.bulkPut(data.goals);
      if (data.categories?.length) await db.categories.bulkPut(data.categories);
      if (data.timeBlocks?.length) await db.timeBlocks.bulkPut(data.timeBlocks);
      if (data.retrospectives?.length) await db.retrospectives.bulkPut(data.retrospectives);
      if (data.todos?.length) await db.todos.bulkPut(data.todos);
      if (data.focusNotes?.length) await db.focusNotes.bulkPut(data.focusNotes);
      if (data.annualGoals?.length) await db.annualGoals.bulkPut(data.annualGoals);
      if (data.habits?.length) await db.habits.bulkPut(data.habits);
      if (data.habitLogs?.length) await db.habitLogs.bulkPut(data.habitLogs);
      if (data.routines?.length) await db.routines.bulkPut(data.routines);
      if (data.settings) {
        const s = data.settings;
        await db.settings.put({ key: 'main', ...s });
      }
    }
  );
};

export const deleteSnapshot = async (id: string): Promise<void> => {
  await db.snapshots.delete(id);
};

let autoTimer: ReturnType<typeof setTimeout> | undefined;
let installed = false;

export const installAutoSnapshot = () => {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  onDirty(() => {
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      createSnapshot('auto').catch(err => console.warn('auto snapshot failed', err));
    }, AUTO_DEBOUNCE_MS);
  });
};
