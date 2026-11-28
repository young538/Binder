export type MutationResource =
  | 'todos'
  | 'projects'
  | 'timeBlocks'
  | 'goals'
  | 'categories'
  | 'annualGoals'
  | 'habits'
  | 'habitLogs'
  | 'books'
  | 'focusNotes'
  | 'retrospectives'
  | 'settings'
  | 'weeklyTemplates'
  | 'dailyCheckins'
  | 'injectionPens'
  | 'injectionEntries'
  | 'metrics'
  | 'metricEntries'
  | 'notes'
  | 'people'
  | 'lifeEvents'
  | 'subscriptions'
  | 'financeTransactions'
  | 'financeBudgets'
  | 'financeAutomation'
  | 'googleCalendar';
type Listener = (resources: readonly MutationResource[]) => void;

const listeners = new Set<Listener>();

export function onDirty(names: readonly string[], refresh: () => void): () => void {
  const listener: Listener = changed => {
    if (names.includes('*') || (!names.length && !changed.length) || changed.some(name => names.includes(name))) {
      refresh();
    }
  };
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Publish all resources changed by one completed operation together. */
export function notifyMutation(...resources: MutationResource[]): void {
  for (const listener of listeners) {
    try {
      listener(resources);
    } catch { /* One subscriber must not prevent other views from refreshing. */ }
  }
}
