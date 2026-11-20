'use client';
import { useState } from 'react';
import { Upload } from 'lucide-react';
import { importIcsEvents } from '@/lib/repo/lifeEvents';
import { Dialog, actionClass, fieldClass } from '@/components/common/Dialog';

interface Props {
  onClose: () => void;
  onImported: (result: { imported: number; updated: number; total: number }) => void;
}

export function IcsImportDialog({ onClose, onImported }: Props) {
  const [mode, setMode] = useState<'text' | 'url'>('text');
  const [icsText, setIcsText] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const content = await file.text();
      setIcsText(content);
      setMode('text');
    } catch {
      setError('파일을 읽지 못했어요.');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await importIcsEvents(
        mode === 'text' ? { icsText: icsText.trim() } : { url: url.trim() },
      );
      onImported(result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ICS 일정을 가져오지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title=".ics 캘린더 가져오기" onClose={() => { if (!busy) onClose(); }}>
      <form onSubmit={e => void submit(e)} className="space-y-4">
        <div className="flex gap-1.5" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'text'}
            onClick={() => setMode('text')}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              mode === 'text'
                ? 'bg-blue-600 text-white'
                : 'border border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300'
            }`}
          >
            파일 / 텍스트 붙여넣기
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'url'}
            onClick={() => setMode('url')}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              mode === 'url'
                ? 'bg-blue-600 text-white'
                : 'border border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300'
            }`}
          >
            HTTPS 구독 URL
          </button>
        </div>

        {mode === 'text' ? (
          <div className="space-y-3">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
              <Upload size={14} /> .ics 파일 선택
              <input type="file" accept=".ics,text/calendar" onChange={e => void handleFile(e)} className="hidden" />
            </label>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              ICS 내용
              <textarea
                rows={7}
                aria-label="ICS 텍스트"
                disabled={busy}
                value={icsText}
                onChange={e => setIcsText(e.target.value)}
                placeholder={'BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:병원 검진\nDTSTART;VALUE=DATE:20261201\nEND:VEVENT\nEND:VCALENDAR'}
                className={`mt-1 font-mono text-xs ${fieldClass}`}
              />
            </label>
          </div>
        ) : (
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            공개 HTTPS .ics URL
            <input
              type="url"
              aria-label="ICS URL"
              disabled={busy}
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
              className={`mt-1 ${fieldClass}`}
            />
          </label>
        )}

        <p className="text-xs text-zinc-500">
          동일한 UID를 가진 일정은 중복 생성하지 않고 최신 내용으로 업데이트됩니다.
        </p>

        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            취소
          </button>
          <button type="submit" disabled={busy} className={actionClass}>
            {busy ? '가져오는 중…' : '일정 가져오기'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
