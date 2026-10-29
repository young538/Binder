'use client';
import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Todo, TodoStatus } from '@/lib/types';
import { statusRowClass } from '@/lib/utils/todoStatus';

interface Props {
  todo: Todo;
  onCommit: (todo: Todo, nextTitle: string) => void | Promise<void>;
  className?: string;
  textClassName?: string;
  showEditButton?: boolean;
  editButtonTitle?: string;
}

/**
 * 할 일 제목의 선택-편집 분리 인라인 에디터.
 *
 * - 1회 클릭/포커스: selected(하이라이트)만 표시, input은 읽기 전용 유지
 * - 더블클릭 / Enter / 연필 버튼: editing 전환 후 실제 입력 가능
 * - Enter/blur: 저장, Esc: 취소 후 선택 상태로 복귀
 *
 * 주간 DayTodoColumn / 공통 TodoListSection / 월간 DayTodoDrawer 에서 공유한다.
 */
export const TodoTitleEditor = ({
  todo,
  onCommit,
  className = '',
  textClassName = '',
  showEditButton = true,
  editButtonTitle = '제목 편집',
}: Props) => {
  const [selected, setSelected] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.title);
  const [hinted, setHinted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // 모바일에서는 dblclick이 오지 않으므로 같은 input의 연속 탭으로 판단한다.
  const lastTap = useRef(0);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const startEditing = () => {
    setSelected(true);
    setEditing(true);
    setDraft(todo.title);
    setHinted(true);
  };

  const cancelEditing = () => {
    setDraft(todo.title);
    setEditing(false);
    setSelected(true);
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      inputRef.current?.focus();
    }
  };

  const commitEditing = () => {
    const trimmed = draft.trim();
    setEditing(false);
    setSelected(true);
    if (!trimmed || trimmed === todo.title) {
      setDraft(todo.title);
      return;
    }
    void onCommit(todo, trimmed);
  };

  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-1 rounded transition ${
        selected && !editing
          ? 'bg-blue-50 ring-1 ring-inset ring-blue-300 dark:bg-blue-950/30 dark:ring-blue-700'
          : ''
      } ${className}`}
    >
      <input
        ref={inputRef}
        type="text"
        value={editing ? draft : todo.title}
        readOnly={!editing}
        aria-readonly={!editing}
        data-selected={selected}
        aria-label={editing ? '할 일 제목 편집 중' : '할 일 제목'}
        data-testid="todo-title"
        data-todo-id={todo.id}
        data-editing={editing ? 'true' : 'false'}
        onChange={(e) => {
          if (editing) setDraft(e.target.value);
        }}
        onFocus={() => setSelected(true)}
        onBlur={() => {
          if (editing) {
            commitEditing();
            return;
          }
          setSelected(false);
        }}
        onClick={(e) => {
          if (editing) return;
          setSelected(true);
          // Playwright click() 뒤의 press('Enter')/keyboard.press('Enter')
          // 시나리오에서 detail===0인 합성 클릭이 400ms 더블탭 판정을
          // 오염시키지 않도록 실제 마우스 클릭(detail>=1)만 기록한다.
          // 실제 더블클릭은 onDoubleClick이 처리한다.
          if (e.detail < 1) return;
          const now = Date.now();
          const prev = lastTap.current;
          lastTap.current = now;
          if (now - prev < 400) {
            lastTap.current = 0;
            startEditing();
          }
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          startEditing();
        }}
        onKeyDown={(e) => {
          if (editing) {
            if (e.key === 'Enter') {
              if (e.nativeEvent.isComposing) return;
              e.preventDefault();
              commitEditing();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              cancelEditing();
            }
            return;
          }
          if (e.key === 'Enter' || e.key === 'F2') {
            e.preventDefault();
            startEditing();
          }
        }}
        className={`h-5 min-w-0 flex-1 border-none bg-transparent text-[11px] leading-5 outline-none ${statusRowClass(
          todo.status as TodoStatus,
        )} ${
          editing
            ? 'cursor-text ring-1 ring-blue-500 dark:ring-blue-400'
            : 'cursor-default'
        } ${textClassName}`}
      />
      {showEditButton && !editing && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            startEditing();
          }}
          title={editButtonTitle}
          aria-label={`${todo.title} ${editButtonTitle}`}
          data-testid="todo-title-edit"
          data-todo-id={todo.id}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-400 transition hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-950/50 dark:hover:text-blue-300 ${
            selected
              ? 'opacity-100'
              : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100'
          }`}
        >
          <Pencil size={11} />
        </button>
      )}
      {selected && !editing && !hinted && (
        <span className="pointer-events-none hidden shrink-0 text-[9px] text-zinc-400 md:inline">
          Enter로 편집
        </span>
      )}
    </div>
  );
};
