'use client';
import { useRef, useState } from 'react';
import { PROJECT_STATUS_LABEL, type Project, type ProjectStatus } from '@/lib/types';
import { createProject, updateProject } from '@/lib/repo/projects';
import { useBinder } from '@/store';
import { Dialog, actionClass, fieldClass } from '@/components/common/Dialog';

const STATUS_OPTIONS: ProjectStatus[] = ['active', 'planned', 'onHold', 'done'];

interface Props {
  existing?: Project;
  nextOrder: number;
  onClose: () => void;
  onSaved: (project: Project) => void;
}

export function ProjectEditorDialog({ existing, nextOrder, onClose, onSaved }: Props) {
  const { goals, categories, reload } = useBinder();
  const [title, setTitle] = useState(existing?.title ?? '');
  const [status, setStatus] = useState<ProjectStatus>(existing?.status ?? 'active');
  const [goalId, setGoalId] = useState(existing?.goalId ?? '');
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? '');
  const [deadline, setDeadline] = useState(existing?.deadline ?? '');
  const [outcome, setOutcome] = useState(existing?.outcome ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);

  const save = async () => {
    if (lock.current) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setError('프로젝트 제목을 입력해 주세요.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const payload = {
        title: trimmed,
        status,
        goalId: goalId || null,
        categoryId: categoryId || null,
        deadline: deadline || null,
        outcome: outcome.trim() || null,
        note: note.trim() || null,
      };
      const saved = existing
        ? await updateProject(existing.id, payload)
        : await createProject({ ...payload, order: nextOrder });
      await reload();
      onSaved(saved);
    } catch {
      setError('프로젝트를 저장하지 못했어요. 입력값을 확인하고 다시 시도해 주세요.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <Dialog title={existing ? '프로젝트 편집' : '새 프로젝트'} onClose={() => { if (!busy) onClose(); }}>
      <form onSubmit={event => { event.preventDefault(); void save(); }} className="space-y-4">
        <fieldset disabled={busy} className="space-y-4">
          <label className="block text-sm font-medium">
            프로젝트 제목
            <input
              type="text"
              aria-label="프로젝트 제목"
              autoFocus
              required
              placeholder="예: 사이드 프로젝트 v1 런칭, 이사 준비"
              value={title}
              onChange={event => setTitle(event.target.value)}
              className={`mt-1 ${fieldClass}`}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              상태
              <select
                aria-label="프로젝트 상태"
                value={status}
                onChange={event => setStatus(event.target.value as ProjectStatus)}
                className={`mt-1 ${fieldClass}`}
              >
                {STATUS_OPTIONS.map(item => (
                  <option key={item} value={item}>
                    {PROJECT_STATUS_LABEL[item]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium">
              마감일 <span className="text-xs font-normal text-zinc-500">(선택)</span>
              <input
                type="date"
                aria-label="프로젝트 마감일"
                value={deadline}
                onChange={event => setDeadline(event.target.value)}
                className={`mt-1 ${fieldClass}`}
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              상위 목표 연결
              <select
                aria-label="프로젝트 상위 목표"
                value={goalId}
                onChange={event => setGoalId(event.target.value)}
                className={`mt-1 ${fieldClass}`}
              >
                <option value="">목표 없음</option>
                {goals.map(goal => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium">
              카테고리
              <select
                aria-label="프로젝트 카테고리"
                value={categoryId}
                onChange={event => setCategoryId(event.target.value)}
                className={`mt-1 ${fieldClass}`}
              >
                <option value="">카테고리 없음</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm font-medium">
            완료 기준 한 줄 <span className="text-xs font-normal text-zinc-500">(무엇이 끝나면 완료인가요?)</span>
            <input
              type="text"
              aria-label="완료 기준"
              placeholder="예: 운영 배포 완료 및 첫 사용자 피드백 수집"
              value={outcome}
              onChange={event => setOutcome(event.target.value)}
              className={`mt-1 ${fieldClass}`}
            />
          </label>

          <label className="block text-sm font-medium">
            프로젝트 메모 / 레퍼런스
            <textarea
              aria-label="프로젝트 메모"
              rows={4}
              placeholder="참고 링크, 체크 포인트, 관련 배경을 적어 두세요."
              value={note}
              onChange={event => setNote(event.target.value)}
              className={`mt-1 ${fieldClass}`}
            />
          </label>
        </fieldset>

        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            취소
          </button>
          <button type="submit" disabled={busy} className={actionClass}>
            {busy ? '저장 중…' : existing ? '변경 저장' : '프로젝트 만들기'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
