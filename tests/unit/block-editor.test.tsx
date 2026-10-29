import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlockEditor } from '@/components/week/BlockEditor';
import { createTimeBlock, deleteTimeBlock, updateTimeBlock } from '@/lib/repo/timeBlocks';
import type { TimeBlock } from '@/lib/types';

vi.mock('@/lib/repo/timeBlocks', () => ({
  createTimeBlock: vi.fn(), updateTimeBlock: vi.fn(), deleteTimeBlock: vi.fn(),
}));
vi.mock('@/lib/repo/todos', () => ({ listByScope: vi.fn().mockResolvedValue([]) }));
vi.mock('@/store', () => ({ useBinder: () => ({
  categories: [{ id: 'work', name: '업무', color: '#123456' }], settings: { gridMinutes: 30 },
}) }));
vi.mock('@/components/common/GoalPicker', () => ({ GoalPicker: () => null }));

const initial = { date: '2026-09-09', startMin: 1410, endMin: 1440 };
const existing = { ...initial, id: 'block', text: '기존 내용', categoryId: 'work', kind: 'plan' } as TimeBlock;

beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('block editor persistence', () => {
  it('keeps dirty edits and blocks duplicate submits and closing during a failed save', async () => {
    let rejectSave!: (error: Error) => void;
    vi.mocked(createTimeBlock).mockReturnValueOnce(new Promise((_, reject) => { rejectSave = reject; }));
    const onClose = vi.fn();
    const onSaved = vi.fn();
    render(<BlockEditor initial={initial} onClose={onClose} onSaved={onSaved} />);
    fireEvent.change(screen.getByPlaceholderText('내용'), { target: { value: '작성 중 내용' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(createTimeBlock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '닫기' })).toBeDisabled();
    expect(screen.getByPlaceholderText('내용')).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => rejectSave(new Error('offline')));
    expect(screen.getByRole('alert')).toHaveTextContent('저장하지 못했어요');
    expect(screen.getByPlaceholderText('내용')).toHaveValue('작성 중 내용');
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled();
    expect(onSaved).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '저장' })));
    expect(createTimeBlock).toHaveBeenCalledTimes(2);
    expect(onSaved).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('requires real time inputs, handles midnight, and keeps snapped late starts inside the day', async () => {
    render(<BlockEditor initial={initial} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByLabelText('종료 (00:00은 자정)')).toHaveValue('00:00');
    fireEvent.change(screen.getByLabelText('시작'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(createTimeBlock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('시간을 입력');
    fireEvent.change(screen.getByLabelText('시작'), { target: { value: '23:59' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '저장' })));
    expect(createTimeBlock).toHaveBeenLastCalledWith(expect.objectContaining({ startMin: 1410, endMin: 1440 }));
    fireEvent.change(screen.getByLabelText('시작'), { target: { value: '00:00' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '저장' })));
    expect(createTimeBlock).toHaveBeenLastCalledWith(expect.objectContaining({ startMin: 0, endMin: 1440 }));
  });

  it('requires an explicit category choice when the existing category is missing', async () => {
    render(<BlockEditor initial={initial} existing={{ ...existing, categoryId: 'removed-category' }} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(updateTimeBlock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('카테고리를 선택');
    fireEvent.click(screen.getByRole('button', { name: '업무' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '저장' })));
    expect(updateTimeBlock).toHaveBeenCalledWith('block', expect.objectContaining({ categoryId: 'work' }));
  });

  it('blocks saves and closing during delete, and leaves the editor open on failure', async () => {
    let rejectDelete!: (error: Error) => void;
    vi.mocked(deleteTimeBlock).mockReturnValueOnce(new Promise((_, reject) => { rejectDelete = reject; }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onClose = vi.fn();
    render(<BlockEditor initial={initial} existing={existing} onClose={onClose} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(deleteTimeBlock).toHaveBeenCalledOnce();
    expect(updateTimeBlock).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => rejectDelete(new Error('offline')));
    expect(screen.getByRole('alert')).toHaveTextContent('삭제하지 못했어요');
    expect(screen.getByPlaceholderText('내용')).toHaveValue('기존 내용');
    expect(screen.getByRole('button', { name: '삭제' })).toBeEnabled();
  });
});
