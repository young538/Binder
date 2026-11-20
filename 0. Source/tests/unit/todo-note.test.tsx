import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TodoNote } from '@/components/common/TodoNote';
import { updateTodo } from '@/lib/repo/todos';
import type { Todo } from '@/lib/types';

vi.mock('@/lib/repo/todos', () => ({ updateTodo: vi.fn() }));
const todo = { id: 'todo-note', title: '자료 준비', note: null } as Todo;
beforeEach(() => { vi.resetAllMocks(); vi.mocked(updateTodo).mockResolvedValue(); });
afterEach(cleanup);

describe('inline TODO notes', () => {
  it('retains an unsaved draft when folded and ignores composition shortcuts', () => {
    render(<TodoNote todo={todo} />);
    fireEvent.click(screen.getByRole('button', { name: '자료 준비 메모 추가' }));
    const input = screen.getByRole('textbox', { name: '자료 준비 메모' });
    fireEvent.change(input, { target: { value: '준비할 자료\n참고 링크' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true, isComposing: true });
    expect(updateTodo).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '자료 준비 메모 접기' }));
    fireEvent.click(screen.getByRole('button', { name: '자료 준비 메모 추가' }));
    expect(screen.getByRole('textbox')).toHaveValue('준비할 자료\n참고 링크');
  });

  it('keeps failed drafts and saves only once while a retry is pending', async () => {
    vi.mocked(updateTodo).mockRejectedValueOnce(new Error('offline'));
    render(<TodoNote todo={todo} />);
    fireEvent.click(screen.getByRole('button', { name: '자료 준비 메모 추가' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  회의 자료\n일정 확인  ' } });
    fireEvent.click(screen.getByRole('button', { name: '메모 저장' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('textbox')).toHaveValue('  회의 자료\n일정 확인  ');
    let finish!: () => void;
    vi.mocked(updateTodo).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: '메모 저장' }));
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', ctrlKey: true });
    expect(updateTodo).toHaveBeenCalledTimes(2);
    expect(updateTodo).toHaveBeenLastCalledWith(todo.id, { note: '회의 자료\n일정 확인' });
    await act(async () => finish());
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText(/회의 자료/)).toHaveTextContent('일정 확인');
  });

  it('shows existing and externally updated notes and clears explicitly with null', async () => {
    const { rerender } = render(<TodoNote todo={{ ...todo, note: '기존 메모' }} />);
    fireEvent.click(screen.getByRole('button', { name: '자료 준비 메모 보기' }));
    expect(screen.getByText('기존 메모')).toBeVisible();
    rerender(<TodoNote todo={{ ...todo, note: '상세 설정에서 바꾼 메모' }} />);
    expect(screen.getByText('상세 설정에서 바꾼 메모')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '메모 편집' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: '메모 저장' }));
    await waitFor(() => expect(updateTodo).toHaveBeenCalledWith(todo.id, { note: null }));
    expect(screen.getByRole('button', { name: '자료 준비 메모 추가' })).toHaveAttribute('aria-expanded', 'false');
  });
});
