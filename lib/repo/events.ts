// Simple pub-sub for cross-component refresh after any mutation.
// Replaces the Dexie-era `onDirty` from lib/db.ts with the same signature.
export type MutationResource = 'todos' | 'timeBlocks' | 'goals' | 'categories' | 'annualGoals' | 'habits' | 'habitLogs' | 'books' | 'focusNotes' | 'retrospectives' | 'settings';
type Listener = (resource?: MutationResource) => void;

const listeners = new Set<Listener>();

export const onDirty = (fn: Listener): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const notifyMutation = (resource?: MutationResource): void => {
  listeners.forEach(fn => {
    try {
      fn(resource);
    } catch {
      /* swallow listener errors */
    }
  });
};
