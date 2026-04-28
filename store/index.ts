import { create } from 'zustand';
import { Category, Goal, Settings } from '@/lib/types';
import { listCategories } from '@/lib/repo/categories';
import { listAllGoals } from '@/lib/repo/goals';
import { getSettings } from '@/lib/repo/settings';
import { getMe, type Me } from '@/lib/repo/auth';

interface BinderStore {
  me: Me | null;
  categories: Category[];
  goals: Goal[];
  settings: Settings | null;
  ready: boolean;
  init: () => Promise<void>;
  reload: () => Promise<void>;
}

export const useBinder = create<BinderStore>((set) => ({
  me: null,
  categories: [],
  goals: [],
  settings: null,
  ready: false,
  init: async () => {
    const [me, categories, goals, settings] = await Promise.all([
      getMe(),
      listCategories(),
      listAllGoals(),
      getSettings(),
    ]);
    set({ me, categories, goals, settings, ready: true });
  },
  reload: async () => {
    const [categories, goals, settings] = await Promise.all([
      listCategories(),
      listAllGoals(),
      getSettings(),
    ]);
    set({ categories, goals, settings });
  },
}));
