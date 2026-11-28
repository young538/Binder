'use client';

import { useState, type FormEvent } from 'react';
import { FileUp, FileText } from 'lucide-react';
import { Dialog, actionClass, fieldClass } from '@/components/common/Dialog';
import { captureWikiRawNote, uploadWikiRawFile } from '@/lib/repo/wiki';
import type { WikiRawFile } from '@/lib/wiki';

interface Props {
  onClose: () => void;
  onSaved: (file: WikiRawFile) => void;
}

export function WikiRawCaptureDialog({ onClose, onSaved }: Props) {
  const [tab, setTab] = useState<'note' | 'file'>('note');
  const [title, setTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitNote = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const tags = tagsText
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      const saved = await captureWikiRawNote({
        title: title.trim(),
        content: content.trim(),
        sourceUrl: sourceUrl.trim() || undefined,
        tags,
      });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Raw 메모 저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const submitFile = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !file) return;
    setError(null);
    setBusy(true);
    try {
      const saved = await uploadWikiRawFile(file);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일 업로드에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title="Raw 수집함에 넣기" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          여기에 넣어둔 원문은 수정되지 않는 <strong>Raw 계층</strong>으로 보존되며, 이후 에이전트가 읽어 위키 페이지로 컴파일·링크합니다.
        </p>

        <div className="flex gap-1.5 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-950" role="tablist" aria-label="Raw 입력 방식">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'note'}
            onClick={() => {
              setTab('note');
              setError(null);
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              tab === 'note'
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <FileText size={14} /> 메모 · 링크
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'file'}
            onClick={() => {
              setTab('file');
              setError(null);
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              tab === 'file'
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <FileUp size={14} /> 파일 업로드
          </button>
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {tab === 'note' ? (
          <form onSubmit={e => void submitNote(e)} className="space-y-3">
            <label className="block space-y-1 text-xs">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">제목</span>
              <input
                type="text"
                required
                maxLength={160}
                placeholder="예: 주식 밸류에이션 강의 요약"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">출처 URL (선택)</span>
              <input
                type="url"
                placeholder="https://..."
                value={sourceUrl}
                onChange={e => setSourceUrl(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">태그 (쉼표 구분, 선택)</span>
              <input
                type="text"
                placeholder="투자, 재무, 강의"
                value={tagsText}
                onChange={e => setTagsText(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">원문 · 메모 내용</span>
              <textarea
                required
                rows={7}
                placeholder="기사 본문, 유튜브 스크립트, 읽고 남기고 싶은 핵심 문장을 그대로 붙여넣으세요."
                value={content}
                onChange={e => setContent(e.target.value)}
                className={fieldClass}
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                취소
              </button>
              <button type="submit" disabled={busy || !title.trim() || !content.trim()} className={actionClass}>
                {busy ? '저장 중…' : 'Raw 저장'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={e => void submitFile(e)} className="space-y-3">
            <label className="block space-y-1.5 text-xs">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                파일 선택 (.md, .txt, .pdf, .csv, .xlsx, .json, 이미지 / 최대 10MB)
              </span>
              <input
                type="file"
                aria-label="업로드할 Raw 파일"
                accept=".md,.txt,.pdf,.csv,.xlsx,.json,.png,.jpg,.jpeg,.webp"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className={fieldClass}
              />
            </label>
            {file && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                선택됨: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                취소
              </button>
              <button type="submit" disabled={busy || !file} className={actionClass}>
                {busy ? '업로드 중…' : '파일 올리기'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Dialog>
  );
}
