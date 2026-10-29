export const TODO_UNDO_MS = 30_000;

export interface TodoUndo {
  id: string;
  expiresAt: string;
}

export interface TodoDeleteResult {
  ok: true;
  undo?: TodoUndo;
}

export interface TodoRolloverResult {
  moved: number;
  date: string;
}
