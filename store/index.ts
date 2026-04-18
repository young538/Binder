import { create } from 'zustand';
import { Category, Goal, Settings } from '@/lib/types';
import { listCategories } from '@/lib/repo/categories';
import { getSettings } from '@/lib/repo/settings';
import { db } from '@/lib/db';
import { seedIfEmpty } from '@/lib/seed';

interface BinderStore {
  categories: Category[];
  goals: Goal[];
  settings: Settings | null;
  ready: boolean;
  init: () => Promise<void>;
  reload: () => Promise<void>;
}

export const useBinder = create<BinderStore>((set) => ({
  categories: [],
  goals: [],
  settings: null,
  ready: false,
  init: async () => {
    await seedIfEmpty();
    const [categories, goals, settings] = await Promise.all([
      listCategories(),
      db.goals.toArray(),
      getSettings(),
    ]);
    set({ categories, goals, settings, ready: true });
  },
  reload: async () => {
    const [categories, goals, settings] = await Promise.all([
      listCategories(),
      db.goals.toArray(),
      getSettings(),
    ]);
    set({ categories, goals, settings });
  },
}));
