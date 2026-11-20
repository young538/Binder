import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WeeklyDataProvider, useWeeklyData } from '@/components/week/WeeklyDataProvider';
import { getTimeBlocksInRange } from '@/lib/repo/timeBlocks';
import { listDayTodosInRange } from '@/lib/repo/todos';
import { notifyMutation } from '@/lib/repo/events';
import type { Todo } from '@/lib/types';

vi.mock('@/lib/repo/timeBlocks', () => ({ getTimeBlocksInRange: vi.fn() }));
vi.mock('@/lib/repo/todos', () => ({ listDayTodosInRange: vi.fn() }));

function Consumer({ name }: { name: string }) {
  const { todos } = useWeeklyData();
  return <div data-testid={name}>{todos.map((todo) => todo.title).join(',')}</div>;
}

beforeEach(() => {
  vi.mocked(getTimeBlocksInRange).mockReset().mockResolvedValue([]);
  vi.mocked(listDayTodosInRange).mockReset().mockResolvedValue([]);
});
afterEach(cleanup);

describe('weekly shared queries', () => {
  it('shares range requests across views and only refreshes the changed resource', async () => {
    render(<StrictMode><WeeklyDataProvider isoweek="2026-W37"><Consumer name="desktop" /><Consumer name="mobile" /></WeeklyDataProvider></StrictMode>);
    await waitFor(() => expect(listDayTodosInRange).toHaveBeenCalledTimes(1));
    expect(listDayTodosInRange).toHaveBeenCalledWith('2026-09-07', '2026-09-13');
    expect(getTimeBlocksInRange).toHaveBeenCalledTimes(1);
    vi.mocked(listDayTodosInRange).mockResolvedValue([{ title: '수정한 할 일' } as Todo]);
    await act(async () => notifyMutation('todos'));
    expect(screen.getByTestId('desktop')).toHaveTextContent('수정한 할 일');
    expect(screen.getByTestId('mobile')).toHaveTextContent('수정한 할 일');
    expect(getTimeBlocksInRange).toHaveBeenCalledTimes(1);
    expect(listDayTodosInRange).toHaveBeenCalledTimes(2);
    await act(async () => notifyMutation());
    expect(listDayTodosInRange).toHaveBeenCalledTimes(2);
  });

  it('ignores an old response arriving after a newer mutation refresh', async () => {
    let resolveOld!: (todos: Todo[]) => void;
    vi.mocked(listDayTodosInRange).mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }));
    render(<WeeklyDataProvider isoweek="2026-W37"><Consumer name="view" /></WeeklyDataProvider>);
    vi.mocked(listDayTodosInRange).mockResolvedValue([{ title: '최신' } as Todo]);
    await act(async () => notifyMutation('todos'));
    await act(async () => resolveOld([{ title: '이전' } as Todo]));
    expect(screen.getByTestId('view')).toHaveTextContent('최신');
    expect(screen.getByTestId('view')).not.toHaveTextContent('이전');
  });

  it('shows a retry action when loading fails', async () => {
    vi.mocked(listDayTodosInRange).mockRejectedValueOnce(new Error('offline'));
    render(<WeeklyDataProvider isoweek="2026-W37"><Consumer name="view" /></WeeklyDataProvider>);
    expect(await screen.findByRole('alert')).toHaveTextContent('불러오지 못했습니다');
    await act(async () => screen.getByRole('button', { name: '다시 시도' }).click());
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
