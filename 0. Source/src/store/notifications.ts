import { create } from 'zustand';
import type { TodoUndo } from '@/lib/todos/contracts';

interface Notice {
  id: string;
  userId: string;
  text: string;
  expiresAt: number;
  undo?: TodoUndo;
}

export const useNotifications = create<{
  items: Notice[];
  add: (notice: Omit<Notice, 'id'>) => void;
  remove: (id: string) => void;
}>(set => ({
  items: [],
  add: notice => set(state => ({ items: [...state.items.filter(item => item.expiresAt > Date.now()
    && !(notice.undo && item.undo?.id === notice.undo.id)), { ...notice, id: crypto.randomUUID() }] })),
  remove: id => set(state => ({ items: state.items.filter(item => item.id !== id) })),
}));
