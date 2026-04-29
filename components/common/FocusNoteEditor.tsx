'use client';
import { useEffect, useRef, useState } from 'react';
import { FocusScope } from '@/lib/types';
import { upsertFocus, getFocus } from '@/lib/repo/focusNotes';

interface Props {
  scope: FocusScope;
  scopeKey: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}

export const FocusNoteEditor = ({ scope, scopeKey, label, placeholder, multiline, rows }: Props) => {
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    getFocus(scope, scopeKey).then(f => {
      if (cancelled) return; // 사용자가 다른 scope 으로 이동하면 stale 응답으로 입력 덮어쓰지 않음
      setText(f?.text ?? '');
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [scope, scopeKey]);

  // unmount / scope 변경 시 pending 타이머 정리 — 같은 컴포넌트가 다른 scope 으로 재사용될 때 이전 저장이 새 입력을 덮지 않도록
  useEffect(() => {
    return () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
    };
  }, []);

  const onChange = (v: string) => {
    setText(v);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      upsertFocus(scope, scopeKey, v);
    }, 1000);
  };

  if (!loaded) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">{label}</div>
      {multiline ? (
        <textarea
          value={text}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? '자유롭게 적어보세요'}
          rows={rows ?? 8}
          className="w-full text-sm leading-relaxed bg-transparent border-none outline-none text-zinc-800 dark:text-zinc-50 placeholder:text-zinc-400 resize-y min-h-[8rem]"
        />
      ) : (
        <input
          type="text"
          value={text}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? '한 문장으로 적어보세요'}
          className="w-full text-lg font-medium bg-transparent border-none outline-none text-zinc-800 dark:text-zinc-50 placeholder:text-zinc-400"
        />
      )}
    </div>
  );
};
