import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TodoListSection } from '@/components/common/TodoListSection';
import { DayTodoColumn } from '@/components/week/DayTodoColumn';
import { DayTodoDrawer } from '@/components/monthly/DayTodoDrawer';
import { createTodo, listByScope, updateTodo } from '@/lib/repo/todos';
import type { Todo } from '@/lib/types';

vi.mock('@/lib/repo/todos', () => ({
  listByScope: vi.fn().mockResolvedValue([]), createTodo: vi.fn(),
  updateTodo: vi.fn(), deleteTodo: vi.fn(), setStatus: vi.fn(),
}));
vi.mock('@/store', () => ({ useBinder: () => ({ goals: [], categories: [] }) }));
vi.mock('@/components/week/WeeklyDataProvider', () => ({ useWeeklyData: () => ({ todos: [] }) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listByScope).mockResolvedValue([]);
  vi.mocked(createTodo).mockImplementation(() => new Promise(() => {}));
});
afterEach(cleanup);

const views = {
  common: () => <TodoListSection scope="day" scopeKey="2026-10-29" title="오늘 할 일" />,
  weekly: () => <DayTodoColumn dateStr="2026-10-29" onMakeBlock={vi.fn()} />,
  monthly: () => <DayTodoDrawer dateStr="2026-10-29" onClose={vi.fn()} />,
};

async function openInput(view: keyof typeof views) {
  await act(async () => { render(views[view]()); });
  fireEvent.click(screen.getByRole('button', { name: view === 'monthly' ? 'TODO 추가' : '추가' }));
  const input = screen.getByPlaceholderText('할 일');
  fireEvent.change(input, { target: { value: '한글 할 일' } });
  return input;
}

describe('TODO creation across all entry points', () => {
  it.each(['common', 'weekly', 'monthly'] as const)('%s creates once when Enter, blur and another Enter overlap', async view => {
    const input = await openInput(view);
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(createTodo).toHaveBeenCalledTimes(1);
    expect(createTodo).toHaveBeenCalledWith(expect.objectContaining({ title: '한글 할 일', scopeKey: '2026-10-29' }), expect.any(String));
  });

  it.each(['common', 'weekly', 'monthly'] as const)('%s ignores the Enter that confirms Korean composition', async view => {
    const input = await openInput(view);
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true, keyCode: 229 });
    expect(createTodo).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
    expect(createTodo).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(createTodo).toHaveBeenCalledTimes(1);
  });

  it('retains the draft after failure, retries once, and does not resubmit after success', async () => {
    let reject!: (error: Error) => void;
    vi.mocked(createTodo).mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
    const input = await openInput('common');
    fireEvent.keyDown(input, { key: 'Enter' });
    await act(async () => reject(new Error('offline')));
    expect(input).toHaveValue('한글 할 일');
    expect(screen.getByRole('alert')).toHaveTextContent('저장하지 못했어요');
    vi.mocked(createTodo).mockResolvedValueOnce({ id: 'created' } as Todo);
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    await waitFor(() => expect(screen.queryByPlaceholderText('할 일')).not.toBeInTheDocument());
    expect(createTodo).toHaveBeenCalledTimes(2);
    expect(vi.mocked(createTodo).mock.calls[1]).toEqual(vi.mocked(createTodo).mock.calls[0]);
  });

  it('Escape cancels without allowing a subsequent blur to create a TODO', async () => {
    const input = await openInput('common');
    await act(async () => fireEvent.keyDown(input, { key: 'Escape' }));
    fireEvent.blur(input);
    expect(createTodo).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText('할 일')).not.toBeInTheDocument();
  });

  it('monthly priority cycles from three to null and from null to one', async () => {
    let todo = { id: 'priority', title: '우선순위 순환', status: 'pending', priority: 3 } as Todo;
    vi.mocked(listByScope).mockImplementation(async () => [{ ...todo }]);
    vi.mocked(updateTodo).mockImplementation(async (_, patch) => {
      todo = { ...todo, ...patch };
    });
    await act(async () => { render(views.monthly()); });
    fireEvent.click(screen.getByRole('button', { name: '***' }));
    await waitFor(() => expect(updateTodo).toHaveBeenLastCalledWith('priority', { priority: null }));
    fireEvent.click(await screen.findByRole('button', { name: '우선순위' }));
    await waitFor(() => expect(updateTodo).toHaveBeenLastCalledWith('priority', { priority: 1 }));
  });
});
