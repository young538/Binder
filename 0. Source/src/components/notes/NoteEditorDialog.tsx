'use client';
import { useState } from 'react';
import { addMonths, format } from 'date-fns';
import { createNote, updateNote } from '@/lib/repo/notes';
import { NOTE_KIND_LABEL, type BinderNote, type NoteKind } from '@/lib/types';
import { useBinder } from '@/store';
import { Dialog, actionClass, fieldClass } from '@/components/common/Dialog';

interface Props {
  existing?: BinderNote;
  defaultKind?: NoteKind;
  defaultProjectId?: string;
  onClose: () => void;
  onSaved?: (note: BinderNote) => void;
}

const KINDS: NoteKind[] = ['principle', 'decision', 'insight', 'reference'];

export function NoteEditorDialog({
  existing,
  defaultKind = 'principle',
  defaultProjectId = '',
  onClose,
  onSaved,
}: Props) {
  const { goals, projects } = useBinder();
  const [kind, setKind] = useState<NoteKind>(existing?.kind ?? defaultKind);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [pinned, setPinned] = useState(existing?.pinned ?? (defaultKind === 'principle'));
  const [reviewDate, setReviewDate] = useState(existing?.reviewDate ?? '');
  const [decisionOutcome, setDecisionOutcome] = useState(existing?.decisionOutcome ?? '');
  const [goalId, setGoalId] = useState(existing?.goalId ?? '');
  const [projectId, setProjectId] = useState(existing?.projectId ?? defaultProjectId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const setReviewOffset = (months: number) => {
    setReviewDate(format(addMonths(new Date(), months), 'yyyy-MM-dd'));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!title.trim()) {
      setError('제목을 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = {
        kind,
        title: title.trim(),
        body,
        pinned,
        reviewDate: kind === 'decision' ? (reviewDate || null) : null,
        decisionOutcome: kind === 'decision' ? (decisionOutcome.trim() || null) : null,
        goalId: goalId || null,
        projectId: projectId || null,
        sourceRetro: existing?.sourceRetro ?? null,
      };
      const saved = existing
        ? await updateNote(existing.id, payload)
        : await createNote(payload);
      onSaved?.(saved);
      onClose();
    } catch {
      setError('노트를 저장하지 못했어요. 입력값을 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={existing ? '노트 편집' : '새 노트·원칙'} onClose={() => { if (!busy) onClose(); }}>
      <form onSubmit={e => void submit(e)} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            분류
            <select
              aria-label="노트 분류"
              value={kind}
              disabled={busy}
              onChange={e => setKind(e.target.value as NoteKind)}
              className={`mt-1 ${fieldClass}`}
            >
              {KINDS.map(k => (
                <option key={k} value={k}>
                  {NOTE_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pt-6 text-sm font-medium">
            <input
              type="checkbox"
              checked={pinned}
              disabled={busy}
              onChange={e => setPinned(e.target.checked)}
            />
            상단 고정
          </label>
        </div>

        <label className="block text-sm font-medium">
          제목
          <input
            type="text"
            aria-label="노트 제목"
            required
            autoFocus
            disabled={busy}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={kind === 'principle' ? '예: 아침 90분은 알림을 끄고 딥워크' : '제목을 입력하세요'}
            className={`mt-1 ${fieldClass}`}
          />
        </label>

        <label className="block text-sm font-medium">
          내용
          <textarea
            rows={5}
            aria-label="노트 내용"
            disabled={busy}
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={
              kind === 'decision'
                ? '무엇을 결정했고, 어떤 근거와 대안을 고려했는지 기록하세요.'
                : '원칙의 배경이나 참고 내용을 자유롭게 적어 보세요.'
            }
            className={`mt-1 ${fieldClass}`}
          />
        </label>

        {kind === 'decision' && (
          <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 dark:border-indigo-900 dark:bg-indigo-950/20">
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-indigo-900 dark:text-indigo-200">
                <span>복기 예정일</span>
                <div className="flex gap-1">
                  {[1, 3, 6].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setReviewOffset(m)}
                      className="rounded border border-indigo-200 bg-white px-2 py-0.5 text-[11px] text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-zinc-900 dark:text-indigo-300"
                    >
                      +{m}개월
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="date"
                aria-label="복기 예정일"
                value={reviewDate}
                disabled={busy}
                onChange={e => setReviewDate(e.target.value)}
                className={fieldClass}
              />
            </div>
            <label className="block text-xs font-medium text-indigo-900 dark:text-indigo-200">
              복기 결과 <span className="font-normal text-zinc-500">(추후 복기 시 작성)</span>
              <textarea
                rows={2}
                aria-label="복기 결과"
                value={decisionOutcome}
                disabled={busy}
                onChange={e => setDecisionOutcome(e.target.value)}
                placeholder="시간이 지난 뒤 실제로 어떤 결과가 나왔나요?"
                className={`mt-1 ${fieldClass}`}
              />
            </label>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            목표 연결
            <select
              aria-label="노트 연결 목표"
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
          <label className="block text-sm font-medium">
            프로젝트 연결
            <select
              aria-label="노트 연결 프로젝트"
              value={projectId}
              disabled={busy}
              onChange={e => setProjectId(e.target.value)}
              className={`mt-1 ${fieldClass}`}
            >
              <option value="">프로젝트 없음</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            취소
          </button>
          <button type="submit" disabled={busy} className={actionClass}>
            {busy ? '저장 중…' : existing ? '변경 저장' : '노트 만들기'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
