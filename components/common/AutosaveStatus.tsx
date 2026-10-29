'use client';

import { SaveStatus } from '@/lib/autosave/queue';

export function AutosaveStatus({ status, loadError, retry }: {
  status: SaveStatus;
  loadError?: boolean;
  retry: () => void;
}) {
  const error = loadError || status === 'error';
  const label = loadError ? '불러오지 못했습니다.' : {
    idle: '', pending: '저장 대기 중…', saving: '저장 중…', saved: '저장됨',
    error: '저장하지 못했습니다. 입력 내용은 이 탭에 보관됩니다.',
  }[status];
  return (
    <div role="status" className={`mt-1 text-right text-[11px] ${error ? 'text-rose-600' : 'text-zinc-400'}`}>
      {label}
      {error && <button type="button" onClick={retry} className="ml-2 underline">다시 시도</button>}
    </div>
  );
}
