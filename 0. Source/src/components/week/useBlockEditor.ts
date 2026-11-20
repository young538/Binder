'use client';
import { useEffect, useRef, useState } from 'react';
import type { TimeBlock, TimeBlockKind, Todo } from '@/lib/types';
import { createTimeBlock, updateTimeBlock, deleteTimeBlock } from '@/lib/repo/timeBlocks';
import { listByScope } from '@/lib/repo/todos';
import { useBinder } from '@/store';
import { minutesToTimeStr, timeStrToMinutes, snapToGrid } from '@/lib/utils/date';
import { useLatest } from '@/lib/hooks/useLatest';

export interface BlockEditorProps {
  initial: {
    date: string;
    startMin: number;
    endMin: number;
    kind?: TimeBlockKind;
    text?: string;
    categoryId?: string | null;
    goalId?: string | null;
    projectId?: string | null;
    todoId?: string | null;
  };
  existing?: TimeBlock;
  prefilledTodoId?: string;
  prefilledText?: string;
  onClose: () => void;
  onSaved: () => void;
  onCopyToNextDay?: (block: TimeBlock) => void;
}

export const useBlockEditor = ({
  initial,
  existing,
  prefilledTodoId,
  prefilledText,
  onClose,
  onSaved,
}: BlockEditorProps) => {
  const { categories, projects = [], settings } = useBinder();
  const [text, setText] = useState(existing?.text ?? initial.text ?? prefilledText ?? '');
  const [categoryId, setCategoryId] = useState(
    existing ? existing.categoryId ?? '' : initial.categoryId ?? categories[0]?.id ?? '',
  );
  const [goalId, setGoalId] = useState<string | null>(existing?.goalId ?? initial.goalId ?? null);
  const [projectId, setProjectId] = useState<string | null>(
    existing?.projectId ?? initial.projectId ?? null,
  );
  const [kind, setKind] = useState<TimeBlockKind>(
    existing?.kind ?? initial.kind ?? 'plan',
  );
  const [todoId, setTodoId] = useState<string | null>(
    existing?.todoId ?? initial.todoId ?? prefilledTodoId ?? null,
  );
  const [startStr, setStartStr] = useState(
    minutesToTimeStr(existing?.startMin ?? initial.startMin),
  );
  const [endStr, setEndStr] = useState(
    (existing?.endMin ?? initial.endMin) === 1440
      ? '00:00'
      : minutesToTimeStr(existing?.endMin ?? initial.endMin),
  );
  const [dayTodos, setDayTodos] = useState<Todo[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const close = () => {
    if (!pendingRef.current) onClose();
  };

  useEffect(() => {
    listByScope('day', initial.date).then(setDayTodos);
  }, [initial.date]);

  const parseTimes = () => {
    const validTime = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!validTime.test(startStr) || !validTime.test(endStr)) {
      setError('시작과 종료 시간을 입력해 주세요.');
      return null;
    }
    if (!categories.some(category => category.id === categoryId)) {
      setError('사용할 카테고리를 선택해 주세요.');
      return null;
    }
    const grid = settings?.gridMinutes === 60 ? 60 : 30;
    const startMin = Math.max(0, Math.min(1440 - grid, snapToGrid(timeStrToMinutes(startStr), grid)));
    const endMin = Math.max(
      0,
      Math.min(1440, snapToGrid(endStr === '00:00' ? 1440 : timeStrToMinutes(endStr), grid)),
    );
    if (endMin <= startMin) {
      setError('종료는 시작보다 늦어야 해요.');
      return null;
    }
    return { startMin, endMin };
  };

  const selectTodo = (nextTodoId: string | null) => {
    setTodoId(nextTodoId);
    if (!nextTodoId) return;
    const t = dayTodos.find(item => item.id === nextTodoId);
    if (!t) return;
    if (!text) setText(t.title);
    if (!projectId && t.projectId) setProjectId(t.projectId);
    if (!goalId && t.parentGoalId) setGoalId(t.parentGoalId);
    if (!existing && t.categoryId && categories.some(c => c.id === t.categoryId)) {
      setCategoryId(t.categoryId);
    }
  };

  const selectProject = (nextProjectId: string | null) => {
    const prevGoalId = projectId ? projects.find(p => p.id === projectId)?.goalId : null;
    const nextProject = nextProjectId ? projects.find(p => p.id === nextProjectId) : null;
    setProjectId(nextProjectId);
    if (nextProject?.goalId && (!goalId || goalId === prevGoalId)) {
      setGoalId(nextProject.goalId);
    }
    if (!existing && !todoId && nextProject?.categoryId && categories.some(c => c.id === nextProject.categoryId)) {
      setCategoryId(nextProject.categoryId);
    }
  };

  const save = async () => {
    if (pendingRef.current) return;
    setError(null);
    const parsed = parseTimes();
    if (!parsed) return;
    pendingRef.current = true;
    setPending(true);
    try {
      const values = {
        text,
        kind,
        categoryId,
        goalId,
        projectId,
        todoId,
        startMin: parsed.startMin,
        endMin: parsed.endMin,
      };
      if (existing) {
        await updateTimeBlock(existing.id, values);
      } else {
        await createTimeBlock({ date: initial.date, ...values });
      }
      onSaved();
      onClose();
    } catch {
      setError('저장하지 못했어요. 입력한 내용을 확인하고 다시 시도해 주세요.');
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  const confirmAsActual = async () => {
    if (!existing || pendingRef.current) return;
    setError(null);
    const parsed = parseTimes();
    if (!parsed) return;
    pendingRef.current = true;
    setPending(true);
    try {
      await createTimeBlock({
        date: initial.date,
        text,
        kind: 'actual',
        categoryId,
        goalId,
        projectId,
        todoId,
        startMin: parsed.startMin,
        endMin: parsed.endMin,
      });
      onSaved();
      onClose();
    } catch {
      setError('실제 기록으로 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  // 키보드 단축키: ESC = 취소, Enter = 저장.
  // save/onClose 는 매 렌더 새로 만들어지므로 ref 로 latest 유지 →
  // useEffect 는 [] 한 번만 등록/해제.
  const saveRef = useLatest(save);
  const closeRef = useLatest(close);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key === 'Enter') {
        if (e.target instanceof HTMLTextAreaElement) return;
        if (e.isComposing) return;
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveRef, closeRef]);

  const remove = async () => {
    if (!existing || pendingRef.current) return;
    if (!confirm('삭제할까요?')) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await deleteTimeBlock(existing.id);
      onSaved();
      onClose();
    } catch {
      setError('삭제하지 못했어요. 다시 시도해 주세요.');
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  return {
    text,
    setText,
    categoryId,
    setCategoryId,
    goalId,
    setGoalId,
    projectId,
    selectProject,
    kind,
    setKind,
    todoId,
    selectTodo,
    startStr,
    setStartStr,
    endStr,
    setEndStr,
    dayTodos,
    projects,
    pending,
    error,
    close,
    save,
    confirmAsActual,
    remove,
    categories,
  };
};
