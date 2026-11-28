import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { useStoredBoolean } from '@/lib/hooks/useStoredBoolean';
import { http } from '@/lib/repo/http';
import { deleteProject } from '@/lib/repo/projects';
import { notifyMutation } from '@/lib/repo/events';

vi.mock('@/store', () => ({ useBinder: (select: (state: { me: { userId: string } }) => unknown) => select({ me: { userId: 'hooks-user' } }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

function Query({ date, read }: { date: string; read: () => Promise<string> }) {
  const query = useAsyncResource(date, read, 'loading', ['todos']);
  return <div>{query.value}</div>;
}

function Preference({ name }: { name: string }) {
  const [open, toggle] = useStoredBoolean(name);
  return <button onClick={toggle}>{open ? 'open' : 'closed'}</button>;
}

describe('client read and preference adapters', () => {
  it('ignores old-date responses and only refreshes matching mutation events', async () => {
    let resolve!: (value: string) => void;
    const oldRead = vi.fn(() => new Promise<string>(done => { resolve = done; }));
    const nextRead = vi.fn().mockResolvedValue('new date');
    const view = render(<Query date="one" read={oldRead} />);
    await waitFor(() => expect(oldRead).toHaveBeenCalledTimes(1));
    view.rerender(<Query date="two" read={nextRead} />);
    await screen.findByText('new date');
    await act(async () => resolve('old date'));
    expect(screen.queryByText('old date')).not.toBeInTheDocument();
    await act(async () => notifyMutation('books'));
    expect(nextRead).toHaveBeenCalledTimes(1);
    nextRead.mockResolvedValue('updated');
    await act(async () => notifyMutation('todos'));
    await screen.findByText('updated');
  });

  it('refreshes each interested query once per project deletion', async () => {
    vi.spyOn(http, 'del').mockResolvedValue(undefined);
    const dashboard = vi.fn().mockResolvedValue(1);
    const todos = vi.fn().mockResolvedValue(1);
    const books = vi.fn().mockResolvedValue(1);
    renderHook(() => {
      useAsyncResource('dashboard', dashboard, 0, ['projects', 'todos', 'timeBlocks', 'notes', 'lifeEvents']);
      useAsyncResource('todos', todos, 0, ['todos']);
      useAsyncResource('books', books, 0, ['books']);
    });
    await waitFor(() => expect(books).toHaveBeenCalledTimes(1));
    await act(async () => deleteProject('project'));
    expect(dashboard).toHaveBeenCalledTimes(2);
    expect(todos).toHaveBeenCalledTimes(2);
    expect(books).toHaveBeenCalledTimes(1);
  });

  it('reads persisted disclosure state and separates preference keys', async () => {
    localStorage.setItem('user-a:section', 'true');
    const view = render(<Preference name="user-a:section" />);
    expect(screen.getByRole('button')).toHaveTextContent('open');
    view.rerender(<Preference name="user-b:section" />);
    expect(screen.getByRole('button')).toHaveTextContent('closed');
    fireEvent.click(screen.getByRole('button'));
    expect(localStorage.getItem('user-b:section')).toBe('true');
  });

  it('keeps disclosure controls usable when storage writes are blocked', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    render(<Preference name="write-blocked" />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent('open'));
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('closed');
  });
});
