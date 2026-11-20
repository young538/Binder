'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createNote } from '@/lib/repo/notes';
import type { NoteKind, RetroSource } from '@/lib/types';
import { useBinder } from '@/store';
import { Dialog, actionClass, fieldClass } from '@/components/common/Dialog';

interface Props {
  source: RetroSource;
  defaultText: string;
  beforeCreate?: () => Promise<void>;
}

export function RetroPrincipleAction({ source, defaultText, beforeCreate }: Props) {
  const { goals } = useBinder();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<NoteKind>('principle');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [goalId, setGoalId] = useState('');
  const [pinned, setPinned] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const openModal = () => {
    const clean = defaultText.trim();
    const firstLine = clean.split('\n')[0]?.trim().slice(0, 80) ?? '';
    setTitle(firstLine);
    setBody(clean);
    setKind('principle');
    setPinned(true);
    setError('');
    setSavedId(null);
    setOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!title.trim()) {
      setError('원칙 제목을 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await beforeCreate?.();
      const created = await createNote({
        kind,
        title: title.trim(),
        body: body.trim(),
        pinned,
        reviewDate: null,
        decisionOutcome: null,
        goalId: goalId || null,
        projectId: null,
        sourceRetro: source,
      });
      setSavedId(created.id);
      setOpen(false);
    } catch {
      setError('노트를 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={openModal}
        className="rounded-lg border border-amber-200 px-3 py-2 text-sm text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40"
      >
        내 원칙으로 남기기
      </button>
      {savedId && (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          원칙 노트로 남겼어요.{' '}
          <Link href={`/notes?note=${encodeURIComponent(savedId)}`} className="underline">
            노트에서 보기
          </Link>
        </p>
      )}
      {open && (
        <Dialog title="회고에서 원칙·노트 남기기" onClose={() => { if (!busy) setOpen(false); }}>
          <form onSubmit={e => void submit(e)} className="space-y-3">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              종류
              <select
                aria-label="노트 종류"
                value={kind}
                disabled={busy}
                onChange={e => setKind(e.target.value as NoteKind)}
                className={`mt-1 ${fieldClass}`}
              >
                <option value="principle">📌 내 원칙</option>
                <option value="insight">💡 인사이트</option>
                <option value="decision">⚖️ 의사결정</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              제목
              <input
                type="text"
                aria-label="원칙 제목"
                required
                disabled={busy}
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="핵심 원칙 한 문장"
                className={`mt-1 ${fieldClass}`}
              />
            </label>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              내용
              <textarea
                rows={4}
                aria-label="원칙 본문"
                disabled={busy}
                value={body}
                onChange={e => setBody(e.target.value)}
                className={`mt-1 ${fieldClass}`}
              />
            </label>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              상위 목표 연결
              <select
                aria-label="연결 목표"
                value={goalId}
                disabled={busy}
                onChange={e => setGoalId(e.target.value)}
                className={`mt-1 ${fieldClass}`}
              >
                <option value="">목표 없음</option>
                {goals.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={pinned}
                disabled={busy}
                onChange={e => setPinned(e.target.checked)}
              />
              상단에 고정하기
            </label>
            {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                취소
              </button>
              <button type="submit" disabled={busy} className={actionClass}>
                {busy ? '저장 중…' : '노트 저장'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
