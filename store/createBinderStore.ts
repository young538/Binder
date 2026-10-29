import { create } from 'zustand';
import type { Category, Goal, Settings } from '@/lib/types';
import type { Me } from '@/lib/repo/auth';

export interface BinderDataSource {
  me: () => Promise<Me>;
  categories: () => Promise<Category[]>;
  goals: () => Promise<Goal[]>;
  settings: () => Promise<Settings>;
}

interface BinderStore {
  me: Me | null;
  categories: Category[];
  goals: Goal[];
  settings: Settings | null;
  ready: boolean;
  error: string | null;
  init: () => Promise<void>;
  reload: () => Promise<void>;
}

/** Creates an isolated store; initialization is shared and refreshes cannot arrive out of order. */
export function createBinderStore(source: BinderDataSource) {
  let initialization: Promise<void> | undefined;
  let version = 0;
  const readCollections = async () => {
    const [categories, goals, settings] = await Promise.all([source.categories(), source.goals(), source.settings()]);
    return { categories, goals, settings };
  };
  return create<BinderStore>((set, get) => ({
    me: null, categories: [], goals: [], settings: null, ready: false, error: null,
    init: () => {
      if (get().ready) return Promise.resolve();
      if (initialization) return initialization;
      const request = ++version;
      set({ error: null });
      initialization = Promise.all([source.me(), readCollections()])
        .then(([me, collections]) => {
          if (request === version) set({ me, ...collections, ready: true, error: null });
        })
        .catch(() => {
          if (request === version) set({ error: '기본 데이터를 불러오지 못했습니다. 다시 시도해 주세요.' });
        })
        .finally(() => { initialization = undefined; });
      return initialization;
    },
    reload: async () => {
      if (!get().ready) return get().init();
      const request = ++version;
      const collections = await readCollections();
      if (request === version) set(collections);
    },
  }));
}
