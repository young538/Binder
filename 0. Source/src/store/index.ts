import { listCategories } from '@/lib/repo/categories';
import { listAllGoals } from '@/lib/repo/goals';
import { listProjects } from '@/lib/repo/projects';
import { getSettings } from '@/lib/repo/settings';
import { getMe } from '@/lib/repo/auth';
import { createBinderStore } from './createBinderStore';

export const useBinder = createBinderStore({
  me: getMe, categories: listCategories, goals: listAllGoals, projects: listProjects, settings: getSettings,
});
