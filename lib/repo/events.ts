// Simple pub-sub for cross-component refresh after any mutation.
// Replaces the Dexie-era `onDirty` from lib/db.ts with the same signature.
type Listener = () => void;

const listeners = new Set<Listener>();

export const onDirty = (fn: Listener): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const notifyMutation = (): void => {
  listeners.forEach(fn => {
    try {
      fn();
    } catch {
      /* swallow listener errors */
    }
  });
};
