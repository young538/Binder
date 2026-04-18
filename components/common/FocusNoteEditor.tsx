'use client';
import { useEffect, useRef, useState } from 'react';
import { FocusScope } from '@/lib/types';
import { upsertFocus, getFocus } from '@/lib/repo/focusNotes';

interface Props {
  scope: FocusScope;
  scopeKey: string;
  label: string;
  placeholder?: string;
}

export const FocusNoteEditor = ({ scope, scopeKey, label, placeholder }: Props) => {
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    getFocus(scope, scopeKey).then(f => {
      setText(f?.text ?? '');
      setLoaded(true);
    });
  }, [scope, scopeKey]);

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
      <input
        type="text"
        value={text}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? '한 문장으로 적어보세요'}
        className="w-full text-lg font-medium bg-transparent border-none outline-none text-zinc-800 dark:text-zinc-50 placeholder:text-zinc-400" />
    </div>
  );
};
