// Server-side persistence: no local dirty tracking needed.
// Retained as no-op stub for any stale imports; safe to delete in future.
export const getSyncMeta = async (): Promise<null> => null;

export const markSynced = async (_syncedAt: string): Promise<void> => {
  void _syncedAt;
};
